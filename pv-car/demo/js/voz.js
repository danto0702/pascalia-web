// Copiloto por voz: escucha continua con el reconocedor del sistema y
// respuesta hablada (TTS). La interpretación está en comandos.js.

import { Copiloto } from "./comandos.js";

const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

export const vozDisponible = () => !!SR;

export class Voz extends EventTarget {
  constructor() {
    super();
    this.activa = false;
    this.copiloto = new Copiloto();
    this._rec = null;
    this._reintentos = 0;
    this._vozTTS = null;
    if ("speechSynthesis" in globalThis) {
      const elegir = () => {
        const voces = speechSynthesis.getVoices();
        this._vozTTS = voces.find((v) => v.lang === "es-CO") || voces.find((v) => v.lang?.startsWith("es-4")) ||
          voces.find((v) => v.lang?.startsWith("es-MX")) || voces.find((v) => v.lang?.startsWith("es")) || null;
      };
      elegir();
      speechSynthesis.addEventListener?.("voiceschanged", elegir);
    }
  }

  iniciar() {
    if (!SR || this.activa) return false;
    this.activa = true;
    this._arrancar();
    return true;
  }

  detener() {
    this.activa = false;
    try { this._rec?.abort(); } catch {}
    this._rec = null;
    this._estado("apagado");
  }

  /**
   * Chrome reciente puede reconocer en el propio teléfono (sin datos), pero solo
   * si el paquete de español está instalado. Pedirlo sin tenerlo hace fallar
   * el reconocedor en silencio, así que primero se pregunta.
   */
  async _modoLocal() {
    if (this._local !== undefined) return this._local;
    this._local = null;
    if (typeof SR.available === "function") {
      for (const lang of ["es-CO", "es-US", "es-419", "es-MX", "es-ES"]) {
        try {
          if ((await SR.available({ langs: [lang], processLocally: true })) === "available") { this._local = lang; break; }
        } catch { break; }
      }
    }
    return this._local;
  }

  async _arrancar() {
    if (!this.activa) return;
    const local = await this._modoLocal();
    if (!this.activa) return;
    const rec = new SR();
    rec.lang = local || "es-CO";
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    if (local && "processLocally" in rec) rec.processLocally = true;
    this.modo = local ? "en el teléfono" : "con el servicio del navegador";
    rec.onstart = () => { this._reintentos = 0; this._estado("escuchando"); };
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const texto = e.results[i][0].transcript;
        this.dispatchEvent(new CustomEvent("oido", { detail: texto }));
        // Se prueban las alternativas: la primera no siempre trae «Pascal».
        let r = null;
        for (let k = 0; k < e.results[i].length && !r; k++) r = this.copiloto.oir(e.results[i][k].transcript);
        if (r) this.dispatchEvent(new CustomEvent("orden", { detail: { ...r, texto } }));
      }
    };
    rec.onerror = (e) => {
      const err = e.error;
      if (err === "no-speech" || err === "aborted") return; // normales: se reinicia solo
      if (err === "not-allowed" || err === "service-not-allowed") { this.activa = false; this._estado("sin permiso"); return; }
      if ((err === "language-not-supported" || err === "processing-unavailable") && this._local) {
        this._local = null; // sin paquete local: se pasa al servicio del navegador
        return;
      }
      this._estado(err === "network" ? "sin conexión" : err === "audio-capture" ? "micrófono ocupado" : `error: ${err}`);
    };
    // El reconocedor se corta solo cada cierto tiempo: se reinicia.
    rec.onend = () => {
      if (!this.activa) return;
      const espera = Math.min(5000, 250 * 2 ** this._reintentos++);
      setTimeout(() => this._arrancar(), espera);
    };
    this._rec = rec;
    try { rec.start(); } catch (err) { this._estado(`error: ${err.message || err}`); }
  }

  _estado(e) { this.dispatchEvent(new CustomEvent("estado", { detail: e })); }

  /** Respuesta hablada breve. */
  decir(texto) {
    if (!("speechSynthesis" in globalThis)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = this._vozTTS?.lang || "es-CO";
      if (this._vozTTS) u.voice = this._vozTTS;
      u.rate = 1.05;
      speechSynthesis.speak(u);
    } catch {}
  }
}
