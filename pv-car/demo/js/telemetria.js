// Telemetría en vivo: GPS (posición y velocidad) y acelerómetro (fuerza G).
// Dispara `impacto` cuando la aceleración supera el umbral configurado.

const G0 = 9.80665;

export const SENSIBILIDAD = {
  alta: { etiqueta: "Alta (1,8 G)", umbral: 1.8 },
  media: { etiqueta: "Media (2,5 G)", umbral: 2.5 },
  baja: { etiqueta: "Baja (3,5 G)", umbral: 3.5 },
};

function distanciaM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export class Telemetria extends EventTarget {
  constructor() {
    super();
    this.estado = { lat: null, lon: null, precision: null, velKmh: null, rumbo: null, g: 0, gPico: 0, gps: "apagado", sensor: "apagado" };
    this.umbral = SENSIBILIDAD.media.umbral;
    this._ultimoFix = null;
    this._ultimoImpacto = 0;
    this._pico = { v: 0, t: 0 };
    this._watch = null;
    this._onMotion = (e) => this._movimiento(e);
  }

  /** iOS exige pedir el permiso del acelerómetro tras un toque del usuario. */
  async pedirPermisoMovimiento() {
    const DME = globalThis.DeviceMotionEvent;
    if (DME && typeof DME.requestPermission === "function") {
      try { return (await DME.requestPermission()) === "granted"; } catch { return false; }
    }
    return !!DME;
  }

  iniciar() {
    if (this._watch === null && "geolocation" in navigator) {
      this.estado.gps = "buscando";
      this._watch = navigator.geolocation.watchPosition(
        (p) => this._posicion(p),
        (err) => { this.estado.gps = err.code === 1 ? "sin permiso" : "sin señal"; this._emitir(); },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
      );
    }
    window.addEventListener("devicemotion", this._onMotion);
    this.estado.sensor = "esperando";
  }

  detener() {
    if (this._watch !== null) navigator.geolocation.clearWatch(this._watch);
    this._watch = null;
    window.removeEventListener("devicemotion", this._onMotion);
    this.estado.gps = this.estado.sensor = "apagado";
  }

  _posicion(p) {
    const c = p.coords;
    const fix = { lat: c.latitude, lon: c.longitude, t: p.timestamp, precision: c.accuracy };
    let vel = typeof c.speed === "number" && !Number.isNaN(c.speed) ? c.speed * 3.6 : null;
    if (vel === null && this._ultimoFix) {
      const dt = (fix.t - this._ultimoFix.t) / 1000;
      if (dt >= 1 && c.accuracy < 30) vel = (distanciaM(this._ultimoFix, fix) / dt) * 3.6;
    }
    this._ultimoFix = fix;
    Object.assign(this.estado, {
      lat: fix.lat, lon: fix.lon, precision: c.accuracy,
      velKmh: vel === null ? this.estado.velKmh : Math.max(0, vel),
      rumbo: typeof c.heading === "number" && !Number.isNaN(c.heading) ? c.heading : this.estado.rumbo,
      gps: c.accuracy <= 30 ? "fijo" : "impreciso",
    });
    this._emitir();
  }

  _movimiento(e) {
    let g;
    const a = e.acceleration;
    if (a && a.x !== null) {
      g = Math.hypot(a.x, a.y, a.z) / G0; // sin gravedad: 0 G en reposo
    } else {
      const ag = e.accelerationIncludingGravity;
      if (!ag || ag.x === null) return;
      g = Math.abs(Math.hypot(ag.x, ag.y, ag.z) - G0) / G0;
    }
    const ahora = Date.now();
    this.estado.sensor = "activo";
    this.estado.g = g;
    // Pico de los últimos 2 s, para que el número del video sea legible.
    if (g >= this._pico.v || ahora - this._pico.t > 2000) this._pico = { v: g, t: ahora };
    this.estado.gPico = this._pico.v;
    if (g >= this.umbral && ahora - this._ultimoImpacto > 10000) {
      this._ultimoImpacto = ahora;
      this.dispatchEvent(new CustomEvent("impacto", { detail: { g, t: ahora } }));
    }
  }

  _emitir() { this.dispatchEvent(new Event("cambio")); }

  /** Muestra para el registro del clip (una por segundo). */
  muestra() {
    const s = this.estado;
    return { t: Date.now(), lat: s.lat, lon: s.lon, vel: s.velKmh === null ? null : Math.round(s.velKmh), g: Math.round(s.gPico * 100) / 100 };
  }
}
