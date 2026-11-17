// Acta de custodia en PDF (estilo PascalPDF) con firma en pantalla (Pascal Sign).

import { Pdf, A4 } from "./pdf.js";
import { fechaHora, coordenadas } from "./grabador.js";
import { formatoBytes } from "./fifo.js";

async function jpegDe(canvas, calidad = 0.85) {
  const c = document.createElement("canvas");
  c.width = canvas.width; c.height = canvas.height;
  const x = c.getContext("2d");
  x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, c.width, c.height); // la firma es transparente
  x.drawImage(canvas, 0, 0);
  const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", calidad));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ancho: c.width, alto: c.height };
}

/** Extrae un fotograma del archivo (o devuelve la foto). Null si no se puede. */
export async function fotogramaDeArchivo(archivo, clip, segundo = 1) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = clip.tipo === "foto" ? new Image() : document.createElement("video");
    const listo = new Promise((ok, mal) => {
      const t = setTimeout(() => mal(new Error("tiempo")), 6000);
      if (clip.tipo === "foto") { img.onload = () => { clearTimeout(t); ok(); }; img.onerror = mal; }
      else {
        img.muted = true; img.playsInline = true; img.preload = "auto";
        img.onloadeddata = () => { img.currentTime = segundo; };
        img.onseeked = () => { clearTimeout(t); ok(); };
        img.onerror = mal;
      }
    });
    img.src = url;
    await listo;
    const w = img.videoWidth || img.naturalWidth, h = img.videoHeight || img.naturalHeight;
    const esc = Math.min(1, 900 / w);
    const c = document.createElement("canvas");
    c.width = Math.round(w * esc); c.height = Math.round(h * esc);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

