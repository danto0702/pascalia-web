// Plantilla única de los correos de PascalIA (marca, firma y pie legal).
// Todas las funciones que envían correo la usan; así un cambio aquí cambia todos los correos.
// Se copia junto a cada función al desplegar (las funciones no comparten carpetas).
//
// Reglas: tablas y estilos en línea (los clientes de correo ignoran CSS externo), logo en PNG
// (los correos no muestran SVG), fondo blanco explícito, ancho máximo 560 px.
// `titulo` y `cuerpo` son HTML de confianza: quien llama debe escapar lo que venga de usuarios.

const SITIO = "https://pascalia.lat";
const LOGO = `${SITIO}/correo/flor-96.png`; // se muestra a 48 px para pantallas de alta densidad
const AMARILLO = "#FFC107";
const GRAFITO = "#1F1F1F";
const GRIS = "#5C5C5C";

export interface OpcionesCorreo {
  titulo: string;
  cuerpo: string;
  /** Producto que envía: "PascalPDF", "Pascal Web"… Se muestra junto al logo. */
  producto?: string;
  /** Texto oculto que aparece en la lista de la bandeja de entrada. */
  previa?: string;
  /** Botón principal opcional. */
  boton?: { texto: string; url: string };
  /** Por qué recibe este correo (obligatorio de buena práctica en correos a clientes). */
  motivo?: string;
  /** Correo interno (aviso al equipo): sin firma ni pie legal. */
  interno?: boolean;
  /** Para armar el enlace de baja con una referencia (p. ej. el radicado). */
  referencia?: string;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function cabeceraBaja(referencia?: string) {
  const asunto = encodeURIComponent(referencia ? `Baja ${referencia}` : "Baja");
  return { "List-Unsubscribe": `<mailto:contacto@pascalia.lat?subject=${asunto}>` };
}

export function plantillaCorreo(o: OpcionesCorreo): string {
  const fuente = "Arial,Helvetica,sans-serif";
  const producto = o.producto && o.producto !== "PascalIA"
    ? `<td align="right" style="font:600 13px ${fuente};color:${GRIS};padding-left:12px">${esc(o.producto)}</td>` : "";
  const previa = o.previa
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#ffffff">${esc(o.previa)}&#8203;&zwnj;&#8203;&zwnj;&#8203;&zwnj;</div>` : "";
  const boton = o.boton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td style="background:${AMARILLO};border-radius:999px"><a href="${esc(o.boton.url)}" style="display:inline-block;padding:13px 26px;font:700 15px ${fuente};color:${GRAFITO};text-decoration:none">${esc(o.boton.texto)}</a></td></tr></table>` : "";
  const baja = `mailto:contacto@pascalia.lat?subject=${encodeURIComponent(o.referencia ? `Baja ${o.referencia}` : "Baja")}`;

  const firma = o.interno ? "" : `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #E9E9E9;padding-top:18px;width:100%"><tr>
      <td width="44" valign="top" style="padding:18px 12px 0 0"><img src="${LOGO}" width="32" height="32" alt="" style="display:block;border:0"></td>
      <td valign="top" style="padding-top:18px;font:14px/1.5 ${fuente};color:${GRAFITO}">
        <b>Equipo Pascal<span style="color:#8A6100">IA</span></b><br>
        <span style="color:${GRIS}">Ideas que hacen florecer tu organización</span><br>
        <a href="${SITIO}" style="color:${GRAFITO}">pascalia.lat</a> · <a href="mailto:contacto@pascalia.lat" style="color:${GRAFITO}">contacto@pascalia.lat</a> · <a href="https://wa.me/573123885012" style="color:${GRAFITO}">WhatsApp +57 312 388 5012</a>
      </td></tr></table>`;

  const pie = o.interno ? "" : `
    <p style="margin:22px 0 0;font:12px/1.6 ${fuente};color:${GRIS}">
      ${esc(o.motivo ?? "Recibes este correo porque usaste un servicio de PascalIA en pascalia.lat.")}
      Responsable del tratamiento: Danilo Orlando Torrado Blanco (PascalIA), Calle 11 # 13-55, Ábrego, Norte de Santander, Colombia.<br>
      <a href="${baja}" style="color:${GRIS}">Darme de baja</a> ·
      <a href="${SITIO}/eliminar-mis-datos/" style="color:${GRIS}">Eliminar mis datos</a> ·
      <a href="${SITIO}/politica-de-datos/" style="color:${GRIS}">Política de datos</a>
    </p>`;

  return `<!doctype html><html lang="es-CO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.titulo.replace(/<[^>]*>/g, ""))}</title></head>
<body style="margin:0;padding:0;background:#ffffff">${previa}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:0 16px 32px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="height:4px;background:${AMARILLO};border-radius:0 0 4px 4px;font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="padding:22px 0 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="52"><img src="${LOGO}" width="40" height="40" alt="PascalIA" style="display:block;border:0"></td>
      <td style="font:800 20px ${fuente};color:${GRAFITO}">Pascal<span style="color:#8A6100">IA</span></td>${producto}
    </tr></table></td></tr>
    <tr><td style="font:16px/1.6 ${fuente};color:${GRAFITO}">
      <h1 style="font:700 20px/1.3 ${fuente};margin:18px 0 10px;color:${GRAFITO}">${o.titulo}</h1>
      ${o.cuerpo}${boton}${firma}${pie}
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

/** Estilo del código de seguridad que usan los correos de verificación. */
export const estiloCodigo = `font:800 30px Arial,Helvetica,sans-serif;letter-spacing:6px;margin:14px 0;color:${GRAFITO}`;
