// Recibe las solicitudes del formulario de pascalia.lat: valida, frena spam,
// guarda en pascalia_solicitudes y envía el aviso y la respuesta automática (Resend).
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGENES = new Set([
  "https://pascalia.lat",
  "https://www.pascalia.lat",
  "http://localhost:8000",
]);

const SOLUCIONES: Record<string, string> = {
  flota: "Flota Vehicular",
  nana_dnt: "NANA DNT",
  si_aps: "SI-APS",
  mision_medica: "Misión Médica",
  cuentafacil: "CuentaFacil",
  consultoria: "Consultoría",
  desarrollo: "Desarrollo a la medida",
  capacitacion: "Capacitación",
  otro: "Otro",
};
const FUENTES: Record<string, string> = {
  recomendacion: "Recomendación",
  redes_sociales: "Redes sociales",
  busqueda: "Búsqueda en internet",
  evento: "Evento",
  whatsapp: "WhatsApp",
  otro: "Otro",
};

function cors(origin: string | null) {
  const allow = origin && ORIGENES.has(origin) ? origin : "https://pascalia.lat";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

const texto = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
const parrafo = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function enviarCorreo(key: string, payload: Record<string, unknown>) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) console.error("Resend", r.status, await r.text());
  return r.ok;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405, origin);
  if (origin && !ORIGENES.has(origin)) return json({ ok: false, error: "Origen no permitido" }, 403, origin);

  const raw = await req.text();
  if (raw.length > 20_000) return json({ ok: false, error: "Solicitud demasiado grande" }, 413, origin);
  let d: Record<string, unknown>;
  try { d = JSON.parse(raw); } catch { return json({ ok: false, error: "Formato inválido" }, 400, origin); }

  // Trampas para bots: campo invisible y envío demasiado rápido. Se responde "ok" sin guardar.
  if (texto(d.sitio_web, 200) !== "" || Number(d.t ?? 0) < 2500) {
    return json({ ok: true }, 200, origin);
  }

  const s = {
    nombre: texto(d.nombre, 120),
    correo: texto(d.correo, 160).toLowerCase(),
    whatsapp: texto(d.whatsapp, 30) || null,
    solucion: texto(d.solucion, 30),
    tamano: texto(d.tamano, 120) || null,
    mensaje: parrafo(d.mensaje, 3000),
    fuente: texto(d.fuente, 30) || null,
    pagina_origen: texto(d.pagina, 200) || null,
    utm: d.utm && typeof d.utm === "object" ? d.utm : null,
    acepta_datos: d.acepta_datos === true,
  };

  const errores: string[] = [];
  if (s.nombre.length < 2) errores.push("nombre");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.correo)) errores.push("correo");
  if (!(s.solucion in SOLUCIONES)) errores.push("solucion");
  if (s.mensaje.length < 5) errores.push("mensaje");
  if (s.fuente && !(s.fuente in FUENTES)) errores.push("fuente");
  if (!s.acepta_datos) errores.push("acepta_datos");
  if (errores.length) return json({ ok: false, error: "Revisa los campos marcados", campos: errores }, 422, origin);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ip_hash = ip ? await sha256(ip + "|" + (Deno.env.get("SUPABASE_URL") ?? "")) : null;

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Límite de envíos: 5 por hora desde la misma conexión, 2 cada 10 minutos por correo.
  const haceUnaHora = new Date(Date.now() - 3600_000).toISOString();
  const haceDiez = new Date(Date.now() - 600_000).toISOString();
  if (ip_hash) {
    const { count } = await db.from("pascalia_solicitudes").select("id", { count: "exact", head: true })
      .eq("ip_hash", ip_hash).gte("created_at", haceUnaHora);
    if ((count ?? 0) >= 5) return json({ ok: false, error: "Recibimos varias solicitudes seguidas. Intenta de nuevo en una hora o escríbenos a contacto@pascalia.lat." }, 429, origin);
  }
  const { count: porCorreo } = await db.from("pascalia_solicitudes").select("id", { count: "exact", head: true })
    .eq("correo", s.correo).gte("created_at", haceDiez);
  if ((porCorreo ?? 0) >= 2) return json({ ok: false, error: "Ya recibimos tu solicitud. Te responderemos pronto." }, 429, origin);

  const { data: fila, error } = await db.from("pascalia_solicitudes")
    .insert({ ...s, ip_hash, user_agent: texto(req.headers.get("user-agent"), 300) || null })
    .select("id, radicado").single();
  if (error || !fila) {
    console.error("insert", error);
    return json({ ok: false, error: "No pudimos guardar tu solicitud. Intenta de nuevo o escríbenos a contacto@pascalia.lat." }, 500, origin);
  }

  const key = Deno.env.get("RESEND_API_KEY");
  let confirmacion = false;
  if (key) {
    const desde = Deno.env.get("PASCALIA_FROM") ?? "PascalIA <contacto@pascalia.lat>";
    const aviso = Deno.env.get("PASCALIA_AVISO") ?? "contacto@pascalia.lat";
    const solucion = SOLUCIONES[s.solucion];
    const filas = [
      ["Radicado", fila.radicado], ["Nombre", s.nombre], ["Correo", s.correo], ["WhatsApp", s.whatsapp ?? "—"],
      ["Solución", solucion], ["Tamaño", s.tamano ?? "—"], ["Cómo nos conoció", s.fuente ? FUENTES[s.fuente] : "—"],
      ["Página", s.pagina_origen ?? "—"],
    ].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5A5754">${esc(k)}</td><td style="padding:4px 0"><b>${esc(String(v))}</b></td></tr>`).join("");
    const okAviso = await enviarCorreo(key, {
      from: desde, to: [aviso], reply_to: s.correo,
      subject: `Nueva solicitud ${fila.radicado} · ${solucion} · ${s.nombre}`,
      html: `<div style="font-family:Arial,sans-serif;color:#1F1F1F"><h2 style="margin:0 0 12px">Nueva solicitud desde pascalia.lat</h2><table>${filas}</table><p style="margin:16px 0 6px;color:#5A5754">Mensaje</p><p style="white-space:pre-wrap;margin:0">${esc(s.mensaje)}</p><p style="margin-top:20px"><a href="https://pascalia.lat/panel/">Abrir el tablero de solicitudes</a></p></div>`,
    });
    const okRespuesta = await enviarCorreo(key, {
      from: desde, to: [s.correo], reply_to: aviso,
      subject: `Recibimos tu solicitud ${fila.radicado} · PascalIA`,
      html: `<div style="font-family:Arial,sans-serif;color:#1F1F1F;max-width:560px"><p>Hola, ${esc(s.nombre.split(" ")[0])}:</p><p>Gracias por escribirnos. Recibimos tu solicitud sobre <b>${esc(solucion)}</b> con el radicado <b>${esc(fila.radicado)}</b>. Te responderemos pronto, normalmente en el siguiente día hábil.</p><p>Si quieres agregar algo, responde a este correo.</p><p style="margin-top:24px">— Equipo PascalIA<br><span style="color:#5A5754">Ideas que hacen florecer tu organización · <a href="https://pascalia.lat">pascalia.lat</a></span></p></div>`,
    });
    confirmacion = okRespuesta;
    await db.from("pascalia_solicitudes")
      .update({ correo_aviso_enviado: okAviso, correo_respuesta_enviado: okRespuesta })
      .eq("id", fila.id);
  }

  return json({ ok: true, radicado: fila.radicado, correo: confirmacion }, 200, origin);
});
