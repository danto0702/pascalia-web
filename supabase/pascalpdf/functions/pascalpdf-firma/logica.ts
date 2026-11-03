// Lógica de las solicitudes de firma de PascalPDF, independiente del entorno.
// El documento llega y sale cifrado desde el navegador (la clave nunca llega aquí):
// esta función solo guarda metadatos, verifica correos con código y entrega URLs firmadas de Storage.

export type Solicitud = {
  id: string;
  creada_en: string;
  vence_en: string;
  estado: "pendiente" | "firmada" | "vencida" | "cancelada";
  remitente_nombre: string;
  remitente_correo: string;
  firmante_nombre: string;
  firmante_correo: string;
  mensaje: string | null;
  documento_nombre: string;
  documento_tipo: string;
  documento_hash: string;
  campos: unknown;
  token_remitente_hash: string;
  otp_hash: string | null;
  otp_vence: string | null;
  otp_intentos: number;
  otp_enviados: number;
  verificado_en: string | null;
  sesion_hash: string | null;
  sesion_vence: string | null;
  firmado_en: string | null;
  firma_id: string | null;
  firmado_hash: string | null;
  aceptacion_version: string | null;
  archivos_borrados: boolean;
  usuario_id?: string | null;
};

export type Codigo = { correo: string; codigo_hash: string; vence_en: string; intentos: number; creado_en: string };

export type Deps = {
  now: () => Date;
  secreto: string;
  sitio: string; // https://pascalia.lat
  db: {
    insertSolicitud(s: Partial<Solicitud>): Promise<Solicitud>;
    getSolicitud(id: string): Promise<Solicitud | null>;
    updateSolicitud(id: string, cambios: Partial<Solicitud>): Promise<void>;
    contarSolicitudesDesde(correo: string, desde: Date): Promise<number>;
    insertCodigo(c: Codigo): Promise<void>;
    ultimoCodigo(correo: string): Promise<Codigo | null>;
    contarCodigosDesde(correo: string, desde: Date): Promise<number>;
    actualizarCodigo(correo: string, creado_en: string, cambios: Partial<Codigo>): Promise<void>;
    vencidasConArchivos(limite: number): Promise<Solicitud[]>;
  };
  storage: {
    urlSubida(ruta: string): Promise<string>;
    urlDescarga(ruta: string, segundos: number): Promise<string>;
    existe(ruta: string): Promise<boolean>;
    borrar(rutas: string[]): Promise<void>;
  };
  correo(para: string, asunto: string, html: string): Promise<boolean>;
  // Cuenta de quien pide la firma: valida su plan, descuenta el cupo y devuelve su id y correo
  cuenta?: (token: unknown) => Promise<{ id: string; correo: string }>;
  // Cuenta de quien firma (cualquier plan): firmar a pedido de otra persona también exige iniciar sesión
  usuario?: (token: unknown) => Promise<{ id: string; correo: string } | null>;
};

async function exigirCuentaFirmante(deps: Deps, token: unknown) {
  if (!deps.usuario) return;
  if (!(await deps.usuario(token))) throw new ErrorCliente("Inicia sesión o crea tu cuenta para firmar.", 401);
}

const DIAS_VIGENCIA = 7;
const MAX_SOLICITUDES_DIA = 20;
const MAX_CODIGOS_HORA = 5;
const MAX_INTENTOS = 5;
const MAX_ENVIOS_FIRMANTE = 5;
const MINUTOS_CODIGO = 10;
const TIPOS = ["Contrato", "Cuenta de cobro", "Informe", "Acta", "Autorización", "Certificado", "Otro"];

