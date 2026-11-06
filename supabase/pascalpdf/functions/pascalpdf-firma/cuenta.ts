// Cuentas de PascalPDF y Pascal Sign: entrada con código al correo, planes, prueba de 7 días,
// historial de firmas, cupo de solicitudes de firma y pagos con Wompi (con códigos promocionales).
// Independiente del entorno: index.ts conecta Postgres/Wompi/Resend; las pruebas usan Postgres local.
import { ErrorCliente } from "./logica.ts";

export type Usuario = {
  id: string; correo: string; nombre: string | null; creado_en: string;
  plan: "prueba" | "pro" | "suite"; vence_en: string; solicitudes_extra: number;
  clave_hash?: string | null; clave_fallos?: number; clave_bloqueo?: string | null; google_sub?: string | null;
};
export type DatosGoogle = { sub: string; email: string; email_verified: boolean; name?: string };
export type Promo = {
  codigo: string; tipo: "porcentaje" | "valor" | "dias"; valor: number; productos: string[];
  vence_en: string | null; max_usos: number | null; usos: number; activo: boolean; plan?: "pro" | "suite" | null;
};
export type Evento = {
  app: string; documento_tipo: string; documento_nombre: string; documento_hash: string | null;
  objeto: string | null; radicado: string | null; firmante: string | null;
  firma_id: string; metodo: string | null; paginas: number | null;
  anio?: number; numero?: number; consecutivo?: string;
  delegacion_id?: string | null; delegado_id?: string | null; delegado_nombre?: string | null;
};
export type Delegacion = {
  id: string; titular_id: string; delegado_correo: string; firma_id: string; firma_nombre: string; firma_cifrada: string;
  objetos: string[]; desde: string; hasta: string; estado: "activa" | "suspendida" | "revocada"; usos: number;
  creada_en: string; actualizada_en: string;
};
export type TransaccionWompi = { id: string; reference: string; status: string; amount_in_cents: number; currency: string };

export type DepsCuenta = {
  now: () => Date;
  secreto: string;
  sitio: string;
  wompi: { publica: string; integridad: string } | null;
  correo(para: string, asunto: string, html: string): Promise<boolean>;
  consultarTransaccion(id: string): Promise<TransaccionWompi | null>;
  google: { clienteId: string; verificar(credencial: string): Promise<DatosGoogle | null> } | null;
  admins: string[]; // correos con acceso a la página de administración
  db: {
    usuarioPorId(id: string): Promise<Usuario | null>;
    crearDelegacion(d: Omit<Delegacion, "id" | "usos" | "creada_en" | "actualizada_en" | "estado">): Promise<Delegacion>;
    delegacion(id: string): Promise<Delegacion | null>;
    delegacionesDe(titular_id: string): Promise<Delegacion[]>;
    delegacionesPara(correo: string): Promise<(Delegacion & { titular_correo: string; titular_nombre: string | null })[]>;
    actualizarDelegacion(id: string, cambios: Partial<Delegacion>): Promise<void>;
    adminResumen(): Promise<Record<string, unknown>>;
    adminPromos(): Promise<Promo[]>;
    adminGuardarPromo(p: Promo & { nota: string | null }): Promise<void>;
    // Canje atómico de un código de días gratis; lanza un error con mensaje codigo_invalido, codigo_vencido o ya_usado
    canjearDias(codigo: string, usuario_id: string): Promise<{ plan: string; vence_en: string; dias: number }>;
    adminUsuarios(buscar: string): Promise<Usuario[]>;
    adminPagos(): Promise<Record<string, unknown>[]>;
    insertCodigo(c: { correo: string; codigo_hash: string; vence_en: string; intentos: number; creado_en: string }): Promise<void>;
    ultimoCodigo(correo: string): Promise<{ correo: string; codigo_hash: string; vence_en: string; intentos: number; creado_en: string } | null>;
    contarCodigosDesde(correo: string, desde: Date): Promise<number>;
    actualizarCodigo(correo: string, creado_en: string, cambios: { intentos: number }): Promise<void>;
    usuarioPorCorreo(correo: string): Promise<Usuario | null>;
    crearUsuario(u: { correo: string; nombre: string | null; plan: string; vence_en: string; clave_hash?: string; google_sub?: string }): Promise<Usuario>;
    actualizarUsuario(id: string, cambios: Partial<Usuario>): Promise<void>;
    borrarUsuario(id: string): Promise<void>;
    crearSesion(s: { token_hash: string; usuario_id: string; vence_en: string }): Promise<void>;
    usuarioPorSesion(token_hash: string, ahora: Date): Promise<Usuario | null>;
    borrarSesion(token_hash: string): Promise<void>;
    insertarEventos(usuario_id: string, eventos: Evento[]): Promise<{ id: string; firmado_en: string; consecutivo: string | null }[]>;
    ultimoNumero(usuario_id: string, anio: number): Promise<number>;
    eventos(usuario_id: string, limite: number): Promise<(Evento & { id: string; firmado_en: string })[]>;
    contarEventosDesde(usuario_id: string, desde: Date): Promise<number>;
    contarSolicitudesDesde(usuario_id: string, desde: Date): Promise<number>;
    promo(codigo: string): Promise<Promo | null>;
    promoUsada(codigo: string, usuario_id: string): Promise<boolean>;
    crearPago(p: { referencia: string; usuario_id: string; correo: string; producto: string; precio: number; descuento: number; monto: number; codigo: string | null }): Promise<void>;
    pago(referencia: string): Promise<{ referencia: string; usuario_id: string; monto: number; estado: string } | null>;
    marcarPago(referencia: string, estado: string, wompi_id: string): Promise<void>;
    aplicarPago(referencia: string, wompi_id: string | null): Promise<boolean>;
    pagos(usuario_id: string): Promise<{ referencia: string; producto: string; monto: number; estado: string; creado_en: string; aprobado_en: string | null }[]>;
  };
};

