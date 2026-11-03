// Cuentas de PascalPDF y Pascal Sign: entrada con código al correo, planes, prueba de 7 días,
// historial de firmas, cupo de solicitudes de firma y pagos con Wompi (con códigos promocionales).
// Independiente del entorno: index.ts conecta Postgres/Wompi/Resend; las pruebas usan Postgres local.
import { ErrorCliente } from "./logica.ts";

export type Usuario = {
  id: string; correo: string; nombre: string | null; creado_en: string;
  plan: "prueba" | "pro" | "suite"; vence_en: string; solicitudes_extra: number;
};
export type Promo = {
  codigo: string; tipo: "porcentaje" | "valor"; valor: number; productos: string[];
  vence_en: string | null; max_usos: number | null; usos: number; activo: boolean;
};
export type Evento = {
  app: string; documento_tipo: string; documento_nombre: string; documento_hash: string | null;
  objeto: string | null; radicado: string | null; firmante: string | null;
  firma_id: string; metodo: string | null; paginas: number | null;
  anio?: number; numero?: number; consecutivo?: string;
};
export type TransaccionWompi = { id: string; reference: string; status: string; amount_in_cents: number; currency: string };

export type DepsCuenta = {
  now: () => Date;
  secreto: string;
  sitio: string;
  wompi: { publica: string; integridad: string } | null;
  correo(para: string, asunto: string, html: string): Promise<boolean>;
  consultarTransaccion(id: string): Promise<TransaccionWompi | null>;
  db: {
    insertCodigo(c: { correo: string; codigo_hash: string; vence_en: string; intentos: number; creado_en: string }): Promise<void>;
    ultimoCodigo(correo: string): Promise<{ correo: string; codigo_hash: string; vence_en: string; intentos: number; creado_en: string } | null>;
    contarCodigosDesde(correo: string, desde: Date): Promise<number>;
    actualizarCodigo(correo: string, creado_en: string, cambios: { intentos: number }): Promise<void>;
    usuarioPorCorreo(correo: string): Promise<Usuario | null>;
    crearUsuario(u: { correo: string; nombre: string | null; plan: string; vence_en: string }): Promise<Usuario>;
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
    correo: u.correo, nombre: u.nombre, plan: u.plan, vence_en: u.vence_en, activo,
    nivel: activo ? (u.plan === "pro" ? 1 : 2) : 0, // la prueba da acceso a todo
    prueba: u.plan === "prueba",
    solicitudes: { usadas: await deps.db.contarSolicitudesDesde(u.id, desde), cupo: CUPO_SOLICITUDES[u.plan], extra: u.solicitudes_extra },
    firmas_mes: await deps.db.contarEventosDesde(u.id, desde),
    pagos_activos: !!deps.wompi,
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
  if (promo.productos.length && !promo.productos.includes(producto)) throw new ErrorCliente("El código no aplica para este plan.");
  if (await deps.db.promoUsada(codigo, u.id)) throw new ErrorCliente("Ya usaste este código.");
  const descuento = Math.min(p.precio, promo.tipo === "porcentaje" ? Math.round(p.precio * Math.min(100, promo.valor) / 100) : promo.valor);
  let monto = p.precio - descuento;
  // Wompi no procesa montos menores a $1.500: por debajo, el código lo deja gratis
  if (monto > 0 && monto < 1500) monto = 0;
  return { precio: p.precio, descuento: p.precio - monto, monto, codigo };
}

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

    case "entrar": {
      const correo = texto(d.correo, 254).toLowerCase();
      const c = await deps.db.ultimoCodigo(correo);
      if (!c || new Date(c.vence_en) < ahora || c.intentos >= 5) throw new ErrorCliente("El código venció. Pide uno nuevo.", 403);
      if ((await sha256(deps.secreto + "|c|" + correo + "|" + texto(d.codigo, 12))) !== c.codigo_hash) {
        await deps.db.actualizarCodigo(correo, c.creado_en, { intentos: c.intentos + 1 });
        throw new ErrorCliente("El código no es correcto.", 403);
      }
      await deps.db.actualizarCodigo(correo, c.creado_en, { intentos: 5 });
      let u = await deps.db.usuarioPorCorreo(correo);
      const nuevo = !u;
      if (!u) {
        u = await deps.db.crearUsuario({
          correo, nombre: texto(d.nombre, 120) || null, plan: "prueba",
          vence_en: new Date(ahora.getTime() + DIAS_PRUEBA * 86_400_000).toISOString(),
        });
      }
      const token = aleatorio();
      await deps.db.crearSesion({
        token_hash: await sha256(deps.secreto + "|t|" + token), usuario_id: u.id,
        vence_en: new Date(ahora.getTime() + DIAS_SESION * 86_400_000).toISOString(),
      });
      return { ok: true, token, nuevo, cuenta: await resumen(deps, u) };
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
      const eventos: Evento[] = d.eventos.map((e) => {
        const o = e as Record<string, unknown>;
        if (!uuidValido(o.firma_id)) throw new ErrorCliente("Identificador de firma no válido.");
        const hash = typeof o.documento_hash === "string" && /^[0-9a-f]{64}$/.test(o.documento_hash) ? o.documento_hash : null;
        const metodo = ["dibujada", "escrita", "imagen"].includes(o.metodo as string) ? o.metodo as string : null;
        const paginas = Number.isInteger(o.paginas) && (o.paginas as number) > 0 ? Math.min(10000, o.paginas as number) : null;
        return {
          app: o.app === "pascalsign" ? "pascalsign" : "pascalpdf",
          documento_tipo: texto(o.documento_tipo, 40) || "Otro",
          documento_nombre: texto(o.documento_nombre, 160) || "Documento.pdf",
          documento_hash: hash, firma_id: o.firma_id as string, metodo, paginas,
          objeto: texto(o.objeto, 120) || null, radicado: texto(o.radicado, 60) || null, firmante: texto(o.firmante, 120) || null,
        };
      });
      // Consecutivo por cuenta y año (hora de Colombia): iniciales-número-año, p. ej. DTB-0001-2026
      const anio = new Date(ahora.getTime() - 5 * 3600_000).getUTCFullYear();
      for (let intento = 0; ; intento++) {
        let n = await deps.db.ultimoNumero(u.id, anio);
        for (const e of eventos) { n++; e.anio = anio; e.numero = n; e.consecutivo = consecutivo(e.firmante, n, anio); }
        try {
          return { ok: true, registros: await deps.db.insertarEventos(u.id, eventos) };
        } catch (err) {
          // Dos guardados al mismo tiempo pueden tomar el mismo número: se reintenta
          if ((err as { code?: string }).code !== "23505" || intento >= 4) throw err;
        }
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