export function nombreArchivo(clip) {
  const d = new Date(clip.inicio);
  const p = (n) => String(n).padStart(2, "0");
  const ext = clip.tipo === "foto" ? "jpg" : clip.mime.includes("mp4") ? "mp4" : "webm";
  return `PVCar_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}

function resumenTelemetria(t = []) {
  const conPos = t.filter((m) => m.lat !== null && m.lon !== null);
  const vels = t.map((m) => m.vel).filter((v) => v !== null && v !== undefined);
  return {
    desde: conPos[0] || null,
    hasta: conPos.at(-1) || null,
    velMax: vels.length ? Math.max(...vels) : null,
    gMax: t.length ? Math.max(...t.map((m) => m.g || 0)) : 0,
  };
}

/**
 * @param {object} o
 * @param {object} o.clip metadatos del clip (con hash)
 * @param {HTMLCanvasElement|null} o.fotograma
 * @param {HTMLCanvasElement|null} o.firma
 * @param {{nombre:string, documento:string, placa:string, nota:string}} o.declarante
 * @returns {Promise<Blob>}
 */
export async function generarActa({ clip, fotograma, firma, declarante }) {
  const doc = new Pdf({ titulo: `Acta de custodia ${nombreArchivo(clip)}` });
  const p = doc.pagina();
  const M = 48, W = A4.ancho - M * 2;
  const gris = "#55514B", tenue = "#8C877E";

  // Encabezado
  p.rect(0, 0, A4.ancho, 6, { relleno: "#FFC107" });
  p.texto(M, 44, "PV Car", { tam: 20, negrita: true });
  p.texto(M + 72, 44, "· Pascal Video Car", { tam: 11, color: gris });
  p.texto(A4.ancho - M - 150, 40, "Ecosistema PascalIA", { tam: 9, color: tenue });
  p.texto(A4.ancho - M - 150, 52, "pascalia.lat", { tam: 9, color: "#8A6100" });
  p.texto(M, 80, "Acta de custodia de evidencia digital", { tam: 15, negrita: true });
  p.texto(M, 96, `Generada el ${fechaHora(new Date())} en el dispositivo del conductor, sin conexión a servidores.`, { tam: 9, color: gris });
  p.linea(M, 106, A4.ancho - M, 106);

  // Datos del archivo
  let y = 126;
  const fila = (k, v, opc = {}) => {
    p.texto(M, y, k, { tam: 9, color: tenue });
    y = p.parrafo(M + 130, y, v, W - 130, { tam: 10, ...opc });
    y += 4;
  };
  const dur = clip.fin ? Math.round((clip.fin - clip.inicio) / 1000) : null;
  fila("Archivo", nombreArchivo(clip), { negrita: true });
  fila("Tipo", clip.tipo === "foto" ? `Fotografía JPEG ${clip.ancho}×${clip.alto}` : `Video ${clip.mime.split(";")[0]} · ${clip.ancho}×${clip.alto} · 30 FPS`);
  fila("Inicio", fechaHora(new Date(clip.inicio)));
  if (clip.tipo !== "foto") fila("Fin", clip.fin ? `${fechaHora(new Date(clip.fin))}  (${Math.floor(dur / 60)} min ${dur % 60} s)` : "—");
  fila("Tamaño", `${formatoBytes(clip.bytes)} (${clip.bytes.toLocaleString("es-CO")} bytes)`);
  if (clip.estado === "recuperado") fila("Estado", "Recuperado tras un cierre inesperado: contiene lo grabado hasta el último trozo guardado.");
  fila("Huella SHA-256", clip.hash || "pendiente", { mono: true, tam: 9 });

  // Telemetría
  const r = resumenTelemetria(clip.telemetria);
  y += 6;
  p.texto(M, y, "Telemetría registrada", { tam: 11, negrita: true }); y += 16;
  fila("Posición inicial", r.desde ? coordenadas(r.desde.lat, r.desde.lon) : "Sin señal GPS");
  fila("Posición final", r.hasta ? coordenadas(r.hasta.lat, r.hasta.lon) : "Sin señal GPS");
  fila("Velocidad máxima", r.velMax === null ? "Sin dato" : `${r.velMax} km/h (según GPS del teléfono)`);
  fila("Fuerza G máxima", `${r.gMax.toFixed(2)} G (acelerómetro del teléfono)`);
  if (clip.placa) fila("Vehículo (placa)", clip.placa.toUpperCase());

  if (clip.eventos?.length) {
    y += 6;
    p.texto(M, y, "Eventos que protegieron el archivo", { tam: 11, negrita: true }); y += 16;
    for (const e of clip.eventos.slice(0, 8)) {
      fila(fechaHora(new Date(e.t)).slice(11), `${e.motivo}${e.g ? ` · ${e.g.toFixed(2)} G` : ""}`);
    }
  }

  // Fotograma
  if (fotograma) {
    const j = await jpegDe(fotograma);
    const ancho = Math.min(W, 300), alto = ancho * (j.alto / j.ancho);
    if (y + alto + 20 > 600) { /* sin espacio: se omite para mantener una página */ }
    else {
      y += 4;
      p.imagen(doc.jpeg(j.bytes, j.ancho, j.alto), M, y, ancho, alto);
      p.texto(M + ancho + 12, y + 10, "Fotograma de referencia", { tam: 9, color: tenue });
      p.parrafo(M + ancho + 12, y + 24, "Con la franja de fecha, hora, coordenadas, velocidad y fuerza G incrustada al grabar.", W - ancho - 12, { tam: 9, color: gris });
      y += alto + 12;
    }
  }

  // Declarante y firma
  y = Math.max(y + 8, 620);
  p.linea(M, y, A4.ancho - M, y); y += 18;
  p.texto(M, y, "Declarante", { tam: 11, negrita: true });
  p.texto(M + 300, y, "Firma (Pascal Sign)", { tam: 11, negrita: true });
  y += 16;
  const yDecl = y;
  p.texto(M, y, declarante.nombre || "—", { tam: 10 }); y += 14;
  p.texto(M, y, declarante.documento ? `Documento: ${declarante.documento}` : "Documento: —", { tam: 10, color: gris }); y += 14;
  if (declarante.nota) y = p.parrafo(M, y, declarante.nota, 260, { tam: 9, color: gris });
  if (firma) {
    const j = await jpegDe(firma, 0.9);
    const aw = 200, ah = aw * (j.alto / j.ancho);
    p.imagen(doc.jpeg(j.bytes, j.ancho, j.alto), M + 300, yDecl - 6, aw, Math.min(ah, 70));
  }
  p.linea(M + 300, yDecl + 68, M + 500, yDecl + 68, { color: "#1F1F1F", grosor: 0.6 });

  // Verificación y alcance
  let yv = 742;
  p.rect(M, yv - 12, W, 74, { relleno: "#FFF8E1" });
  yv = p.parrafo(M + 10, yv + 2, "Cómo verificar: calcule el SHA-256 del archivo entregado y compárelo con la huella de arriba. " +
    "Linux/macOS: sha256sum ARCHIVO (o shasum -a 256). Windows: certutil -hashfile ARCHIVO SHA256. " +
    "Si un solo byte cambió, la huella no coincide.", W - 20, { tam: 8.5, color: "#1F1F1F" });
  p.parrafo(M + 10, yv + 2, "Alcance: esta acta deja constancia técnica de la integridad del archivo desde que el teléfono lo selló. " +
    "Su valor como prueba lo determina la autoridad competente. Hora y posición provienen del reloj y GPS del teléfono.", W - 20, { tam: 8, color: gris });

  return new Blob([doc.bytes()], { type: "application/pdf" });
}
