// Agrupa las partes de video de un mismo viaje (de Grabar a Detener) en una
// sola grabación. Puro, sin DOM, para probarlo con `node --test`.

/**
 * @param {{id:string, tipo:string, sesion?:string, inicio:number, fin:number|null, bytes:number, protegido:boolean, estado:string}[]} clips
 * @returns {{id:string, partes:object[], inicio:number, fin:number|null, bytes:number, segundos:number, grabando:boolean, protegidas:number, recuperada:boolean}[]}
 *   Grabaciones de la más reciente a la más antigua; las partes, en orden.
 */
export function agruparSesiones(clips) {
  const grupos = new Map();
  for (const c of clips) {
    if (c.tipo !== "video") continue;
    const id = c.sesion || c.id; // clips antiguos sin sesión: cada uno es su propia grabación
    if (!grupos.has(id)) grupos.set(id, []);
    grupos.get(id).push(c);
  }
  const out = [];
  for (const [id, partes] of grupos) {
    partes.sort((a, b) => a.inicio - b.inicio);
    const grabando = partes.some((p) => p.estado === "grabando");
    const ultima = partes.at(-1);
    const segundos = partes.reduce((a, p) => a + Math.max(0, ((p.fin || (p.estado === "grabando" ? Date.now() : p.inicio)) - p.inicio) / 1000), 0);
    out.push({
      id, partes,
      inicio: partes[0].inicio,
      fin: grabando ? null : ultima.fin || ultima.inicio,
      bytes: partes.reduce((a, p) => a + (p.bytes || 0), 0),
      segundos: Math.round(segundos),
      grabando,
      protegidas: partes.filter((p) => p.protegido).length,
      recuperada: partes.some((p) => p.estado === "recuperado"),
    });
  }
  return out.sort((a, b) => b.inicio - a.inicio);
}

export function duracionTexto(segundos) {
  const s = Math.max(0, Math.round(segundos));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, r = s % 60;
  if (h) return `${h} h ${m} min`;
  if (m) return r ? `${m} min ${r} s` : `${m} min`;
  return `${r} s`;
}
