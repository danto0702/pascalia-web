// Edge Function de PascalPDF para pedir firmas a otras personas (proyecto Supabase de CuentaFacil).
// Conecta la lógica (logica.ts) con Postgres, Storage y Resend. El documento siempre llega cifrado.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type Codigo, type Deps, ErrorCliente, manejar, type Solicitud } from "./logica.ts";
import { consumirSolicitud, type Delegacion, type DepsCuenta, manejarCuenta, type Promo, type Usuario, usuarioDeToken } from "./cuenta.ts";

const ORIGENES = new Set(["https://pascalia.lat", "https://www.pascalia.lat", "http://localhost:8000"]);
const TABLA = "pascalpdf_solicitudes";
const CODIGOS = "pascalpdf_codigos";
const BUCKET = "pascalpdf-sobres";

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ORIGENES.has(origin) ? origin : "https://pascalia.lat",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Vary": "Origin",
  };
}

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function revisar<T>(r: { data: T; error: unknown }) {
  if (r.error) throw r.error;
  return r.data;
}

const deps: Deps = {
  now: () => new Date(),
  get secreto() { return Deno.env.get("PASCALPDF_SECRETO")!; },
  sitio: "https://pascalia.lat",
  db: {
    async insertSolicitud(s) {
      return revisar(await db.from(TABLA).insert(s).select().single()) as Solicitud;
    },
    async getSolicitud(id) {
      return revisar(await db.from(TABLA).select("*").eq("id", id).maybeSingle()) as Solicitud | null;
    },
    async updateSolicitud(id, cambios) {
      revisar(await db.from(TABLA).update(cambios).eq("id", id));
    },
    async contarSolicitudesDesde(correo, desde) {
      const r = await db.from(TABLA).select("id", { count: "exact", head: true })
        .eq("remitente_correo", correo).gte("creada_en", desde.toISOString());
      if (r.error) throw r.error;
      return r.count ?? 0;
    },
    async insertCodigo(c) {
      revisar(await db.from(CODIGOS).insert(c));
    },
    async ultimoCodigo(correo) {
      return revisar(await db.from(CODIGOS).select("*").eq("correo", correo)
        .order("creado_en", { ascending: false }).limit(1).maybeSingle()) as Codigo | null;
    },
    async contarCodigosDesde(correo, desde) {
      const r = await db.from(CODIGOS).select("correo", { count: "exact", head: true })
        .eq("correo", correo).gte("creado_en", desde.toISOString());
      if (r.error) throw r.error;
      return r.count ?? 0;
    },
    async actualizarCodigo(correo, creado_en, cambios) {
      revisar(await db.from(CODIGOS).update(cambios).eq("correo", correo).eq("creado_en", creado_en));
    },
    async vencidasConArchivos(limite) {
      const corte = new Date(Date.now() - 7 * 86_400_000).toISOString();
      return revisar(await db.from(TABLA).select("*").eq("archivos_borrados", false)
        .or(`vence_en.lt.${new Date().toISOString()},estado.eq.cancelada,firmado_en.lt.${corte}`)
        .limit(limite)) as Solicitud[];
    },
  },
  storage: {
    async urlSubida(ruta) {
      const d = revisar(await db.storage.from(BUCKET).createSignedUploadUrl(ruta, { upsert: true }));
      return d.signedUrl;
    },
    async urlDescarga(ruta, segundos) {
      const d = revisar(await db.storage.from(BUCKET).createSignedUrl(ruta, segundos));
      return d.signedUrl;
    },
    async existe(ruta) {
      const [carpeta, archivo] = ruta.split("/");
      const d = revisar(await db.storage.from(BUCKET).list(carpeta, { search: archivo }));
      return (d ?? []).some((f) => f.name === archivo);
    },
    async borrar(rutas) {
      await db.storage.from(BUCKET).remove(rutas);
    },
  },
  async correo(para, asunto, html) {
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return false;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: Deno.env.get("PASCALPDF_FROM") ?? "PascalPDF <contacto@pascalia.lat>", to: [para], subject: asunto, html }),
    });
    if (!r.ok) console.error("Resend", r.status, await r.text());
    return r.ok;
  },
};

// ---------------------------------------------------------------- cuentas, planes y pagos
const USUARIOS = "pascalpdf_usuarios";
const wompiPublica = Deno.env.get("WOMPI_PUBLIC_KEY") ?? "";
const wompiIntegridad = Deno.env.get("WOMPI_INTEGRITY_SECRET") ?? "";
const wompiApi = wompiPublica.startsWith("pub_prod_") ? "https://production.wompi.co/v1" : "https://sandbox.wompi.co/v1";

const googleCliente = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
// Correos con acceso a la página de administración (separados por coma)
const admins = (Deno.env.get("PASCALPDF_ADMINS") ?? "danto0702@gmail.com").split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
const DELEG = "pascalpdf_delegaciones";

