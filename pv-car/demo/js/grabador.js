// Motor de grabación en bucle.
// Cámara trasera → <canvas> (se dibuja la telemetría sobre cada fotograma)
// → MediaRecorder → trozos de 2 s guardados en IndexedDB → fragmentos de N min.
// Antes de abrir cada fragmento se recicla lo más antiguo no protegido (FIFO).

import * as db from "./db.js";
import { RESOLUCIONES, bytesPorFragmento, planReciclaje, GB } from "./fifo.js";

const TROZO_MS = 2000;

export function mimeSoportado() {
  const MR = globalThis.MediaRecorder;
  if (!MR) return null;
  const opciones = [
    "video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4",
    "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm",
  ];
  return opciones.find((m) => MR.isTypeSupported(m)) || null;
}

const pad = (n) => String(n).padStart(2, "0");
export function fechaHora(t = new Date()) {
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
}
export function coordenadas(lat, lon) {
  if (lat === null || lon === null) return "GPS: buscando señal";
  return `${Math.abs(lat).toFixed(5)}°${lat >= 0 ? "N" : "S"}  ${Math.abs(lon).toFixed(5)}°${lon >= 0 ? "E" : "O"}`;
}

export class Grabador extends EventTarget {
  /**
   * @param {{video:HTMLVideoElement, canvas:HTMLCanvasElement, telemetria:import('./telemetria.js').Telemetria}} o
   */
  constructor({ video, canvas, telemetria }) {
    super();
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.tel = telemetria;
    this.ajustes = { resolucion: "1080p", minutos: 3, cuotaGB: 16, audio: false, placa: "" };
    this.stream = null;
    this.grabando = false;
    this.clipActual = null;
    this._frag = null;
    this._dibujando = false;
  }

