// Registro de eventos de PV Car (inicio, detención, impacto, protección, foto, acta).
// Queda en el teléfono; se puede ver y exportar en CSV. Puro salvo el almacén,
// que se inyecta (localStorage en la app, uno falso en las pruebas).

export const TIPOS = {
  inicio: "Grabación iniciada",
  detencion: "Grabación detenida",
  impacto: "Impacto detectado",
  proteccion: "Evidencia protegida",
  foto: "Foto tomada",
  acta: "Acta PDF generada",
  sinEspacio: "Sin espacio: grabación detenida",
};
export const ORIGENES = { manual: "botón", voz: "voz", auto: "automático", sistema: "sistema" };

export class Registro {
  constructor(almacen, { clave = "pvcar_registro", max = 500 } = {}) {
    this.almacen = almacen; this.clave = clave; this.max = max;
  }

  listar() {
    try { const v = JSON.parse(this.almacen.getItem(this.clave) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
  }

  /** @returns {{t:number, tipo:string, origen?:string, detalle?:string}} */
  agregar(tipo, { origen, detalle, t = Date.now() } = {}) {
    const ev = { t, tipo, ...(origen ? { origen } : {}), ...(detalle ? { detalle } : {}) };
    const lista = this.listar();
    lista.push(ev);
    const recortada = lista.slice(-this.max);
    try { this.almacen.setItem(this.clave, JSON.stringify(recortada)); } catch {}
    return ev;
  }

  limpiar() { try { this.almacen.removeItem(this.clave); } catch {} }

  /** CSV con fecha local ISO, apto para Excel (separador ;, BOM UTF-8). */
  csv(formatoFecha = (t) => new Date(t).toISOString()) {
    const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const filas = this.listar().map((e) => [formatoFecha(e.t), TIPOS[e.tipo] || e.tipo, ORIGENES[e.origen] || e.origen || "", e.detalle || ""].map(esc).join(";"));
    return "﻿" + ["Fecha y hora;Evento;Origen;Detalle", ...filas].join("\r\n");
  }
}