// Precios en pesos colombianos (PascalIA no es responsable de IVA)
export const PRODUCTOS: Record<string, { nombre: string; precio: number }> = {
  pro_mes: { nombre: "Pascal Sign Pro · 1 mes", precio: 9900 },
  pro_anual: { nombre: "Pascal Sign Pro · 1 año", precio: 99000 },
  suite_mes: { nombre: "PascalPDF Suite · 1 mes", precio: 24900 },
  suite_anual: { nombre: "PascalPDF Suite · 1 año", precio: 249000 },
  paquete10: { nombre: "10 solicitudes de firma adicionales", precio: 9900 },
};
export const CUPO_SOLICITUDES: Record<string, number> = { prueba: 3, pro: 15, suite: 50 };
export const DIAS_PRUEBA = 7;
const DIAS_SESION = 180;
const MINUTOS_CODIGO = 10;

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const correoValido = (c: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(c);
const escHtml = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const uuidValido = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function aleatorio(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function codigoSeisDigitos() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
}
// ---------------------------------------------------------------- contraseñas (PBKDF2-SHA256)
const ITERACIONES = 120_000;
const b64 = (a: Uint8Array) => btoa(String.fromCharCode(...a));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function derivar(clave: string, sal: Uint8Array, iter: number) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iter }, k, 256));
}
export async function hashClave(clave: string) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERACIONES}$${b64(sal)}$${b64(await derivar(clave, sal, ITERACIONES))}`;
}
export async function claveCorrecta(clave: string, guardada: string) {
  const [alg, iter, sal, h] = guardada.split("$");
  if (alg !== "pbkdf2") return false;
  const a = await derivar(clave, deB64(sal), Number(iter)), b = deB64(h);
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}
function validarClave(v: unknown) {
  const c = typeof v === "string" ? v : "";
  if (c.length < 8 || c.length > 128) throw new ErrorCliente("La contraseña debe tener entre 8 y 128 caracteres.");
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(c) || !/\d/.test(c)) throw new ErrorCliente("La contraseña debe tener letras y números.");
  return c;
}

// Iniciales: primer nombre, primer apellido y segundo apellido (DANILO TORRADO BLANCO → DTB).
// Con cuatro o más palabras se toman la primera y las dos últimas. Igual que sello.js.
export function iniciales(nombre: string | null) {
  const p = String(nombre || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .split(/[^A-ZÑ]+/).filter((w) => w && !["DE", "DEL", "LA", "LAS", "LOS", "Y"].includes(w));
  const sel = p.length >= 4 ? [p[0], p[p.length - 2], p[p.length - 1]] : p;
  return sel.map((w) => w[0]).join("") || "X";
}
export function consecutivo(nombre: string | null, numero: number, anio: number) {
  return `${iniciales(nombre)}-${String(numero).padStart(4, "0")}-${anio}`;
}

// Inicio del mes calendario en Colombia (UTC-5, sin horario de verano)
export function inicioMes(ahora: Date) {
  const col = new Date(ahora.getTime() - 5 * 3600_000);
  return new Date(Date.UTC(col.getUTCFullYear(), col.getUTCMonth(), 1, 5));
}
export const planActivo = (u: Usuario, ahora: Date) => new Date(u.vence_en) > ahora;

export async function usuarioDeToken(deps: DepsCuenta, token: unknown) {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  return deps.db.usuarioPorSesion(await sha256(deps.secreto + "|t|" + token), deps.now());
}
async function requerirUsuario(deps: DepsCuenta, token: unknown) {
  const u = await usuarioDeToken(deps, token);
  if (!u) throw new ErrorCliente("Tu sesión venció. Vuelve a entrar.", 401);
  return u;
}

async function resumen(deps: DepsCuenta, u: Usuario) {
  const ahora = deps.now();
  const desde = inicioMes(ahora);
  const activo = planActivo(u, ahora);
  return {
    correo: u.correo, nombre: u.nombre, con_clave: !!u.clave_hash, con_google: !!u.google_sub, plan: u.plan, vence_en: u.vence_en, activo,
    nivel: activo ? (u.plan === "pro" ? 1 : 2) : 0, // la prueba da acceso a todo
    prueba: u.plan === "prueba",
    solicitudes: { usadas: await deps.db.contarSolicitudesDesde(u.id, desde), cupo: CUPO_SOLICITUDES[u.plan], extra: u.solicitudes_extra },
    firmas_mes: await deps.db.contarEventosDesde(u.id, desde),
    pagos_activos: !!deps.wompi,
    admin: deps.admins.includes(u.correo.toLowerCase()),
    productos: PRODUCTOS,
  };
}

// Usado por la creación de solicitudes de firma: comprueba el plan y descuenta el cupo
export async function consumirSolicitud(deps: DepsCuenta, token: unknown) {
  const u = await requerirUsuario(deps, token);
  if (!planActivo(u, deps.now())) throw new ErrorCliente("Tu plan venció. Renuévalo para pedir firmas.", 402);
  const usadas = await deps.db.contarSolicitudesDesde(u.id, inicioMes(deps.now()));
  if (usadas >= CUPO_SOLICITUDES[u.plan]) {
    if (u.solicitudes_extra <= 0) throw new ErrorCliente("Usaste las solicitudes de firma de este mes. Compra un paquete de 10 adicionales o cambia de plan.", 402);
    await deps.db.actualizarUsuario(u.id, { solicitudes_extra: u.solicitudes_extra - 1 });
  }
  return u;
}

async function calcularPrecio(deps: DepsCuenta, u: Usuario, producto: string, codigoTxt: unknown) {
  const p = PRODUCTOS[producto];
  if (!p) throw new ErrorCliente("Producto no válido.");
  const codigo = texto(codigoTxt, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (!codigo) return { precio: p.precio, descuento: 0, monto: p.precio, codigo: null as string | null };
  const promo = await deps.db.promo(codigo);
  const ahora = deps.now();
  if (!promo || !promo.activo || (promo.vence_en && new Date(promo.vence_en) < ahora)
    || (promo.max_usos !== null && promo.usos >= promo.max_usos)) throw new ErrorCliente("El código no es válido o ya venció.");
  if (promo.tipo === "dias") throw new ErrorCliente("Ese código es de días gratis: no necesitas pagar. Canjéalo en «Mi cuenta → Tengo un código».");
  if (promo.productos.length && !promo.productos.includes(producto)) throw new ErrorCliente("El código no aplica para este plan.");
  if (await deps.db.promoUsada(codigo, u.id)) throw new ErrorCliente("Ya usaste este código.");
  const descuento = Math.min(p.precio, promo.tipo === "porcentaje" ? Math.round(p.precio * Math.min(100, promo.valor) / 100) : promo.valor);
  let monto = p.precio - descuento;
  // Wompi no procesa montos menores a $1.500: por debajo, el código lo deja gratis
  if (monto > 0 && monto < 1500) monto = 0;
  return { precio: p.precio, descuento: p.precio - monto, monto, codigo };
}

async function nuevaSesion(deps: DepsCuenta, u: Usuario, nuevo: boolean) {
  const token = aleatorio();
  await deps.db.crearSesion({
    token_hash: await sha256(deps.secreto + "|t|" + token), usuario_id: u.id,
    vence_en: new Date(deps.now().getTime() + DIAS_SESION * 86_400_000).toISOString(),
  });
  return { ok: true, token, nuevo, cuenta: await resumen(deps, u) };
}

// Comprueba el código de 6 dígitos enviado al correo y lo inutiliza
async function verificarCodigo(deps: DepsCuenta, correo: string, codigo: unknown) {
  const c = await deps.db.ultimoCodigo(correo);
  if (!c || new Date(c.vence_en) < deps.now() || c.intentos >= 5) throw new ErrorCliente("El código venció. Pide uno nuevo.", 403);
  if ((await sha256(deps.secreto + "|c|" + correo + "|" + texto(codigo, 12))) !== c.codigo_hash) {
    await deps.db.actualizarCodigo(correo, c.creado_en, { intentos: c.intentos + 1 });
    throw new ErrorCliente("El código no es correcto.", 403);
  }
  await deps.db.actualizarCodigo(correo, c.creado_en, { intentos: 5 });
}

// ---------------------------------------------------------------- cifrado de la firma delegada
async function llaveFirmas(deps: DepsCuenta) {
  const k = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(deps.secreto + "|delegacion"));
  return crypto.subtle.importKey("raw", k, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function cifrarFirma(deps: DepsCuenta, png: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await llaveFirmas(deps), new TextEncoder().encode(png)));
  return b64(iv) + "." + b64ct(ct);
}
async function descifrarFirma(deps: DepsCuenta, txt: string) {
  const [iv, ct] = txt.split(".");
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(iv) }, await llaveFirmas(deps), deB64(ct)));
}
// btoa con trozos (la firma puede pesar cientos de KB)
function b64ct(a: Uint8Array) {
  let s = "";
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
  return btoa(s);
}
const vigente = (d: Delegacion, ahora: Date) => d.estado === "activa" && new Date(d.desde) <= ahora && new Date(d.hasta) > ahora;
const normal = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
function publicaDelegacion(d: Delegacion, ahora: Date) {
  const { firma_cifrada: _f, ...resto } = d;
  return { ...resto, vigente: vigente(d, ahora) };
}
async function requerirAdmin(deps: DepsCuenta, token: unknown) {
  const u = await requerirUsuario(deps, token);
  if (!deps.admins.includes(u.correo.toLowerCase())) throw new ErrorCliente("No tienes acceso a la administración.", 403);
  return u;
}

const vencePrueba = (ahora: Date) => new Date(ahora.getTime() + DIAS_PRUEBA * 86_400_000).toISOString();

export async function manejarCuenta(d: Record<string, unknown>, deps: DepsCuenta): Promise<Record<string, unknown> | null> {
  const ahora = deps.now();
  switch (d.accion) {
    case "entrar_codigo": {
      const correo = texto(d.correo, 254).toLowerCase();
      if (!correoValido(correo)) throw new ErrorCliente("Revisa tu correo.");
      if ((await deps.db.contarCodigosDesde(correo, new Date(ahora.getTime() - 3600_000))) >= 5) {
        throw new ErrorCliente("Pediste demasiados códigos. Intenta en una hora.", 429);
      }
      const codigo = codigoSeisDigitos();
      await deps.db.insertCodigo({
        correo, codigo_hash: await sha256(deps.secreto + "|c|" + correo + "|" + codigo),
        vence_en: new Date(ahora.getTime() + MINUTOS_CODIGO * 60_000).toISOString(), intentos: 0, creado_en: ahora.toISOString(),
      });
      const ok = await deps.correo(correo, `${codigo} es tu código para entrar a PascalPDF`,
        `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#1F1F1F"><div style="height:4px;background:#FFC107;border-radius:4px"></div><h2 style="font-size:18px;margin:20px 0 8px">Tu código para entrar</h2><p>Escribe este código en PascalPDF o Pascal Sign:</p><p style="font-size:28px;font-weight:800;letter-spacing:6px">${codigo}</p><p>Vence en ${MINUTOS_CODIGO} minutos.</p><p style="color:#5C5C5C;font-size:12px;margin-top:28px">PascalIA · pascalia.lat<br>Si no pediste este código, ignora este correo.</p></div>`);
      if (!ok) throw new ErrorCliente("No pudimos enviar el correo. Intenta de nuevo.", 502);
      return { ok: true };
    }

    case "config": {
      return { ok: true, google_cliente: deps.google ? deps.google.clienteId : null };
    }

    // Entrar con un código al correo (también crea la cuenta si no existe)
    case "entrar": {
      const correo = texto(d.correo, 254).toLowerCase();
      await verificarCodigo(deps, correo, d.codigo);
      let u = await deps.db.usuarioPorCorreo(correo);
      const nuevo = !u;
      if (!u) u = await deps.db.crearUsuario({ correo, nombre: texto(d.nombre, 120) || null, plan: "prueba", vence_en: vencePrueba(ahora) });
      return nuevaSesion(deps, u, nuevo);
    }

    // Crear la cuenta con contraseña: el código confirma que el correo es tuyo
    case "crear_cuenta": {
      const correo = texto(d.correo, 254).toLowerCase();
      if (!correoValido(correo)) throw new ErrorCliente("Revisa tu correo.");
      const nombre = texto(d.nombre, 120);
      if (nombre.length < 3) throw new ErrorCliente("Escribe tu nombre completo.");
      const clave = validarClave(d.clave);
      await verificarCodigo(deps, correo, d.codigo);
      let u = await deps.db.usuarioPorCorreo(correo);
      if (u?.clave_hash) throw new ErrorCliente("Ya existe una cuenta con ese correo. Entra o recupera tu contraseña.", 409);
      const clave_hash = await hashClave(clave);
      const nuevo = !u;
      if (u) await deps.db.actualizarUsuario(u.id, { clave_hash, nombre: u.nombre || nombre });
      else u = await deps.db.crearUsuario({ correo, nombre, plan: "prueba", vence_en: vencePrueba(ahora), clave_hash });
      return nuevaSesion(deps, u, nuevo);
    }

    // Entrar con correo y contraseña (5 intentos fallidos bloquean 15 minutos)
    case "entrar_clave": {
      const correo = texto(d.correo, 254).toLowerCase();
      const clave = typeof d.clave === "string" ? d.clave.slice(0, 128) : "";
      const u = await deps.db.usuarioPorCorreo(correo);
      if (u?.clave_bloqueo && new Date(u.clave_bloqueo) > ahora) throw new ErrorCliente("Demasiados intentos. Espera 15 minutos o entra con un código al correo.", 429);
      if (!u || !u.clave_hash || !(await claveCorrecta(clave, u.clave_hash))) {
        if (u?.clave_hash) {
          const fallos = (u.clave_fallos ?? 0) + 1;
          await deps.db.actualizarUsuario(u.id, fallos >= 5
            ? { clave_fallos: 0, clave_bloqueo: new Date(ahora.getTime() + 15 * 60_000).toISOString() }
            : { clave_fallos: fallos });
        }
        throw new ErrorCliente(u && !u.clave_hash ? "Esta cuenta no tiene contraseña. Entra con Google o con un código al correo, o crea una con «Olvidé mi contraseña»." : "Correo o contraseña incorrectos.", 403);
      }
      if (u.clave_fallos) await deps.db.actualizarUsuario(u.id, { clave_fallos: 0, clave_bloqueo: null });
      return nuevaSesion(deps, u, false);
    }

    // Recuperar (o crear) la contraseña con el código al correo
    case "recuperar_clave": {
      const correo = texto(d.correo, 254).toLowerCase();
      const clave = validarClave(d.clave);
      await verificarCodigo(deps, correo, d.codigo);
      const u = await deps.db.usuarioPorCorreo(correo);
      if (!u) throw new ErrorCliente("No hay una cuenta con ese correo. Crea una.", 404);
      await deps.db.actualizarUsuario(u.id, { clave_hash: await hashClave(clave), clave_fallos: 0, clave_bloqueo: null });
      return nuevaSesion(deps, u, false);
    }

    // Entrar o crear la cuenta con Google (token de Google Identity Services)
    case "entrar_google": {
      if (!deps.google) throw new ErrorCliente("El acceso con Google todavía no está habilitado.", 503);
      const g = await deps.google.verificar(texto(d.credencial, 4000));
      if (!g || !g.email_verified) throw new ErrorCliente("Google no confirmó tu cuenta. Intenta de nuevo.", 403);
      const correo = g.email.toLowerCase();
      let u = await deps.db.usuarioPorCorreo(correo);
      const nuevo = !u;
      if (!u) u = await deps.db.crearUsuario({ correo, nombre: texto(g.name, 120) || null, plan: "prueba", vence_en: vencePrueba(ahora), google_sub: g.sub });
      else if (!u.google_sub) await deps.db.actualizarUsuario(u.id, { google_sub: g.sub });
      else if (u.google_sub !== g.sub) throw new ErrorCliente("Ese correo está vinculado a otra cuenta de Google.", 403);
      return nuevaSesion(deps, u, nuevo);
    }

    case "cuenta": {
      const u = await requerirUsuario(deps, d.token);
      return { ok: true, cuenta: await resumen(deps, u) };
    }

    case "salir": {
      if (typeof d.token === "string") await deps.db.borrarSesion(await sha256(deps.secreto + "|t|" + d.token));
      return { ok: true };
    }

    case "registrar_firmas": {
      const u = await requerirUsuario(deps, d.token);
      if (!planActivo(u, ahora)) throw new ErrorCliente("Tu plan venció. Renuévalo para seguir firmando.", 402);
      if (!Array.isArray(d.eventos) || !d.eventos.length || d.eventos.length > 50) throw new ErrorCliente("Datos de firma no válidos.");
      // Cada evento pertenece al titular de la firma: quien firma, o el titular si es una firma delegada
      const eventos: { e: Evento; duenio: string }[] = [];
      const delegaciones = new Map<string, Delegacion>();
      for (const raw of d.eventos) {
        const o = raw as Record<string, unknown>;
        if (!uuidValido(o.firma_id)) throw new ErrorCliente("Identificador de firma no válido.");
        const hash = typeof o.documento_hash === "string" && /^[0-9a-f]{64}$/.test(o.documento_hash) ? o.documento_hash : null;
        const metodo = ["dibujada", "escrita", "imagen"].includes(o.metodo as string) ? o.metodo as string : null;
        const paginas = Number.isInteger(o.paginas) && (o.paginas as number) > 0 ? Math.min(10000, o.paginas as number) : null;
        const e: Evento = {
          app: o.app === "pascalsign" ? "pascalsign" : "pascalpdf",
          documento_tipo: texto(o.documento_tipo, 40) || "Otro",
          documento_nombre: texto(o.documento_nombre, 160) || "Documento.pdf",
          documento_hash: hash, firma_id: o.firma_id as string, metodo, paginas,
          objeto: texto(o.objeto, 120) || null, radicado: texto(o.radicado, 60) || null, firmante: texto(o.firmante, 120) || null,
        };
        let duenio = u.id;
        if (o.delegacion_id) {
          if (!uuidValido(o.delegacion_id)) throw new ErrorCliente("Delegación no válida.");
          let del = delegaciones.get(o.delegacion_id as string);
          if (!del) {
            const x = await deps.db.delegacion(o.delegacion_id as string);
            if (!x || x.delegado_correo !== u.correo) throw new ErrorCliente("Esa firma no te fue delegada.", 403);
            if (!vigente(x, ahora)) throw new ErrorCliente("La delegación de esa firma no está vigente (suspendida, revocada o fuera de las fechas).", 403);
            const titular = await deps.db.usuarioPorId(x.titular_id);
            if (!titular || !planActivo(titular, ahora)) throw new ErrorCliente("El plan del titular de la firma no está activo.", 402);
            del = x;
            delegaciones.set(x.id, x);
          }
          if (del.objetos.length && !del.objetos.some((ob) => normal(ob) === normal(e.objeto || ""))) {
            throw new ErrorCliente(`Esta delegación solo permite firmar: ${del.objetos.join(", ")}.`, 403);
          }
          e.firmante = del.firma_nombre;
          e.firma_id = del.firma_id;
          e.metodo = "imagen";
          e.delegacion_id = del.id;
          e.delegado_id = u.id;
          e.delegado_nombre = texto(`${u.nombre || u.correo} (${u.correo})`, 160);
          duenio = del.titular_id;
        }
        eventos.push({ e, duenio });
      }
      // Consecutivo por titular y año (hora de Colombia): iniciales-número-año, p. ej. DTB-0001-2026
      const anio = new Date(ahora.getTime() - 5 * 3600_000).getUTCFullYear();
      const registros: unknown[] = new Array(eventos.length);
      for (const duenio of new Set(eventos.map((x) => x.duenio))) {
        const idx = eventos.map((x, i) => (x.duenio === duenio ? i : -1)).filter((i) => i >= 0);
        for (let intento = 0; ; intento++) {
          let n = await deps.db.ultimoNumero(duenio, anio);
          for (const i of idx) { const e = eventos[i].e; n++; e.anio = anio; e.numero = n; e.consecutivo = consecutivo(e.firmante, n, anio); }
          try {
            const r = await deps.db.insertarEventos(duenio, idx.map((i) => eventos[i].e));
            r.forEach((x, j) => (registros[idx[j]] = x));
            break;
          } catch (err) {
            // Dos guardados al mismo tiempo pueden tomar el mismo número: se reintenta
            if ((err as { code?: string }).code !== "23505" || intento >= 4) throw err;
          }
        }
      }
      for (const del of delegaciones.values()) {
        await deps.db.actualizarDelegacion(del.id, { usos: del.usos + eventos.filter((x) => x.e.delegacion_id === del.id).length });
      }
      return { ok: true, registros };
    }

    // ------------------------------------------------------------ delegación de firma
    case "delegar_crear": {
      const u = await requerirUsuario(deps, d.token);
      if (!planActivo(u, ahora)) throw new ErrorCliente("Tu plan venció. Renuévalo para delegar tu firma.", 402);
      const delegado_correo = texto(d.delegado_correo, 254).toLowerCase();
      if (!correoValido(delegado_correo)) throw new ErrorCliente("Revisa el correo de la persona a quien delegas.");
      if (delegado_correo === u.correo) throw new ErrorCliente("No puedes delegarte la firma a ti mismo.");
      const f = (d.firma || {}) as Record<string, unknown>;
      if (!uuidValido(f.id)) throw new ErrorCliente("Elige una de tus firmas guardadas.");
      const firma_nombre = texto(f.nombre, 120);
      if (firma_nombre.length < 3) throw new ErrorCliente("La firma debe tener el nombre de su titular.");
      const png = typeof f.png === "string" ? f.png : "";
      if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png) || png.length > 600_000) throw new ErrorCliente("La imagen de la firma no es válida o es muy grande.");
      const objetos = Array.isArray(d.objetos) ? [...new Set(d.objetos.map((x) => texto(x, 120)).filter(Boolean))].slice(0, 20) : [];
      const desde = d.desde ? new Date(String(d.desde)) : ahora;
      const hasta = new Date(String(d.hasta || ""));
      if (isNaN(desde.getTime()) || isNaN(hasta.getTime()) || hasta <= desde) throw new ErrorCliente("Revisa las fechas: la delegación debe terminar después de empezar.");
      if (hasta.getTime() - desde.getTime() > 366 * 86_400_000) throw new ErrorCliente("Una delegación puede durar como máximo un año.");
      if (hasta <= ahora) throw new ErrorCliente("La fecha final ya pasó.");
      const del = await deps.db.crearDelegacion({
        titular_id: u.id, delegado_correo, firma_id: f.id as string, firma_nombre,
        firma_cifrada: await cifrarFirma(deps, png), objetos, desde: desde.toISOString(), hasta: hasta.toISOString(),
      });
      const fmt = (x: Date) => x.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });
      await deps.correo(delegado_correo, `${u.nombre || u.correo} te delegó su firma en PascalPDF`,
        `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#1F1F1F"><div style="height:4px;background:#FFC107;border-radius:4px"></div><h2 style="font-size:18px;margin:20px 0 8px">Te delegaron una firma</h2><p><b>${escHtml(u.nombre || u.correo)}</b> te autorizó a usar la firma de <b>${escHtml(firma_nombre)}</b> en PascalPDF del ${fmt(desde)} al ${fmt(hasta)}.</p><p>${objetos.length ? "Solo para: " + objetos.map(escHtml).join(", ") + "." : "Para cualquier documento."}</p><p>Entra a PascalPDF con este correo (${escHtml(delegado_correo)}) y la verás en «Firmar» → «Firmas que te delegaron». Cada uso queda registrado en el historial del titular.</p><p style="color:#5C5C5C;font-size:12px;margin-top:28px">PascalIA · pascalia.lat<br>Si no esperabas este correo, ignóralo.</p></div>`);
      return { ok: true, delegacion: publicaDelegacion(del, ahora) };
    }

    case "delegar_listar": {
      const u = await requerirUsuario(deps, d.token);
      const otorgadas = (await deps.db.delegacionesDe(u.id)).map((x) => publicaDelegacion(x, ahora));
      const recibidas = (await deps.db.delegacionesPara(u.correo)).filter((x) => x.estado !== "revocada").map((x) => publicaDelegacion(x, ahora));
      return { ok: true, otorgadas, recibidas };
    }

    case "delegar_estado": {
      const u = await requerirUsuario(deps, d.token);
      if (!uuidValido(d.id)) throw new ErrorCliente("Delegación no válida.");
      const del = await deps.db.delegacion(d.id as string);
      if (!del || del.titular_id !== u.id) throw new ErrorCliente("Esa delegación no es tuya.", 403);
      const estado = String(d.estado);
      if (!["activa", "suspendida", "revocada"].includes(estado)) throw new ErrorCliente("Estado no válido.");
      if (del.estado === "revocada") throw new ErrorCliente("Una delegación revocada no se puede reactivar. Crea una nueva.", 409);
      const cambios: Partial<Delegacion> = { estado: estado as Delegacion["estado"], actualizada_en: ahora.toISOString() };
      if (estado === "revocada") cambios.firma_cifrada = "revocada"; // se borra la imagen de la firma
      await deps.db.actualizarDelegacion(del.id, cambios);
      return { ok: true };
    }

    case "delegar_firma": {
      const u = await requerirUsuario(deps, d.token);
      if (!planActivo(u, ahora)) throw new ErrorCliente("Tu plan venció. Renuévalo para firmar.", 402);
      if (!uuidValido(d.id)) throw new ErrorCliente("Delegación no válida.");
      const del = await deps.db.delegacion(d.id as string);
      if (!del || del.delegado_correo !== u.correo) throw new ErrorCliente("Esa firma no te fue delegada.", 403);
      if (!vigente(del, ahora)) throw new ErrorCliente("La delegación de esa firma no está vigente.", 403);
      return { ok: true, firma: { id: del.firma_id, nombre: del.firma_nombre, png: await descifrarFirma(deps, del.firma_cifrada) }, objetos: del.objetos, hasta: del.hasta };
    }

    // ------------------------------------------------------------ administración (solo correos autorizados)
    case "admin_resumen": {
      await requerirAdmin(deps, d.token);
      return { ok: true, resumen: await deps.db.adminResumen() };
    }
    case "admin_promos": {
      await requerirAdmin(deps, d.token);
      return { ok: true, promos: await deps.db.adminPromos() };
    }
    case "admin_promo_guardar": {
      await requerirAdmin(deps, d.token);
      const p = (d.promo || {}) as Record<string, unknown>;
      const codigo = texto(p.codigo, 30).toUpperCase();
      if (!/^[A-Z0-9_-]{3,30}$/.test(codigo)) throw new ErrorCliente("El código debe tener de 3 a 30 letras, números, guion o guion bajo.");
      const tipo = p.tipo === "valor" ? "valor" : p.tipo === "dias" ? "dias" : "porcentaje";
      const valor = Math.round(Number(p.valor));
      if (!(valor > 0) || (tipo === "porcentaje" && valor > 100) || (tipo === "dias" && valor > 366)) throw new ErrorCliente(tipo === "dias" ? "Los días deben estar entre 1 y 366." : "Revisa el valor del descuento.");
      const plan = tipo === "dias" ? (p.plan === "pro" ? "pro" : "suite") : null;
      const productos = Array.isArray(p.productos) ? p.productos.map(String).filter((x) => x in PRODUCTOS) : [];
      const vence_en = p.vence_en ? new Date(String(p.vence_en)) : null;
      if (vence_en && isNaN(vence_en.getTime())) throw new ErrorCliente("Revisa la fecha de vencimiento.");
      const max_usos = p.max_usos === null || p.max_usos === "" || p.max_usos === undefined ? null : Math.round(Number(p.max_usos));
      if (max_usos !== null && !(max_usos > 0)) throw new ErrorCliente("El máximo de usos debe ser mayor que cero o quedar vacío.");
      await deps.db.adminGuardarPromo({
        codigo, tipo, valor, productos, vence_en: vence_en ? vence_en.toISOString() : null, max_usos,
        usos: 0, activo: p.activo !== false, nota: texto(p.nota, 200) || null, plan,
      });
      return { ok: true };
    }
    case "admin_usuarios": {
      await requerirAdmin(deps, d.token);
      const us = await deps.db.adminUsuarios(texto(d.buscar, 100).toLowerCase());
      return { ok: true, usuarios: us.map((x) => ({ correo: x.correo, nombre: x.nombre, plan: x.plan, vence_en: x.vence_en, creado_en: x.creado_en, activo: planActivo(x, ahora), google: !!x.google_sub, clave: !!x.clave_hash })) };
    }
    case "admin_plan": {
      await requerirAdmin(deps, d.token);
      const x = await deps.db.usuarioPorCorreo(texto(d.correo, 254).toLowerCase());
      if (!x) throw new ErrorCliente("No existe una cuenta con ese correo.", 404);
      const plan = String(d.plan);
      if (!["prueba", "pro", "suite"].includes(plan)) throw new ErrorCliente("Plan no válido.");
      const dias = Math.round(Number(d.dias));
      if (!(dias >= -3650 && dias <= 3650)) throw new ErrorCliente("Revisa los días.");
      const base = new Date(Math.max(ahora.getTime(), new Date(x.vence_en).getTime()));
      const vence = dias === 0 ? ahora : new Date(base.getTime() + dias * 86_400_000);
      await deps.db.actualizarUsuario(x.id, { plan: plan as Usuario["plan"], vence_en: vence.toISOString() });
      return { ok: true, vence_en: vence.toISOString() };
    }
    case "admin_pagos": {
      await requerirAdmin(deps, d.token);
      return { ok: true, pagos: await deps.db.adminPagos() };
    }

    // Código de días gratis: suma días de un plan sin pagar
    case "canjear_codigo": {
      const u = await requerirUsuario(deps, d.token);
      const codigo = texto(d.codigo, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
      if (!codigo) throw new ErrorCliente("Escribe el código.");
      const promo = await deps.db.promo(codigo);
      if (promo && promo.tipo !== "dias") throw new ErrorCliente("Ese código es un descuento: úsalo al elegir un plan, en «Código promocional».");
      try {
        const r = await deps.db.canjearDias(codigo, u.id);
        return { ok: true, ...r, cuenta: await resumen(deps, (await deps.db.usuarioPorId(u.id))!) };
      } catch (err) {
        const m = String((err as { message?: string }).message || "");
        if (m.includes("ya_usado")) throw new ErrorCliente("Ya usaste este código.", 409);
        if (m.includes("codigo_vencido")) throw new ErrorCliente("El código ya venció o se agotó.", 410);
        if (m.includes("codigo_invalido")) throw new ErrorCliente("El código no es válido.", 404);
        throw err;
      }
    }

    case "historial": {
      const u = await requerirUsuario(deps, d.token);
      return { ok: true, eventos: await deps.db.eventos(u.id, 10000), pagos: await deps.db.pagos(u.id) };
    }

    case "cotizar": {
      const u = await requerirUsuario(deps, d.token);
      return { ok: true, ...(await calcularPrecio(deps, u, texto(d.producto, 20), d.codigo)) };
    }

    case "pagar": {
      const u = await requerirUsuario(deps, d.token);
      const producto = texto(d.producto, 20);
      const precio = await calcularPrecio(deps, u, producto, d.codigo);
      const referencia = "PPDF-" + ahora.getTime().toString(36).toUpperCase() + "-" + aleatorio(6).replace(/[-_]/g, "X");
      await deps.db.crearPago({ referencia, usuario_id: u.id, correo: u.correo, producto, ...precio });
      if (precio.monto === 0) {
        await deps.db.aplicarPago(referencia, null);
        return { ok: true, gratis: true, cuenta: await resumen(deps, (await deps.db.usuarioPorCorreo(u.correo))!) };
      }
      if (!deps.wompi) throw new ErrorCliente("Los pagos todavía no están habilitados.", 503);
      let retorno = texto(d.retorno, 300);
      if (!retorno.startsWith(deps.sitio + "/")) retorno = deps.sitio + "/PascalPDF_Studio/";
      const centavos = precio.monto * 100;
      const firma = await sha256(`${referencia}${centavos}COP${deps.wompi.integridad}`);
      const q = new URLSearchParams({
        "public-key": deps.wompi.publica, currency: "COP", "amount-in-cents": String(centavos), reference: referencia,
        "signature:integrity": firma, "redirect-url": retorno, "customer-data:email": u.correo,
      });
      return { ok: true, referencia, monto: precio.monto, url: `https://checkout.wompi.co/p/?${q}` };
    }

    case "confirmar_pago": {
      const u = await requerirUsuario(deps, d.token);
      const id = texto(d.transaccion, 80);
      if (!id) throw new ErrorCliente("Falta el pago.");
      const t = await deps.consultarTransaccion(id);
      if (!t) throw new ErrorCliente("No encontramos ese pago en Wompi.", 404);
      const pago = await deps.db.pago(t.reference);
      if (!pago || pago.usuario_id !== u.id) throw new ErrorCliente("Ese pago no corresponde a tu cuenta.", 403);
      if (t.status === "APPROVED") {
        if (t.currency !== "COP" || t.amount_in_cents !== pago.monto * 100) throw new ErrorCliente("El valor pagado no coincide.", 409);
        await deps.db.aplicarPago(t.reference, t.id);
      } else if (["DECLINED", "VOIDED", "ERROR"].includes(t.status)) {
        await deps.db.marcarPago(t.reference, t.status === "VOIDED" ? "anulado" : "rechazado", t.id);
      }
      return { ok: true, estado: t.status, cuenta: await resumen(deps, (await deps.db.usuarioPorCorreo(u.correo))!) };
    }

    case "borrar_cuenta": {
      const u = await requerirUsuario(deps, d.token);
      if (texto(d.confirmacion, 20) !== "BORRAR") throw new ErrorCliente("Escribe BORRAR para confirmar.");
      await deps.db.borrarUsuario(u.id);
      return { ok: true };
    }
  }
  return null;
}