const depsCuenta: DepsCuenta = {
  now: () => new Date(),
  get secreto() { return Deno.env.get("PASCALPDF_SECRETO")!; },
  sitio: "https://pascalia.lat",
  wompi: wompiPublica && wompiIntegridad ? { publica: wompiPublica, integridad: wompiIntegridad } : null,
  correo: (para, asunto, html) => deps.correo(para, asunto, html),
  async consultarTransaccion(id) {
    const r = await fetch(`${wompiApi}/transactions/${encodeURIComponent(id)}`);
    if (!r.ok) return null;
    const j = await r.json();
    return j.data ?? null;
  },
  // Verifica el token de Google con el servicio oficial y que sea para nuestro cliente
  google: googleCliente ? {
    clienteId: googleCliente,
    async verificar(credencial) {
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credencial)}`);
      if (!r.ok) return null;
      const t = await r.json();
      if (t.aud !== googleCliente || !["accounts.google.com", "https://accounts.google.com"].includes(t.iss)) return null;
      if (Number(t.exp) * 1000 < Date.now() || typeof t.email !== "string" || typeof t.sub !== "string") return null;
      return { sub: t.sub, email: t.email, email_verified: t.email_verified === true || t.email_verified === "true", name: t.name };
    },
  } : null,
  admins,
  db: {
    async usuarioPorId(id) {
      return revisar(await db.from(USUARIOS).select("*").eq("id", id).maybeSingle()) as Usuario | null;
    },
    async crearDelegacion(x) {
      return revisar(await db.from(DELEG).insert(x).select().single()) as Delegacion;
    },
    async delegacion(id) {
      return revisar(await db.from(DELEG).select("*").eq("id", id).maybeSingle()) as Delegacion | null;
    },
    async delegacionesDe(titular_id) {
      return revisar(await db.from(DELEG).select("*").eq("titular_id", titular_id).order("creada_en", { ascending: false }).limit(100)) as Delegacion[];
    },
    async delegacionesPara(correo) {
      const r = revisar(await db.from(DELEG).select("*, titular:pascalpdf_usuarios!titular_id(correo, nombre)").eq("delegado_correo", correo)
        .order("creada_en", { ascending: false }).limit(100)) as (Delegacion & { titular: { correo: string; nombre: string | null } | null })[];
      return r.map(({ titular, ...x }) => ({ ...x, titular_correo: titular?.correo ?? "", titular_nombre: titular?.nombre ?? null }));
    },
    async actualizarDelegacion(id, cambios) {
      revisar(await db.from(DELEG).update(cambios).eq("id", id));
    },
    async adminResumen() {
      return revisar(await db.rpc("pascalpdf_admin_resumen")) as Record<string, unknown>;
    },
    async adminPromos() {
      return revisar(await db.from("pascalpdf_promos").select("*").order("codigo")) as Promo[];
    },
    async adminGuardarPromo(p) {
      const { usos: _u, ...resto } = p;
      const existe = revisar(await db.from("pascalpdf_promos").select("codigo").eq("codigo", p.codigo).maybeSingle());
      if (existe) revisar(await db.from("pascalpdf_promos").update(resto).eq("codigo", p.codigo));
      else revisar(await db.from("pascalpdf_promos").insert(resto));
    },
    async adminUsuarios(buscar) {
      let q = db.from(USUARIOS).select("*").order("creado_en", { ascending: false }).limit(50);
      if (buscar) q = q.ilike("correo", `%${buscar.replace(/[%_,()]/g, "")}%`);
      return revisar(await q) as Usuario[];
    },
    async adminPagos() {
      return revisar(await db.from("pascalpdf_pagos").select("referencia, correo, producto, precio, descuento, monto, codigo, estado, creado_en, aprobado_en")
        .order("creado_en", { ascending: false }).limit(100)) as Record<string, unknown>[];
    },
    insertCodigo: (c) => deps.db.insertCodigo(c),
    ultimoCodigo: (c) => deps.db.ultimoCodigo(c),
    contarCodigosDesde: (c, d) => deps.db.contarCodigosDesde(c, d),
    actualizarCodigo: (c, t, x) => deps.db.actualizarCodigo(c, t, x),
    async usuarioPorCorreo(correo) {
      return revisar(await db.from(USUARIOS).select("*").eq("correo", correo).maybeSingle()) as Usuario | null;
    },
    async crearUsuario(u) {
      return revisar(await db.from(USUARIOS).insert(u).select().single()) as Usuario;
    },
    async actualizarUsuario(id, cambios) {
      revisar(await db.from(USUARIOS).update(cambios).eq("id", id));
    },
    async borrarUsuario(id) {
      revisar(await db.from(USUARIOS).delete().eq("id", id));
    },
    async crearSesion(s) {
      revisar(await db.from("pascalpdf_sesiones").insert(s));
    },
    async usuarioPorSesion(token_hash, ahora) {
      const s = revisar(await db.from("pascalpdf_sesiones").select("usuario_id, vence_en").eq("token_hash", token_hash).maybeSingle()) as { usuario_id: string; vence_en: string } | null;
      if (!s || new Date(s.vence_en) < ahora) return null;
      await db.from("pascalpdf_sesiones").update({ ultimo_uso: ahora.toISOString() }).eq("token_hash", token_hash);
      return revisar(await db.from(USUARIOS).select("*").eq("id", s.usuario_id).maybeSingle()) as Usuario | null;
    },
    async borrarSesion(token_hash) {
      revisar(await db.from("pascalpdf_sesiones").delete().eq("token_hash", token_hash));
    },
    async insertarEventos(usuario_id, eventos) {
      return revisar(await db.from("pascalpdf_eventos").insert(eventos.map((e) => ({ ...e, usuario_id }))).select("id, firmado_en, consecutivo")) as { id: string; firmado_en: string; consecutivo: string | null }[];
    },
    async ultimoNumero(usuario_id, anio) {
      const r = revisar(await db.from("pascalpdf_eventos").select("numero").eq("usuario_id", usuario_id).eq("anio", anio)
        .order("numero", { ascending: false, nullsFirst: false }).limit(1)) as { numero: number | null }[];
      return r[0]?.numero ?? 0;
    },
    async eventos(usuario_id, limite) {
      return revisar(await db.from("pascalpdf_eventos").select("id, firmado_en, app, documento_tipo, documento_nombre, documento_hash, firmante, objeto, radicado, consecutivo, firma_id, metodo, paginas, delegado_nombre")
        .or(`usuario_id.eq.${usuario_id},delegado_id.eq.${usuario_id}`).order("firmado_en", { ascending: false }).limit(limite)) as never;
    },
    async contarEventosDesde(usuario_id, desde) {
      const r = await db.from("pascalpdf_eventos").select("id", { count: "exact", head: true }).eq("usuario_id", usuario_id).gte("firmado_en", desde.toISOString());
      if (r.error) throw r.error;
      return r.count ?? 0;
    },
    async contarSolicitudesDesde(usuario_id, desde) {
      const r = await db.from(TABLA).select("id", { count: "exact", head: true }).eq("usuario_id", usuario_id).gte("creada_en", desde.toISOString());
      if (r.error) throw r.error;
      return r.count ?? 0;
    },
    async promo(codigo) {
      return revisar(await db.from("pascalpdf_promos").select("*").eq("codigo", codigo).maybeSingle()) as Promo | null;
    },
    async promoUsada(codigo, usuario_id) {
      const r = await db.from("pascalpdf_promos_usos").select("codigo", { count: "exact", head: true }).eq("codigo", codigo).eq("usuario_id", usuario_id);
      if (r.error) throw r.error;
      return (r.count ?? 0) > 0;
    },
    async crearPago(p) {
      revisar(await db.from("pascalpdf_pagos").insert(p));
    },
    async pago(referencia) {
      return revisar(await db.from("pascalpdf_pagos").select("referencia, usuario_id, monto, estado").eq("referencia", referencia).maybeSingle()) as never;
    },
    async marcarPago(referencia, estado, wompi_id) {
      revisar(await db.from("pascalpdf_pagos").update({ estado, wompi_id }).eq("referencia", referencia).eq("estado", "pendiente"));
    },
    async aplicarPago(referencia, wompi_id) {
      return revisar(await db.rpc("pascalpdf_aplicar_pago", { p_referencia: referencia, p_wompi_id: wompi_id })) as boolean;
    },
    async pagos(usuario_id) {
      return revisar(await db.from("pascalpdf_pagos").select("referencia, producto, monto, estado, creado_en, aprobado_en")
        .eq("usuario_id", usuario_id).order("creado_en", { ascending: false }).limit(200)) as never;
    },
  },
};
deps.cuenta = (token) => consumirSolicitud(depsCuenta, token);
deps.usuario = (token) => usuarioDeToken(depsCuenta, token);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const h = { ...cors(origin), "Content-Type": "application/json; charset=utf-8" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405, headers: h });
  if (origin && !ORIGENES.has(origin)) return new Response(JSON.stringify({ ok: false, error: "Origen no permitido" }), { status: 403, headers: h });
  const secreto = Deno.env.get("PASCALPDF_SECRETO") ?? "";
  if (secreto.length < 32 || !Deno.env.get("RESEND_API_KEY")) {
    console.error("pascalpdf-firma sin configurar: faltan PASCALPDF_SECRETO (32+ caracteres) o RESEND_API_KEY");
    return new Response(JSON.stringify({ ok: false, error: "El servicio de firmas no está disponible todavía." }), { status: 503, headers: h });
  }
  const raw = await req.text();
  // Solo delegar una firma (que lleva la imagen) puede enviar más de 20 KB
  if (raw.length > 700_000 || (raw.length > 20_000 && !raw.includes('"accion":"delegar_crear"'))) {
    return new Response(JSON.stringify({ ok: false, error: "Solicitud demasiado grande" }), { status: 413, headers: h });
  }
  try {
    const d = JSON.parse(raw);
    const out = (await manejarCuenta(d, depsCuenta)) ?? (await manejar(d, deps));
    return new Response(JSON.stringify(out), { status: 200, headers: h });
  } catch (e) {
    if (e instanceof ErrorCliente) return new Response(JSON.stringify({ ok: false, error: e.message }), { status: e.status, headers: h });
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: "Error interno. Intenta de nuevo." }), { status: 500, headers: h });
  }
});
