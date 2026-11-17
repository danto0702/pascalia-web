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

  _arrancar() {
    if (!this.activa) return;
    const rec = new SR();
    rec.lang = "es-CO";
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    // Chrome reciente puede reconocer en el propio teléfono, sin datos.
    if ("processLocally" in rec) rec.processLocally = true;
    rec.onstart = () => { this._reintentos = 0; this._estado("escuchando"); };
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        // Se prueban las alternativas: la primera no siempre trae «Pascal».
        let r = null;
        for (let k = 0; k < e.results[i].length && !r; k++) r = this.copiloto.oir(e.results[i][k].transcript);
        if (r) this.dispatchEvent(new CustomEvent("orden", { detail: { ...r, texto: e.results[i][0].transcript } }));
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.activa = false;
        this._estado("sin permiso");
      } else if (e.error === "network") {
        this._estado("sin conexión");
      }
    };
    // El reconocedor se corta solo cada cierto tiempo: se reinicia.
    rec.onend = () => {
      if (!this.activa) return;
      const espera = Math.min(5000, 300 * 2 ** this._reintentos++);
      setTimeout(() => this._arrancar(), espera);
    };
    this._rec = rec;
    try { rec.start(); } catch { /* ya iniciado */ }
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
