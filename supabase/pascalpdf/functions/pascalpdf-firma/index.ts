// Edge Function de PascalPDF para pedir firmas a otras personas (proyecto Supabase de CuentaFacil).
// Conecta la lógica (logica.ts) con Postgres, Storage y Resend. El documento siempre llega cifrado.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type Codigo, type Deps, ErrorCliente, manejar, type Solicitud } from "./logica.ts";

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
  if (raw.length > 20_000) return new Response(JSON.stringify({ ok: false, error: "Solicitud demasiado grande" }), { status: 413, headers: h });
  try {
    const out = await manejar(JSON.parse(raw), deps);
    return new Response(JSON.stringify(out), { status: 200, headers: h });
  } catch (e) {
    if (e instanceof ErrorCliente) return new Response(JSON.stringify({ ok: false, error: e.message }), { status: e.status, headers: h });
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: "Error interno. Intenta de nuevo." }), { status: 500, headers: h });
  }
});
