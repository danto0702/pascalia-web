// Lógica del bucle FIFO (pura, sin DOM): cálculo de autonomía y elección de
// qué clips reciclar antes de abrir un fragmento nuevo.

export const GB = 1e9; // los teléfonos y tiendas anuncian GB decimales

// Tasa de bits de video que se pide al grabador (más audio si se activa).
export const RESOLUCIONES = {
  "720p": { etiqueta: "720p HD", ancho: 1280, alto: 720, bps: 4_000_000 },
  "1080p": { etiqueta: "1080p FHD", ancho: 1920, alto: 1080, bps: 8_000_000 },
  "4k": { etiqueta: "4K UHD", ancho: 3840, alto: 2160, bps: 25_000_000 },
};
export const AUDIO_BPS = 96_000;

export const CUOTA_MIN_GB = 4;
export const CUOTA_MAX_GB = 64;
export const DURACIONES_MIN = [1, 3, 5];

/** Bytes que ocupa un fragmento de `minutos` a la resolución dada. */
export function bytesPorFragmento(resolucion, minutos, conAudio = false) {
  const r = RESOLUCIONES[resolucion] || RESOLUCIONES["1080p"];
  const bps = r.bps + (conAudio ? AUDIO_BPS : 0);
  return Math.ceil((bps / 8) * minutos * 60);
}

/** Horas continuas que caben en la cuota. */
export function horasDeGrabacion(cuotaGB, resolucion, conAudio = false) {
  const porHora = bytesPorFragmento(resolucion, 60, conAudio);
  return (cuotaGB * GB) / porHora;
}

export function formatoHoras(h) {
  if (!isFinite(h) || h <= 0) return "0 min";
  if (h < 1) return `${Math.round(h * 60)} min`;
  const enteras = Math.floor(h);
  const min = Math.round((h - enteras) * 60);
  if (min === 60) return `${enteras + 1} h`;
  return min ? `${enteras} h ${min} min` : `${enteras} h`;
}

export function formatoBytes(b) {
  if (b >= GB) return `${(b / GB).toFixed(b >= 10 * GB ? 0 : 1).replace(".", ",")} GB`;
  if (b >= 1e6) return `${Math.round(b / 1e6)} MB`;
  if (b >= 1e3) return `${Math.round(b / 1e3)} kB`;
  return `${b} B`;
}

/**
 * Decide qué clips borrar para que quepa un fragmento nuevo.
 * Nunca toca clips protegidos (bóveda) ni el que se está grabando.
 *
 * @param {{id:string, inicio:number, bytes:number, protegido:boolean, grabando?:boolean}[]} clips
 * @param {number} cuotaBytes
 * @param {number} necesarios bytes que se reservan para el próximo fragmento
 * @returns {{borrar:string[], cabe:boolean, usados:number, protegidos:number}}
 */
export function planReciclaje(clips, cuotaBytes, necesarios) {
  let usados = 0, protegidos = 0;
  for (const c of clips) {
    usados += c.bytes || 0;
    if (c.protegido) protegidos += c.bytes || 0;
  }
  const reciclables = clips
    .filter((c) => !c.protegido && !c.grabando)
    .sort((a, b) => a.inicio - b.inicio); // el más antiguo primero
  const borrar = [];
  let i = 0;
  while (usados + necesarios > cuotaBytes && i < reciclables.length) {
    const c = reciclables[i++];
    borrar.push(c.id);
    usados -= c.bytes || 0;
  }
  return { borrar, cabe: usados + necesarios <= cuotaBytes, usados, protegidos };
}