  async encenderCamara() {
    if (this.stream) return;
    const r = RESOLUCIONES[this.ajustes.resolucion];
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: r.ancho }, height: { ideal: r.alto }, frameRate: { ideal: 30, max: 30 } },
      audio: this.ajustes.audio ? { echoCancellation: false, noiseSuppression: true } : false,
    });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    await this.video.play();
    this._ajustarLienzo();
    this._dibujando = true;
    this._bucleDibujo();
  }

  apagarCamara() {
    this._dibujando = false;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  _ajustarLienzo() {
    const w = this.video.videoWidth || RESOLUCIONES[this.ajustes.resolucion].ancho;
    const h = this.video.videoHeight || RESOLUCIONES[this.ajustes.resolucion].alto;
    // Siempre horizontal: si la cámara entrega vertical, se respeta tal cual.
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  _bucleDibujo() {
    if (!this._dibujando) return;
    const siguiente = () => this._bucleDibujo();
    this._dibujar();
    if (this.video.requestVideoFrameCallback) this.video.requestVideoFrameCallback(siguiente);
    else requestAnimationFrame(siguiente);
  }

  /** Dibuja el fotograma con la franja de telemetría (marca de agua probatoria). */
  _dibujar() {
    const { ctx, canvas, video } = this;
    if (video.readyState < 2) return;
    this._ajustarLienzo();
    const W = canvas.width, H = canvas.height;
    ctx.drawImage(video, 0, 0, W, H);
    const s = this.tel.estado;
    // La letra se calcula con el lado corto: en vertical el video es angosto.
    const u = Math.max(14, Math.round(Math.min(W, H) / 28));
    const mono = (peso, tam) => `${peso} ${tam}px ui-monospace, "Roboto Mono", Menlo, Consolas, monospace`;
    const grande = mono(700, u), chica = mono(500, Math.round(u * 0.78));
    const g = s.gPico || 0;
    const vel = s.velKmh === null ? "-- km/h" : `${Math.round(s.velKmh)} km/h`;
    const placa = this.ajustes.placa ? `  ${this.ajustes.placa.toUpperCase()}` : "";
    const prot = !!(this.clipActual && this.clipActual.protegido);
    const estado = this.grabando ? (prot ? "● REC · BÓVEDA" : "● REC") : "PV Car";
    const pares = [
      [{ t: fechaHora(), f: grande, c: "#FFFFFF" }, { t: `${vel}  ${g.toFixed(2)} G`, f: grande, c: g >= this.tel.umbral ? "#FF5252" : "#FFC107" }],
      [{ t: `${coordenadas(s.lat, s.lon)}${placa}`, f: chica, c: "#F4F1EA" }, { t: estado, f: chica, c: prot ? "#FFC107" : this.grabando ? "#FF6B6B" : "#C9C4BA" }],
    ];
    const x = Math.round(u * 0.9), hueco = u;
    const ancho = (e) => { ctx.font = e.f; return ctx.measureText(e.t).width; };
    const alto = (e) => parseInt(e.f.match(/ (\d+)px/)[1], 10);
    // Si izquierda y derecha no caben en una fila, la derecha baja a su propia fila.
    const filas = [];
    for (const [izq, der] of pares) {
      if (ancho(izq) + hueco + ancho(der) <= W - 2 * x) filas.push([izq, der]);
      else { filas.push([izq, null]); filas.push([der, null]); }
    }
    const interlinea = 1.3;
    const altoFranja = Math.round(filas.reduce((a, [e]) => a + alto(e) * interlinea, 0) + u * 0.7);
    ctx.fillStyle = "rgba(15,15,15,0.62)";
    ctx.fillRect(0, H - altoFranja, W, altoFranja);
    ctx.fillStyle = prot ? "#FFC107" : "#8C877E";
    ctx.fillRect(0, H - altoFranja, Math.round(u * 0.3), altoFranja);
    ctx.textBaseline = "alphabetic";
    let y = H - altoFranja + Math.round(u * 0.35);
    for (const [izq, der] of filas) {
      y += alto(izq) * interlinea;
      const base = y - alto(izq) * 0.28;
      ctx.textAlign = "left"; ctx.font = izq.f; ctx.fillStyle = izq.c;
      ctx.fillText(izq.t, x, base, W - 2 * x);
      if (der) { ctx.textAlign = "right"; ctx.font = der.f; ctx.fillStyle = der.c; ctx.fillText(der.t, W - x, base); }
    }
    ctx.textAlign = "left";
  }

  async iniciar() {
    if (this.grabando) return;
    await this.encenderCamara();
    this.grabando = true;
    // Todas las partes de este viaje (de Grabar a Detener) comparten la sesión.
    this.sesion = `s${Date.now()}`;
    await this._abrirFragmento();
    this.dispatchEvent(new Event("estado"));
  }

  async detener() {
    if (!this.grabando) return;
    this.grabando = false;
    await this._cerrarFragmento();
    this.dispatchEvent(new Event("estado"));
  }

  /** Libera espacio según la cuota. Devuelve false si la bóveda llenó la cuota. */
  async reciclar() {
    const clips = await db.listarClips();
    let cuota = this.ajustes.cuotaGB * GB;
    // Si el navegador concede menos espacio que la cuota elegida, el bucle se
    // ajusta a lo real (con 10 % de margen) para reciclar antes de que falle.
    try {
      const est = await navigator.storage?.estimate?.();
      if (est?.quota) cuota = Math.min(cuota, est.quota * 0.9);
    } catch {}
    const necesarios = bytesPorFragmento(this.ajustes.resolucion, this.ajustes.minutos, this.ajustes.audio);
    const plan = planReciclaje(clips.map((c) => ({ ...c, grabando: c.estado === "grabando" })), cuota, necesarios);
    for (const id of plan.borrar) await db.borrarClip(id);
    if (plan.borrar.length) this.dispatchEvent(new CustomEvent("reciclado", { detail: plan.borrar.length }));
    return plan.cabe;
  }

  /** Abre un fragmento nuevo. Devuelve su estado interno o null si no hay espacio. */
  async _abrirFragmento(protegerDesdeInicio = false) {
    const cabe = await this.reciclar();
    if (!cabe) {
      this.grabando = false;
      this.dispatchEvent(new CustomEvent("sin-espacio"));
      this.dispatchEvent(new Event("estado"));
      return null;
    }
    const mime = mimeSoportado();
    const pistas = this.canvas.captureStream(30).getVideoTracks();
    if (this.ajustes.audio && this.stream) pistas.push(...this.stream.getAudioTracks());
    const r = RESOLUCIONES[this.ajustes.resolucion];
    const rec = new MediaRecorder(new MediaStream(pistas), {
      mimeType: mime || undefined,
      videoBitsPerSecond: r.bps,
      audioBitsPerSecond: this.ajustes.audio ? 96000 : undefined,
    });
    const inicio = Date.now();
    const clip = {
      id: `v${inicio}`, tipo: "video", inicio, fin: null, bytes: 0, partes: 0,
      mime: rec.mimeType || mime || "video/webm",
      resolucion: this.ajustes.resolucion, ancho: this.canvas.width, alto: this.canvas.height,
      protegido: protegerDesdeInicio, estado: "grabando",
      eventos: protegerDesdeInicio ? [{ t: inicio, motivo: "Continuación de un evento en curso" }] : [], telemetria: [this.tel.muestra()],
      placa: this.ajustes.placa || "", hash: null, sesion: this.sesion,
    };
    await db.guardarClip(clip);
    const frag = { rec, clip, seq: 0, cola: Promise.resolve(), corte: null, muestras: null };
    rec.ondataavailable = (e) => {
      if (!e.data || !e.data.size) return;
      const seq = frag.seq++;
      frag.cola = frag.cola
        .then(() => db.agregarParte(clip.id, seq, e.data))
        .catch((err) => this.dispatchEvent(new CustomEvent("error", { detail: err })));
    };
    rec.onerror = (e) => this.dispatchEvent(new CustomEvent("error", { detail: e.error || e }));
    rec.start(TROZO_MS);
    let n = 0;
    frag.muestras = setInterval(() => {
      clip.telemetria.push(this.tel.muestra());
      // Cada 10 s la telemetría queda en disco, por si el teléfono se apaga.
      if (++n % 10 === 0) db.actualizarClip(clip.id, (c) => { c.telemetria = clip.telemetria.slice(); }).catch(() => {});
    }, 1000);
    frag.corte = setTimeout(() => this._rotar(), this.ajustes.minutos * 60_000);
    this._frag = frag;
    this.clipActual = clip;
    this.dispatchEvent(new CustomEvent("fragmento", { detail: clip }));
    return frag;
  }

  async _cerrarFragmento(frag = this._frag) {
    if (!frag) return null;
    clearTimeout(frag.corte); clearInterval(frag.muestras);
    if (this._frag === frag) { this._frag = null; this.clipActual = null; }
    const { rec, clip } = frag;
    const miniatura = this.miniatura(); // fotograma pequeño para las tarjetas de Videos
    if (rec.state !== "inactive") {
      await new Promise((ok) => { rec.addEventListener("stop", ok, { once: true }); rec.stop(); });
    }
    rec.stream.getVideoTracks().forEach((t) => t.stop()); // solo la pista del canvas
    await frag.cola;
    const final = await db.actualizarClip(clip.id, (c) => {
      c.fin = Date.now();
      c.estado = "listo";
      c.protegido = c.protegido || clip.protegido;
      c.eventos = clip.eventos;
      c.telemetria = clip.telemetria;
      if (miniatura) c.miniatura = miniatura;
    });
    if (final) this.dispatchEvent(new CustomEvent("cerrado", { detail: final }));
    return final;
  }

  async _rotar() {
    if (!this.grabando) return;
    const viejo = this._frag;
    // Si hubo un evento en los últimos 30 s, el siguiente fragmento también
    // nace protegido (el incidente puede seguir en curso).
    const ultimo = viejo?.clip.eventos.at(-1);
    const seguir = !!(ultimo && Date.now() - ultimo.t < 30_000);
    // El nuevo arranca antes de cerrar el viejo: no queda hueco entre clips.
    await this._abrirFragmento(seguir);
    await this._cerrarFragmento(viejo);
  }

  /** Marca el fragmento en curso (y el anterior, si es reciente) como protegido. */
  async proteger(motivo, extra = {}) {
    const t = Date.now();
    const ids = [];
    if (this.clipActual) {
      this.clipActual.protegido = true;
      this.clipActual.eventos.push({ t, motivo, ...extra });
      await db.actualizarClip(this.clipActual.id, (c) => { c.protegido = true; c.eventos = this.clipActual.eventos; });
      ids.push(this.clipActual.id);
    }
    // El fragmento anterior guarda los segundos previos al evento.
    const previo = (await db.listarClips()).find((c) => c.tipo === "video" && c.id !== this.clipActual?.id && c.fin && t - c.fin < 15_000);
    if (previo && !previo.protegido) {
      await db.actualizarClip(previo.id, (c) => { c.protegido = true; c.eventos = [...(c.eventos || []), { t, motivo: `${motivo} (segundos previos)` }]; });
      ids.push(previo.id);
      this.dispatchEvent(new CustomEvent("cerrado", { detail: await db.obtenerClip(previo.id) }));
    }
    return ids;
  }

  /** Foto del fotograma actual, con la franja de telemetría incluida. */
  async foto() {
    if (!this.stream) {
      await this.encenderCamara();
      await new Promise((ok) => setTimeout(ok, 600)); // la cámara tarda en ajustar la exposición
    }
    this._dibujar();
    const blob = await new Promise((ok) => this.canvas.toBlob(ok, "image/jpeg", 0.92));
    const t = Date.now();
    const meta = {
      id: `f${t}`, tipo: "foto", inicio: t, fin: t, bytes: blob.size, partes: 1, mime: "image/jpeg",
      ancho: this.canvas.width, alto: this.canvas.height, protegido: true, estado: "listo",
      eventos: [{ t, motivo: "Foto" }], telemetria: [this.tel.muestra()], placa: this.ajustes.placa || "", hash: null,
      miniatura: this.miniatura(),
    };
    await db.guardarClip({ ...meta, bytes: 0, partes: 0 });
    await db.agregarParte(meta.id, 0, blob);
    this.dispatchEvent(new CustomEvent("cerrado", { detail: await db.obtenerClip(meta.id) }));
    return { meta, blob };
  }

  /** Miniatura 16:9 de 240 px en JPEG como data URL (≈ 8 kB), o null sin cámara. */
  miniatura() {
    try {
      const f = this.fotograma(240);
      if (!f) return null;
      const c = document.createElement("canvas");
      c.width = 240; c.height = 135;
      const x = c.getContext("2d");
      const esc = Math.max(240 / f.width, 135 / f.height); // recorte centrado, sin bandas negras
      const w = f.width * esc, h = f.height * esc;
      x.drawImage(f, (240 - w) / 2, (135 - h) / 2, w, h);
      return c.toDataURL("image/jpeg", 0.62);
    } catch { return null; }
  }

  /** Fotograma pequeño en JPEG para el acta (o null si no hay cámara). */
  fotograma(anchoMax = 640) {
    if (!this.stream || this.video.readyState < 2) return null;
    const esc = Math.min(1, anchoMax / this.canvas.width);
    const c = document.createElement("canvas");
    c.width = Math.round(this.canvas.width * esc); c.height = Math.round(this.canvas.height * esc);
    c.getContext("2d").drawImage(this.canvas, 0, 0, c.width, c.height);
    return c;
  }
}

/**
 * Al abrir la app: los clips que quedaron «grabando» (corte de energía,
 * golpe, cierre forzado) se marcan como recuperados con lo que alcanzó a guardarse.
 */
export async function recuperarHuerfanos() {
  const clips = await db.listarClips();
  let n = 0;
  for (const c of clips) {
    if (c.estado !== "grabando") continue;
    n++;
    if (!c.bytes) { await db.borrarClip(c.id); continue; }
    await db.actualizarClip(c.id, (x) => { x.estado = "recuperado"; x.fin = x.actualizado || x.inicio; });
  }
  return n;
}