export class ErrorCliente extends Error {
  status: number;
  constructor(mensaje: string, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const correoValido = (c: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(c);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const uuidValido = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const hexValido = (v: unknown) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function aleatorio(bytes = 24) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function codigoSeisDigitos() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

function enmascarar(correo: string) {
  const [u, d] = correo.split("@");
  return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "*".repeat(Math.min(6, u.length - 2))) + "@" + d;
}

function plantilla(titulo: string, cuerpo: string) {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#1F1F1F">
  <div style="height:4px;background:#FFC107;border-radius:4px"></div>
  <h2 style="font-size:18px;margin:20px 0 8px">${titulo}</h2>${cuerpo}
  <p style="color:#5C5C5C;font-size:12px;margin-top:28px">PascalPDF de PascalIA · pascalia.lat<br>Si no esperabas este correo, ignóralo.</p></div>`;
}

const fueraDeVigencia = (s: Solicitud, ahora: Date) => s.estado === "pendiente" && new Date(s.vence_en) < ahora;

async function cargar(deps: Deps, id: unknown) {
  if (!uuidValido(id)) throw new ErrorCliente("Solicitud no válida.", 404);
  const s = await deps.db.getSolicitud(id as string);
  if (!s) throw new ErrorCliente("La solicitud no existe o ya fue eliminada.", 404);
  if (fueraDeVigencia(s, deps.now())) {
    await deps.db.updateSolicitud(s.id, { estado: "vencida" });
    s.estado = "vencida";
  }
  return s;
}

async function comprobarRemitente(deps: Deps, s: Solicitud, token: unknown) {
  if (typeof token !== "string" || (await sha256(deps.secreto + "|r|" + token)) !== s.token_remitente_hash) {
    throw new ErrorCliente("Enlace de seguimiento no válido.", 403);
  }
}

// Borra los archivos cifrados de solicitudes vencidas, canceladas o firmadas hace más de 7 días
async function limpiar(deps: Deps) {
  try {
    const viejas = await deps.db.vencidasConArchivos(20);
    for (const s of viejas) {
      await deps.storage.borrar([`${s.id}/original.bin`, `${s.id}/firmado.bin`]);
      await deps.db.updateSolicitud(s.id, { archivos_borrados: true, estado: s.estado === "pendiente" ? "vencida" : s.estado });
    }
  } catch (e) {
    console.error("limpieza", e);
  }
}

export async function manejar(d: Record<string, unknown>, deps: Deps): Promise<Record<string, unknown>> {
  const ahora = deps.now();
  const accion = d.accion;

  // 1. El remitente pide un código para confirmar su correo
  if (accion === "codigo_remitente") {
    const correo = texto(d.correo, 254).toLowerCase();
    if (!correoValido(correo)) throw new ErrorCliente("Revisa tu correo.");
    if ((await deps.db.contarCodigosDesde(correo, new Date(ahora.getTime() - 3600_000))) >= MAX_CODIGOS_HORA) {
      throw new ErrorCliente("Pediste demasiados códigos. Intenta en una hora.", 429);
    }
    const codigo = codigoSeisDigitos();
    await deps.db.insertCodigo({
      correo, codigo_hash: await sha256(deps.secreto + "|c|" + correo + "|" + codigo),
      vence_en: new Date(ahora.getTime() + MINUTOS_CODIGO * 60_000).toISOString(), intentos: 0, creado_en: ahora.toISOString(),
    });
    const ok = await deps.correo(correo, `${codigo} es tu código de PascalPDF`, plantilla("Tu código para pedir una firma",
      `<p>Escribe este código en PascalPDF para confirmar tu correo:</p><p style="font-size:28px;font-weight:800;letter-spacing:6px">${codigo}</p><p>Vence en ${MINUTOS_CODIGO} minutos.</p>`));
    if (!ok) throw new ErrorCliente("No pudimos enviar el correo. Intenta de nuevo.", 502);
    return { ok: true };
  }

  // 2. El remitente crea la solicitud (con su código) y recibe la URL para subir el documento cifrado
  if (accion === "crear") {
    // Con cuentas activas, pedir firmas exige iniciar sesión (y cupo del plan); sin ellas, código al correo
    let correo: string, usuario_id: string | null = null, c: Codigo | null = null;
    if (deps.cuenta) {
      if (!d.token) throw new ErrorCliente("Inicia sesión para pedir firmas.", 401);
      const u = await deps.cuenta(d.token);
      correo = u.correo;
      usuario_id = u.id;
    } else {
      correo = texto(d.correo, 254).toLowerCase();
      c = await deps.db.ultimoCodigo(correo);
      if (!c || new Date(c.vence_en) < ahora || c.intentos >= MAX_INTENTOS) throw new ErrorCliente("El código venció. Pide uno nuevo.", 403);
      if ((await sha256(deps.secreto + "|c|" + correo + "|" + texto(d.codigo, 12))) !== c.codigo_hash) {
        await deps.db.actualizarCodigo(correo, c.creado_en, { intentos: c.intentos + 1 });
        throw new ErrorCliente("El código no es correcto.", 403);
      }
    }
    if ((await deps.db.contarSolicitudesDesde(correo, new Date(ahora.getTime() - 86_400_000))) >= MAX_SOLICITUDES_DIA) {
      throw new ErrorCliente("Llegaste al límite de solicitudes por hoy.", 429);
    }
    const remitente_nombre = texto(d.remitente_nombre, 120);
    const firmante_nombre = texto(d.firmante_nombre, 120);
    const firmante_correo = texto(d.firmante_correo, 254).toLowerCase();
    const documento_nombre = texto(d.documento_nombre, 160);
    const documento_tipo = TIPOS.includes(texto(d.documento_tipo, 40)) ? texto(d.documento_tipo, 40) : "Otro";
    if (!remitente_nombre || !firmante_nombre || !documento_nombre) throw new ErrorCliente("Faltan datos.");
    if (!correoValido(firmante_correo)) throw new ErrorCliente("Revisa el correo de quien firma.");
    if (!hexValido(d.documento_hash)) throw new ErrorCliente("Documento no válido.");
    const campos = Array.isArray(d.campos) ? d.campos.slice(0, 20).map((f) => {
      const o = f as Record<string, unknown>;
      const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Number(v) || 0));
      return { pagina: Math.floor(n(o.pagina, 999)), x: n(o.x, 1), y: n(o.y, 1), w: n(o.w, 1), h: n(o.h, 1) };
    }) : [];
    if (!campos.length) throw new ErrorCliente("Marca dónde debe firmar la otra persona.");

    const token = aleatorio();
    const s = await deps.db.insertSolicitud({
      vence_en: new Date(ahora.getTime() + DIAS_VIGENCIA * 86_400_000).toISOString(),
      remitente_nombre, remitente_correo: correo, firmante_nombre, firmante_correo,
      mensaje: texto(d.mensaje, 500) || null, documento_nombre, documento_tipo,
      documento_hash: d.documento_hash as string, campos,
      token_remitente_hash: await sha256(deps.secreto + "|r|" + token),
      ...(usuario_id ? { usuario_id } : {}),
    });
    if (c) await deps.db.actualizarCodigo(correo, c.creado_en, { intentos: MAX_INTENTOS }); // el código no se reutiliza
    await limpiar(deps);
    return { ok: true, id: s.id, token_remitente: token, vence_en: s.vence_en, subida: await deps.storage.urlSubida(`${s.id}/original.bin`) };
  }

  // 3. Datos públicos para la página del firmante (sin el correo completo)
  if (accion === "info") {
    const s = await cargar(deps, d.id);
    return {
      ok: true, estado: s.estado, vence_en: s.vence_en, remitente_nombre: s.remitente_nombre,
      firmante_nombre: s.firmante_nombre, firmante_correo: enmascarar(s.firmante_correo),
      mensaje: s.mensaje, documento_nombre: s.documento_nombre, documento_tipo: s.documento_tipo, campos: s.campos,
    };
  }

  // 4. El firmante pide su código
  if (accion === "codigo_firmante") {
    await exigirCuentaFirmante(deps, d.token);
    const s = await cargar(deps, d.id);
    if (s.estado !== "pendiente") throw new ErrorCliente("Esta solicitud ya no está disponible.", 409);
    if (s.otp_enviados >= MAX_ENVIOS_FIRMANTE) throw new ErrorCliente("Se enviaron demasiados códigos para esta solicitud.", 429);
    const codigo = codigoSeisDigitos();
    await deps.db.updateSolicitud(s.id, {
      otp_hash: await sha256(deps.secreto + "|f|" + s.id + "|" + codigo),
      otp_vence: new Date(ahora.getTime() + MINUTOS_CODIGO * 60_000).toISOString(),
      otp_intentos: 0, otp_enviados: s.otp_enviados + 1,
    });
    const ok = await deps.correo(s.firmante_correo, `${codigo} es tu código para firmar en PascalPDF`, plantilla(`${esc(s.remitente_nombre)} te pidió una firma`,
      `<p>Documento: <b>${esc(s.documento_nombre)}</b></p><p>Escribe este código en la página de firma:</p><p style="font-size:28px;font-weight:800;letter-spacing:6px">${codigo}</p><p>Vence en ${MINUTOS_CODIGO} minutos.</p>`));
    if (!ok) throw new ErrorCliente("No pudimos enviar el correo. Intenta de nuevo.", 502);
    return { ok: true, firmante_correo: enmascarar(s.firmante_correo) };
  }

  // 5. El firmante confirma el código: recibe el documento cifrado y una sesión para completar
  if (accion === "verificar_firmante") {
    await exigirCuentaFirmante(deps, d.token);
    const s = await cargar(deps, d.id);
    if (s.estado !== "pendiente") throw new ErrorCliente("Esta solicitud ya no está disponible.", 409);
    if (!s.otp_hash || !s.otp_vence || new Date(s.otp_vence) < ahora || s.otp_intentos >= MAX_INTENTOS) {
      throw new ErrorCliente("El código venció. Pide uno nuevo.", 403);
    }
    if ((await sha256(deps.secreto + "|f|" + s.id + "|" + texto(d.codigo, 12))) !== s.otp_hash) {
      await deps.db.updateSolicitud(s.id, { otp_intentos: s.otp_intentos + 1 });
      throw new ErrorCliente("El código no es correcto.", 403);
    }
    const sesion = aleatorio();
    const verificado_en = ahora.toISOString();
    await deps.db.updateSolicitud(s.id, {
      otp_hash: null, verificado_en,
      sesion_hash: await sha256(deps.secreto + "|s|" + sesion),
      sesion_vence: new Date(ahora.getTime() + 3600_000).toISOString(),
    });
    return {
      ok: true, sesion, verificado_en, firmante_correo: s.firmante_correo, documento_hash: s.documento_hash,
      descarga: await deps.storage.urlDescarga(`${s.id}/original.bin`, 600),
    };
  }

  // 6. El firmante sube el documento firmado (cifrado)
  if (accion === "completar" || accion === "confirmar") {
    await exigirCuentaFirmante(deps, d.token);
    const s = await cargar(deps, d.id);
    if (s.estado !== "pendiente") throw new ErrorCliente("Esta solicitud ya no está disponible.", 409);
    if (!s.sesion_hash || !s.sesion_vence || new Date(s.sesion_vence) < ahora
      || (await sha256(deps.secreto + "|s|" + texto(d.sesion, 80))) !== s.sesion_hash) {
      throw new ErrorCliente("La sesión de firma venció. Vuelve a confirmar tu correo.", 403);
    }
    if (accion === "completar") {
      if (!hexValido(d.firmado_hash) || !uuidValido(d.firma_id)) throw new ErrorCliente("Datos de firma no válidos.");
      await deps.db.updateSolicitud(s.id, {
        firmado_hash: d.firmado_hash as string, firma_id: d.firma_id as string,
        aceptacion_version: texto(d.aceptacion_version, 40) || null,
      });
      return { ok: true, subida: await deps.storage.urlSubida(`${s.id}/firmado.bin`) };
    }
    if (!(await deps.storage.existe(`${s.id}/firmado.bin`))) throw new ErrorCliente("No llegó el documento firmado.", 409);
    const firmado_en = ahora.toISOString();
    await deps.db.updateSolicitud(s.id, { estado: "firmada", firmado_en, sesion_hash: null });
    await deps.storage.borrar([`${s.id}/original.bin`]);
    await deps.correo(s.remitente_correo, `${s.firmante_nombre} firmó ${s.documento_nombre}`, plantilla("Ya firmaron tu documento",
      `<p><b>${esc(s.firmante_nombre)}</b> firmó <b>${esc(s.documento_nombre)}</b>.</p><p>Ábrelo desde el enlace de seguimiento que guardaste al crear la solicitud (en PascalPDF: Firmas → Mis solicitudes). Por seguridad, ese enlace no viaja por correo.</p><p>El documento firmado se borra de nuestro servidor el ${new Date(s.vence_en).toLocaleDateString("es-CO")}.</p>`));
    return { ok: true, firmado_en };
  }

  // 7. Seguimiento del remitente
  if (accion === "estado" || accion === "cancelar") {
    const s = await cargar(deps, d.id);
    await comprobarRemitente(deps, s, d.token_remitente);
    if (accion === "cancelar") {
      if (s.estado === "pendiente") await deps.db.updateSolicitud(s.id, { estado: "cancelada" });
      await deps.storage.borrar([`${s.id}/original.bin`, `${s.id}/firmado.bin`]);
      await deps.db.updateSolicitud(s.id, { archivos_borrados: true });
      return { ok: true };
    }
    return {
      ok: true, estado: s.estado, vence_en: s.vence_en, creada_en: s.creada_en, firmante_nombre: s.firmante_nombre,
      firmante_correo: s.firmante_correo, documento_nombre: s.documento_nombre, verificado_en: s.verificado_en,
      firmado_en: s.firmado_en, firma_id: s.firma_id, firmado_hash: s.firmado_hash,
      descarga: s.estado === "firmada" && !s.archivos_borrados ? await deps.storage.urlDescarga(`${s.id}/firmado.bin`, 600) : null,
    };
  }

  throw new ErrorCliente("Acción no válida.");
}
