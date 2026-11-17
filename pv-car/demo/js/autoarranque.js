// Inicio y detención automáticos según la velocidad del GPS (puro, sin DOM).
// Inicia cuando el vehículo supera el umbral durante unos segundos seguidos
// (el GPS da saltos estando quieto) y, si la grabación la inició él, la
// detiene tras N minutos detenido.

export const QUIETO_KMH = 3;
export const SOSTENIDO_MS = 5000;

export class Autoarranque {
  /** @param {{umbralKmh:number, minutosParada:number}} cfg minutosParada 0 = no detener */
  constructor(cfg) {
    this.cfg = { ...cfg };
    this.rapidoDesde = null;
    this.quietoDesde = null;
  }

  configurar(cfg) { Object.assign(this.cfg, cfg); }

  /**
   * @param {{velKmh:number|null, ahora:number, grabando:boolean, iniciadaPorAuto:boolean}} s
   * @returns {'iniciar'|'detener'|null}
   */
  actualizar({ velKmh, ahora, grabando, iniciadaPorAuto }) {
    if (velKmh === null || velKmh === undefined || Number.isNaN(velKmh)) return null; // sin GPS no se decide nada
    if (!grabando) {
      this.quietoDesde = null;
      if (velKmh >= this.cfg.umbralKmh) {
        this.rapidoDesde ??= ahora;
        if (ahora - this.rapidoDesde >= SOSTENIDO_MS) { this.rapidoDesde = null; return "iniciar"; }
      } else this.rapidoDesde = null;
      return null;
    }
    this.rapidoDesde = null;
    if (!iniciadaPorAuto || !this.cfg.minutosParada) { this.quietoDesde = null; return null; }
    if (velKmh < QUIETO_KMH) {
      this.quietoDesde ??= ahora;
      if (ahora - this.quietoDesde >= this.cfg.minutosParada * 60_000) { this.quietoDesde = null; return "detener"; }
    } else this.quietoDesde = null;
    return null;
  }
}
