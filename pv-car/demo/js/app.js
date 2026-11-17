// PV Car · orquestación de la interfaz.
import * as db from "./db.js";
import { Grabador, recuperarHuerfanos, mimeSoportado, fechaHora, coordenadas } from "./grabador.js";
import { Telemetria, SENSIBILIDAD } from "./telemetria.js";
import { Voz, vozDisponible } from "./voz.js";
import { ACCIONES } from "./comandos.js";
import { horasDeGrabacion, formatoHoras, formatoBytes, GB, RESOLUCIONES } from "./fifo.js";
import { generarActa, fotogramaDeArchivo, nombreArchivo } from "./acta.js";
import { agruparSesiones, duracionTexto } from "./sesiones.js";
import { Autoarranque } from "./autoarranque.js";
import { Registro, TIPOS, ORIGENES } from "./registro.js";

const $ = (id) => document.getElementById(id);
const CLAVE = "pvcar_ajustes";
// Versión de los términos de PV Car (/pv-car/terminos/). Si cambia, se pide aceptarlos de nuevo.
const TERMINOS = "1.0";
const PREDETERMINADOS = { cuotaGB: 16, resolucion: "1080p", minutos: 3, sensibilidad: "media", voz: true, tts: true, audio: false, placa: "", nombre: "", documento: "", bienvenida: false, autoInicio: false, autoUmbral: 15, autoParada: 5, vibrar: true };

function leerAjustes() {
  try { return { ...PREDETERMINADOS, ...JSON.parse(localStorage.getItem(CLAVE) || "{}") }; } catch { return { ...PREDETERMINADOS }; }
}
let ajustes = leerAjustes();
const aceptoTerminos = () => ajustes.bienvenida && ajustes.terminos === TERMINOS;
function guardarAjustes() { try { localStorage.setItem(CLAVE, JSON.stringify(ajustes)); } catch {} }

const tel = new Telemetria();
const grab = new Grabador({ video: $("video"), canvas: $("lienzo"), telemetria: tel });
const voz = new Voz();

function aplicarAjustes() {
  Object.assign(grab.ajustes, { resolucion: ajustes.resolucion, minutos: ajustes.minutos, cuotaGB: ajustes.cuotaGB, audio: ajustes.audio, placa: ajustes.placa });
  tel.umbral = (SENSIBILIDAD[ajustes.sensibilidad] || SENSIBILIDAD.media).umbral;
}
aplicarAjustes();

/* ---------- Avisos y voz ---------- */
let tAviso = null;
function avisar(texto, { tono = "", hablar = false } = {}) {
  const a = $("aviso");
  a.textContent = texto;
  a.dataset.tono = tono;
  a.classList.add("ver");
  clearTimeout(tAviso);
  tAviso = setTimeout(() => a.classList.remove("ver"), 4500);
  if (hablar && ajustes.tts) voz.decir(texto);
}
const vibrar = (p) => { if (!ajustes.vibrar) return; try { navigator.vibrate?.(p); } catch {} };

/* ---------- Registro de eventos ---------- */
const registro = new Registro(localStorage);
const anotar = (tipo, origen, detalle) => { try { registro.agregar(tipo, { origen, detalle }); } catch {} };

/* ---------- Pantalla encendida (Wake Lock) ---------- */
let bloqueo = null;
async function mantenerPantalla(si) {
  try {
    if (si && "wakeLock" in navigator && !bloqueo) {
      bloqueo = await navigator.wakeLock.request("screen");
      bloqueo.addEventListener("release", () => { bloqueo = null; });
    } else if (!si && bloqueo) { await bloqueo.release(); bloqueo = null; }
  } catch { /* sin permiso o no soportado */ }
}

/* ---------- Estado en pantalla ---------- */
function chip(id, tono, html) { const c = $(id); c.dataset.tono = tono; if (html !== undefined) c.innerHTML = html; }

function pintarRec() {
  const b = $("btnRec");
  b.setAttribute("aria-pressed", String(grab.grabando));
  b.querySelector("use").setAttribute("href", grab.grabando ? "#i-stop" : "#i-rec");
  b.querySelector("span").textContent = grab.grabando ? "Detener" : "Grabar";
  b.setAttribute("aria-label", grab.grabando ? "Detener la grabación" : "Iniciar la grabación");
  $("visorVacio").hidden = !!grab.stream;
  if (!grab.grabando) chip("chipRec", "apagado", '<span class="punto"></span><span>Detenido</span>');
}

let inicioSesion = 0;
setInterval(() => {
  if (grab.grabando) {
    const s = Math.floor((Date.now() - inicioSesion) / 1000);
    const t = `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    const prot = grab.clipActual?.protegido;
    chip("chipRec", prot ? "prot" : "rec", `<span class="punto"></span><span>${prot ? "Protegiendo" : "REC"} ${t}</span>`);
  }
  const s = tel.estado;
  if (s.sensor === "activo") chip("chipG", s.gPico >= tel.umbral ? "mal" : "ok", `G <b>${s.gPico.toFixed(2)}</b>`);
}, 1000);

tel.addEventListener("cambio", () => {
  const s = tel.estado;
  const vel = s.velKmh === null ? "" : ` · ${Math.round(s.velKmh)} km/h`;
  const tono = { fijo: "ok", impreciso: "alerta", buscando: "alerta", "sin permiso": "mal", "sin señal": "mal" }[s.gps] || "apagado";
  chip("chipGps", tono, `GPS <b>${s.gps === "fijo" || s.gps === "impreciso" ? "OK" + vel : s.gps}</b>`);
});

async function pintarEspacio() {
  const clips = await db.listarClips();
  const usados = clips.reduce((a, c) => a + (c.bytes || 0), 0);
  const cuota = ajustes.cuotaGB * GB;
  const pct = Math.min(100, Math.round((usados / cuota) * 100));
  chip("chipEspacio", pct > 90 ? "alerta" : "ok", `Memoria <b>${formatoBytes(usados)} / ${ajustes.cuotaGB} GB</b>`);
  return { clips, usados, cuota };
}

/* ---------- Hash SHA-256 en un worker ---------- */
let worker = null;
const pendientes = new Map();
function hashDe(id) {
  if (pendientes.has(id)) return pendientes.get(id).promesa;
  if (!worker) {
    worker = new Worker(new URL("./hash-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = async (e) => {
      const p = pendientes.get(e.data.id);
      if (!p) return;
      pendientes.delete(e.data.id);
      if (e.data.error) return p.mal(new Error(e.data.error));
      await db.actualizarClip(e.data.id, (c) => { c.hash = e.data.hash; c.hashBytes = e.data.bytes; c.hashEn = Date.now(); });
      p.ok(e.data.hash);
      if ($("dlgBoveda").open) pintarLista();
    };
  }
  let ok, mal;
  const promesa = new Promise((a, b) => { ok = a; mal = b; });
  pendientes.set(id, { promesa, ok, mal });
  worker.postMessage({ id });
  return promesa;
}
function sellarSiCorresponde(clip) {
  if (clip && clip.protegido && !clip.hash && clip.estado !== "grabando") hashDe(clip.id).catch(() => {});
}

/* ---------- Acciones principales ---------- */
let iniciadaPorAuto = false;
async function iniciarGrabacion(origen = "manual") {
  if (grab.grabando) return;
  if (!mimeSoportado()) return avisar("Este navegador no puede grabar video. Usa Chrome en Android o Safari 14.5+ en iPhone.", { tono: "mal" });
  await tel.pedirPermisoMovimiento();
  tel.iniciar();
  try {
    await grab.iniciar();
  } catch (err) {
    const msg = err?.name === "NotAllowedError" ? "Sin permiso para la cámara. Actívalo en los ajustes del navegador." :
      err?.name === "NotFoundError" ? "No se encontró una cámara." : `No se pudo iniciar la cámara (${err?.message || err}).`;
    avisar(msg, { tono: "mal", hablar: true });
    pintarRec();
    return;
  }
  if (!grab.grabando) return; // sin espacio
  iniciadaPorAuto = origen === "auto";
  anotar("inicio", origen);
  vibrar(80);
  inicioSesion = Date.now();
  mantenerPantalla(true);
  pintarRec();
  if (ajustes.voz) encenderVoz();
  avisar(origen === "auto" ? "Grabación iniciada automáticamente" : "Grabación activada", { hablar: true });
}

async function detenerGrabacion(origen = "manual") {
  if (!grab.grabando) return;
  await grab.detener();
  grab.apagarCamara();
  anotar("detencion", origen);
  vibrar([50, 60, 50]);
  iniciadaPorAuto = false;
  if (!ajustes.autoInicio) tel.detener(); // el inicio automático necesita el GPS encendido
  if (!ajustes.autoInicio) { chip("chipGps", "apagado", "GPS <b>—</b>"); chip("chipG", "apagado", "G <b>—</b>"); }
  mantenerPantalla(!!ajustes.autoInicio); // con inicio automático la pantalla sigue encendida para el próximo arranque
  salirAhorro();
  pintarRec();
  const { clips } = await pintarEspacio();
  const g = agruparSesiones(clips).find((x) => x.id === grab.sesion);
  if (g) {
    pestana = "grab";
    avisar(`Grabación guardada: ${duracionTexto(g.segundos)}${g.partes.length > 1 ? ` en ${g.partes.length} partes` : ""}. Está en Videos.`, { hablar: false });
    if (ajustes.tts) voz.decir("Grabación detenida y guardada");
  } else avisar("Grabación detenida", { hablar: true });
}

async function proteger(motivo = "Protegido por el conductor", extra = {}, origen = "manual") {
  const ids = await grab.proteger(motivo, extra);
  if (!ids.length) {
    const ult = (await db.listarClips()).find((c) => c.tipo === "video" && !c.protegido);
    if (ult) { await db.actualizarClip(ult.id, (c) => { c.protegido = true; c.eventos = [...(c.eventos || []), { t: Date.now(), motivo }]; }); sellarSiCorresponde(await db.obtenerClip(ult.id)); ids.push(ult.id); }
  }
  if (!ids.length) return avisar("No hay un clip para proteger todavía.", { hablar: true });
  vibrar([60, 40, 60]);
  anotar("proteccion", origen, motivo);
  avisar(ids.length > 1 ? "Video protegido en la bóveda, con los segundos previos." : "Video protegido en la bóveda.", { hablar: true });
  pintarEspacio();
}

async function foto(origen = "manual") {
  try {
    const { meta, blob } = await grab.foto();
    if (!grab.grabando) { grab.apagarCamara(); pintarRec(); } // no dejar la cámara encendida
    descargar(blob, nombreArchivo(meta));
    vibrar(40);
    anotar("foto", origen);
    avisar("Foto tomada y guardada en la bóveda.", { hablar: true });
  } catch (err) {
    avisar(`No se pudo tomar la foto (${err?.message || err}).`, { tono: "mal" });
  }
}

function entrarAhorro() {
  $("ahorro").hidden = false;
  $("btnAhorro").setAttribute("aria-pressed", "true");
  $("salirAhorro").focus();
}
function salirAhorro() {
  $("ahorro").hidden = true;
  $("btnAhorro").setAttribute("aria-pressed", "false");
}

/* ---------- Copiloto ---------- */
function encenderVoz() {
  if (!vozDisponible()) { chip("chipVoz", "mal", '<svg aria-hidden="true"><use href="#i-mic"/></svg><b>Voz no disponible</b>'); return; }
  voz.iniciar();
}
voz.addEventListener("estado", (e) => {
  const m = { escuchando: ["ok", "Di «Hola Pascal»"], apagado: ["apagado", "Voz apagada"], "sin permiso": ["mal", "Sin permiso de micrófono"], "sin conexión": ["alerta", "Voz sin internet"], "micrófono ocupado": ["mal", "Micrófono ocupado"] }[e.detail] || ["mal", `Voz: ${e.detail}`];
  chip("chipVoz", m[0], `<svg aria-hidden="true"><use href="#i-mic"/></svg><b>${m[1]}</b>`);
});
voz.addEventListener("oido", (e) => {
  $("vozOido").textContent = `Último texto oído (${voz.modo}): «${e.detail.trim()}»`;
});
voz.addEventListener("orden", async (e) => {
  const r = e.detail;
  if (r.tipo === "atento") { vibrar(30); if (ajustes.tts) voz.decir("Dime"); return; }
  if (r.tipo === "desconocido") return avisar(`No entendí «${r.texto}»`, { hablar: true });
  switch (r.accion) {
    case ACCIONES.iniciar: return iniciarGrabacion("voz");
    case ACCIONES.detener: return detenerGrabacion("voz");
    case ACCIONES.proteger: return proteger("Comando de voz", {}, "voz");
    case ACCIONES.foto: return foto("voz");
    case ACCIONES.ahorroOn: entrarAhorro(); return avisar("Modo ahorro térmico activado", { hablar: true });
    case ACCIONES.ahorroOff: salirAhorro(); return avisar("Pantalla normal", { hablar: true });
    case ACCIONES.estado: {
      const { usados, cuota } = await pintarEspacio();
      const horas = horasDeGrabacion(ajustes.cuotaGB, ajustes.resolucion, ajustes.audio);
      return avisar(`${grab.grabando ? "Grabando. " : ""}Usas ${formatoBytes(usados)} de ${ajustes.cuotaGB} GB. El bucle cubre unas ${formatoHoras(horas)}.`.replace(/GB/g, "gigas"), { hablar: true });
    }
  }
});

/* ---------- Eventos del grabador y sensores ---------- */
tel.addEventListener("impacto", async (e) => {
  if (!grab.grabando) return;
  vibrar([200, 80, 200]);
  anotar("impacto", "sistema", `${e.detail.g.toFixed(2).replace(".", ",")} G`);
  await proteger("Impacto detectado", { g: e.detail.g }, "sistema");
  avisar("Impacto detectado: video protegido. Cuando estés a salvo, abre Videos › «¿Tuviste un choque?».", { tono: "mal" });
});
grab.addEventListener("cerrado", (e) => { sellarSiCorresponde(e.detail); pintarEspacio(); if ($("dlgBoveda").open) pintarLista(); });
grab.addEventListener("fragmento", () => pintarEspacio());
grab.addEventListener("sin-espacio", () => {
  anotar("sinEspacio", "sistema");
  avisar("Los clips protegidos llenaron la cuota. Sube la cuota o libera espacio en la bóveda.", { tono: "mal", hablar: true });
  mantenerPantalla(false); pintarRec();
});
grab.addEventListener("error", (e) => {
  const err = e.detail;
  const lleno = err?.name === "QuotaExceededError";
  avisar(lleno ? "El teléfono se quedó sin espacio. Baja la cuota o libera memoria." : `Error al grabar: ${err?.message || err}`, { tono: "mal", hablar: lleno });
});

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;
  if (ajustes.voz && !voz.activa && aceptoTerminos()) encenderVoz();
  if (!grab.grabando) return;
  mantenerPantalla(true);
  const vivo = grab.stream?.getVideoTracks().some((t) => t.readyState === "live");
  if (!vivo) {
    grab.apagarCamara();
    try { await grab.encenderCamara(); avisar("La cámara se pausó mientras la app estuvo en segundo plano. Grabación reanudada.", { tono: "mal", hablar: true }); }
    catch { avisar("No se pudo reanudar la cámara.", { tono: "mal" }); }
  }
});
window.addEventListener("beforeunload", (e) => { if (grab.grabando) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- Botones ---------- */
$("btnRec").addEventListener("click", () => (grab.grabando ? detenerGrabacion() : iniciarGrabacion()));
$("btnProteger").addEventListener("click", () => proteger());
$("btnFoto").addEventListener("click", foto);
$("btnAhorro").addEventListener("click", () => ($("ahorro").hidden ? entrarAhorro() : salirAhorro()));
$("salirAhorro").addEventListener("dblclick", salirAhorro);
$("salirAhorro").addEventListener("keydown", (e) => { if (e.key === "Escape" || e.key === "Enter") salirAhorro(); });
$("btnBoveda").addEventListener("click", () => { pintarLista(); $("dlgBoveda").showModal(); });
$("btnAjustes").addEventListener("click", () => { pintarAjustes(); $("dlgAjustes").showModal(); });
document.querySelectorAll("[data-cerrar]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

/* ---------- Grabaciones y bóveda ---------- */
// «Grabaciones»: cada viaje (de Grabar a Detener) unido en una sola grabación.
// «Bóveda»: las partes protegidas por un evento y las fotos, con su acta.
let pestana = "grab";
$("tabGrab").addEventListener("click", () => { pestana = "grab"; pintarLista(); });
$("tabBov").addEventListener("click", () => { pestana = "bov"; pintarLista(); });

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.rel = "noopener";
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
async function compartir(blob, nombre) { return compartirVarios([{ blob, nombre }]); }
/** Comparte uno o varios archivos juntos; si el teléfono no puede, los descarga. */
async function compartirVarios(lista) {
  const files = lista.map(({ blob, nombre }) => new File([blob], nombre, { type: blob.type }));
  if (navigator.canShare?.({ files })) {
    try { await navigator.share({ files, title: lista.length > 1 ? `Grabación PV Car (${lista.length} partes)` : lista[0].nombre }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  for (const [i, { blob, nombre }] of lista.entries()) {
    descargar(blob, nombre);
    if (i < lista.length - 1) await new Promise((ok) => setTimeout(ok, 700));
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function duracion(c) {
  if (c.tipo === "foto") return "Foto";
  return duracionTexto(((c.fin || Date.now()) - c.inicio) / 1000);
}
const hora = (t) => fechaHora(new Date(t)).slice(11, 16);
function nombreParte(g, p, i) {
  const base = nombreArchivo({ ...p, inicio: g.inicio }).replace(/\.(\w+)$/, "");
  const ext = nombreArchivo(p).split(".").pop();
  return g.partes.length > 1 ? `${base}_parte${i + 1}de${g.partes.length}.${ext}` : `${base}.${ext}`;
}
let grupos = [];

async function pintarLista() {
  const { clips, usados, cuota } = await pintarEspacio();
  grupos = agruparSesiones(clips);
  const bov = clips.filter((c) => c.protegido);
  $("nGrab").textContent = grupos.length; $("nBov").textContent = bov.length;
  $("tabGrab").setAttribute("aria-selected", String(pestana === "grab"));
  $("tabBov").setAttribute("aria-selected", String(pestana === "bov"));
  $("lista").setAttribute("aria-labelledby", pestana === "grab" ? "tabGrab" : "tabBov");
  const ul = $("lista");
  if (pestana === "grab") {
    $("notaLista").textContent = `Cada viaje, de Grabar a Detener, queda guardado como una grabación. Si la memoria llega a ${ajustes.cuotaGB} GB, el bucle borra primero las partes más antiguas que no estén protegidas (usados: ${formatoBytes(usados)}, ${Math.round((usados / cuota) * 100)} %).`;
    if (!grupos.length) { ul.innerHTML = '<li class="vacio">Aún no hay grabaciones. Toca Grabar y, al terminar el viaje, Detener: la grabación completa aparece aquí.</li>'; return; }
    ul.innerHTML = grupos.map((g) => {
      const res = g.partes[0].resolucion;
      const ins = g.grabando ? '<span class="insignia rec">Grabando</span>'
        : g.protegidas === g.partes.length ? '<span class="insignia prot">Protegida</span>'
        : g.protegidas ? '<span class="insignia prot">Con evidencia</span>' : g.recuperada ? '<span class="insignia">Recuperada</span>' : "";
      const partes = g.partes.length > 1 ? ` · ${g.partes.length} partes` : "";
      const rango = g.grabando ? `${hora(g.inicio)} – ahora` : `${hora(g.inicio)} – ${hora(g.fin)}`;
      return `<li class="clip${g.protegidas ? " prot" : ""}" data-sesion="${esc(g.id)}">
        <h3>${esc(fechaHora(new Date(g.inicio)).slice(0, 10))} · ${rango}</h3>${ins}
        <p class="meta">${duracionTexto(g.segundos)}${partes} · ${formatoBytes(g.bytes)} · ${esc(RESOLUCIONES[res]?.etiqueta || "")}${g.protegidas && g.protegidas < g.partes.length ? ` · ${g.protegidas} parte(s) en la bóveda` : ""}</p>
        <div class="botones">${g.grabando ? "" : `
          <button type="button" data-a="ver">Ver</button>
          <button type="button" data-a="compartir">Guardar / compartir</button>
          ${g.protegidas < g.partes.length ? '<button type="button" class="dest" data-a="proteger">Proteger completa</button>' : ""}
          <button type="button" class="mal" data-a="borrar">Borrar</button>`}
        </div></li>`;
    }).join("");
    return;
  }
  const bytesBov = bov.reduce((a, c) => a + c.bytes, 0);
  $("notaLista").textContent = `La bóveda nunca se recicla. Aquí están las partes protegidas por un golpe, el botón Proteger o la voz, y las fotos. Ocupa ${formatoBytes(bytesBov)} de los ${ajustes.cuotaGB} GB.`;
  if (!bov.length) { ul.innerHTML = '<li class="vacio">Aún no hay evidencias. Un golpe fuerte, el botón Proteger o «Okay Pascal, guarda este video» las envían aquí.</li>'; return; }
  ul.innerHTML = bov.map((c) => {
    const ins = c.estado === "grabando" ? '<span class="insignia rec">Grabando</span>' : '<span class="insignia prot">Protegido</span>';
    const evento = c.eventos?.length ? ` · ${esc(c.eventos.at(-1).motivo)}` : "";
    const hash = `<p class="hash">${c.hash ? "SHA-256 " + c.hash : c.estado === "grabando" ? "Se sellará al cerrar la parte" : "Calculando huella SHA-256…"}</p>`;
    const listo = c.estado !== "grabando";
    return `<li class="clip prot" data-id="${esc(c.id)}">
      <h3>${esc(fechaHora(new Date(c.inicio)))}</h3>${ins}
      <p class="meta">${duracion(c)} · ${formatoBytes(c.bytes)}${c.tipo === "video" ? " · " + esc(RESOLUCIONES[c.resolucion]?.etiqueta || `${c.ancho}×${c.alto}`) : ""}${evento}</p>${hash}
      <div class="botones">${listo ? `
        <button type="button" data-a="ver">Ver</button>
        <button type="button" data-a="compartir">Guardar / compartir</button>
        <button type="button" class="dest" data-a="acta">Acta PDF</button>
        <button type="button" data-a="desproteger">Quitar protección</button>
        <button type="button" class="mal" data-a="borrar">Borrar</button>` : ""}
      </div></li>`;
  }).join("");
}

$("lista").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-a]"); if (!b) return;
  const a = b.dataset.a;
  const fila = b.closest("[data-sesion], [data-id]");
  if (fila.dataset.sesion) {
    const g = grupos.find((x) => x.id === fila.dataset.sesion); if (!g) return pintarLista();
    if (a === "ver") return verSesion(g);
    if (a === "compartir") {
      b.disabled = true; b.textContent = "Preparando…";
      try { return await compartirVarios(await Promise.all(g.partes.map(async (p, i) => ({ blob: await db.archivoDe(p), nombre: nombreParte(g, p, i) })))); }
      finally { b.disabled = false; b.textContent = "Guardar / compartir"; }
    }
    if (a === "proteger") {
      for (const p of g.partes) {
        if (p.protegido) continue;
        await db.actualizarClip(p.id, (c) => { c.protegido = true; c.eventos = [...(c.eventos || []), { t: Date.now(), motivo: "Grabación protegida completa" }]; });
        sellarSiCorresponde(await db.obtenerClip(p.id));
      }
      avisar("Grabación protegida: ya no se borra con el bucle.");
    }
    if (a === "borrar") {
      const libres = g.partes.filter((p) => !p.protegido);
      const msg = g.protegidas ? `Se borrarán ${libres.length} parte(s). Las ${g.protegidas} protegidas se conservan en la bóveda. ¿Continuar?` : "¿Borrar esta grabación completa?";
      if (libres.length && confirm(msg)) for (const p of libres) await db.borrarClip(p.id);
      else if (!libres.length) avisar("Todas las partes están protegidas: bórralas desde la Bóveda.");
    }
    return pintarLista();
  }
  const id = fila.dataset.id;
  const clip = await db.obtenerClip(id); if (!clip) return pintarLista();
  if (a === "ver") return ver(clip);
  if (a === "compartir") return compartir(await db.archivoDe(clip), nombreArchivo(clip));
  if (a === "acta") return abrirActa(clip);
  if (a === "desproteger" && confirm("Esta parte volverá a la grabación normal y podrá borrarse cuando se llene la memoria. ¿Continuar?")) {
    await db.actualizarClip(id, (c) => { c.protegido = false; });
  }
  if (a === "borrar" && confirm("Es una evidencia protegida. ¿Borrarla para siempre?")) await db.borrarClip(id);
  pintarLista();
});

/* ---------- Reproductor ---------- */
let urlsVer = [];
function limpiarVer() { urlsVer.forEach((u) => URL.revokeObjectURL(u)); urlsVer = []; $("verMedio").innerHTML = ""; $("verParte").textContent = ""; }
function resumen(partes) {
  const t = partes.flatMap((p) => p.telemetria || []);
  const conPos = t.filter((m) => m.lat !== null && m.lat !== undefined);
  return { desde: conPos[0], hasta: conPos.at(-1), vmax: Math.max(0, ...t.map((m) => m.vel || 0)), gmax: Math.max(0, ...t.map((m) => m.g || 0)) };
}
function pintarDatos(filas) { $("verDatos").innerHTML = filas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join(""); }

async function ver(clip) {
  limpiarVer();
  const url = URL.createObjectURL(await db.archivoDe(clip)); urlsVer.push(url);
  $("tVer").textContent = fechaHora(new Date(clip.inicio));
  $("verMedio").innerHTML = clip.tipo === "foto" ? `<img src="${url}" alt="Foto tomada el ${esc(fechaHora(new Date(clip.inicio)))}">` : `<video src="${url}" controls playsinline></video>`;
  const r = resumen([clip]);
  pintarDatos([
    ["Archivo", nombreArchivo(clip)], ["Tamaño", formatoBytes(clip.bytes)], ["Duración", duracion(clip)],
    ["Posición", r.desde ? coordenadas(r.desde.lat, r.desde.lon) : "Sin GPS"], ["Vel. máx.", `${r.vmax} km/h`], ["G máx.", `${r.gmax.toFixed(2)} G`],
    ...(clip.eventos || []).map((e) => [fechaHora(new Date(e.t)).slice(11), e.motivo]),
    ...(clip.hash ? [["SHA-256", clip.hash]] : []),
  ]);
  $("dlgVer").showModal();
}

/** Reproduce las partes del viaje una tras otra, como un solo video. */
async function verSesion(g) {
  limpiarVer();
  $("tVer").textContent = `Grabación · ${fechaHora(new Date(g.inicio)).slice(0, 10)} ${hora(g.inicio)} – ${hora(g.fin)}`;
  const video = document.createElement("video");
  video.controls = true; video.playsInline = true; video.preload = "auto";
  $("verMedio").append(video);
  const urls = [];
  const url = async (i) => { if (!urls[i]) { urls[i] = URL.createObjectURL(await db.archivoDe(g.partes[i])); urlsVer.push(urls[i]); } return urls[i]; };
  let actual = 0;
  const cargar = async (i, reproducir) => {
    actual = i;
    video.src = await url(i);
    $("verParte").textContent = g.partes.length < 2 ? "" : i + 1 < g.partes.length ? `Parte ${i + 1} de ${g.partes.length} · al terminar sigue sola la siguiente` : `Parte ${i + 1} de ${g.partes.length} (última)`;
    if (reproducir) video.play().catch(() => {});
    if (i + 1 < g.partes.length) url(i + 1); // deja lista la siguiente
  };
  video.addEventListener("ended", () => { if (actual + 1 < g.partes.length) cargar(actual + 1, true); });
  await cargar(0, false);
  const r = resumen(g.partes);
  pintarDatos([
    ["Inicio", fechaHora(new Date(g.inicio))], ["Fin", fechaHora(new Date(g.fin))], ["Duración", duracionTexto(g.segundos)],
    ["Partes", String(g.partes.length)], ["Tamaño", formatoBytes(g.bytes)],
    ["Desde", r.desde ? coordenadas(r.desde.lat, r.desde.lon) : "Sin GPS"], ["Hasta", r.hasta ? coordenadas(r.hasta.lat, r.hasta.lon) : "Sin GPS"],
    ["Vel. máx.", `${r.vmax} km/h`], ["G máx.", `${r.gmax.toFixed(2)} G`],
    ...g.partes.flatMap((p) => (p.eventos || []).filter((e) => !/Continuación/.test(e.motivo)).map((e) => [fechaHora(new Date(e.t)).slice(11), e.motivo])),
  ]);
  $("dlgVer").showModal();
}
$("dlgVer").addEventListener("close", limpiarVer);

/* ---------- Acta con firma (Pascal Sign) ---------- */
const firma = $("firma");
let firmado = false;
(function padFirma() {
  const ctx = firma.getContext("2d");
  let trazando = false, ult = null;
  const punto = (e) => { const r = firma.getBoundingClientRect(); return { x: (e.clientX - r.left) * (firma.width / r.width), y: (e.clientY - r.top) * (firma.height / r.height) }; };
  firma.addEventListener("pointerdown", (e) => { trazando = true; ult = punto(e); firma.setPointerCapture(e.pointerId); });
  firma.addEventListener("pointermove", (e) => {
    if (!trazando) return;
    const p = punto(e);
    ctx.strokeStyle = "#0C2858"; ctx.lineWidth = 3.2; ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(ult.x, ult.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ult = p; firmado = true;
  });
  const fin = () => { trazando = false; };
  firma.addEventListener("pointerup", fin); firma.addEventListener("pointercancel", fin);
  $("borrarFirma").addEventListener("click", () => { ctx.clearRect(0, 0, firma.width, firma.height); firmado = false; });
})();

let clipActa = null;
async function abrirActa(clip) {
  clipActa = clip;
  $("aNombre").value = ajustes.nombre; $("aDoc").value = ajustes.documento; $("aNota").value = "";
  $("dlgActa").showModal();
  if (!clip.hash) {
    $("estadoHash").textContent = "Calculando la huella SHA-256 del archivo…";
    $("btnGenerarActa").disabled = true;
    try { clip.hash = await hashDe(clip.id); } catch (err) { $("estadoHash").textContent = `No se pudo calcular la huella: ${err.message}`; return; }
    $("btnGenerarActa").disabled = false;
  }
  $("estadoHash").textContent = `SHA-256 ${clip.hash}`;
}
$("formActa").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!clipActa) return;
  const btn = $("btnGenerarActa");
  btn.disabled = true; btn.textContent = "Generando…";
  try {
    ajustes.nombre = $("aNombre").value.trim(); ajustes.documento = $("aDoc").value.trim(); guardarAjustes();
    const clip = await db.obtenerClip(clipActa.id);
    const archivo = await db.archivoDe(clip);
    const ev = clip.eventos?.[0];
    const seg = ev && clip.tipo === "video" ? Math.max(0.5, (ev.t - clip.inicio) / 1000) : 1;
    const fotograma = await fotogramaDeArchivo(archivo, clip, seg);
    const pdf = await generarActa({
      clip, fotograma, firma: firmado ? firma : null,
      declarante: { nombre: ajustes.nombre, documento: ajustes.documento, nota: $("aNota").value.trim() },
    });
    anotar("acta", "manual", nombreArchivo(clip));
    await compartir(pdf, `Acta_${nombreArchivo(clip).replace(/\.\w+$/, "")}.pdf`);
    $("dlgActa").close();
  } catch (err) {
    $("estadoHash").textContent = `No se pudo generar el acta: ${err.message}`;
  } finally { btn.disabled = false; btn.textContent = "Generar acta PDF"; }
});

/* ---------- Ajustes ---------- */
async function pintarAjustes() {
  const f = $("formAjustes");
  $("cuota").value = ajustes.cuotaGB;
  f.resolucion.value = ajustes.resolucion; f.minutos.value = String(ajustes.minutos); f.sensibilidad.value = ajustes.sensibilidad;
  $("vozOn").checked = ajustes.voz; $("ttsOn").checked = ajustes.tts; $("audioOn").checked = ajustes.audio; $("placa").value = ajustes.placa;
  $("autoOn").checked = ajustes.autoInicio; $("autoUmbral").value = String(ajustes.autoUmbral); $("autoParada").value = String(ajustes.autoParada);
  $("autoUmbral").disabled = $("autoParada").disabled = !ajustes.autoInicio; $("vibrarOn").checked = ajustes.vibrar;
  $("vozAyuda").textContent = vozDisponible()
    ? "El reconocimiento lo hace el sistema del teléfono. En Android, descarga el paquete de voz en español para que funcione sin datos."
    : "Este navegador no ofrece reconocimiento de voz. En Android usa Chrome; en iPhone, Safari 14.5 o superior.";
  pintarCuota();
  try {
    const est = await navigator.storage?.estimate?.();
    if (est) {
      const libre = est.quota - est.usage;
      const ok = ajustes.cuotaGB * GB <= est.quota;
      $("dispTxt").textContent = `${ok ? "" : "⚠ "}El navegador permite a esta app usar hasta ${formatoBytes(est.quota)} en este teléfono (libres: ${formatoBytes(libre)}).`;
    }
  } catch {}
}
function pintarCuota() {
  const gb = Number($("cuota").value);
  const f = $("formAjustes");
  $("cuotaTxt").textContent = `${gb} GB`;
  $("horasTxt").textContent = `${formatoHoras(horasDeGrabacion(gb, f.resolucion.value || ajustes.resolucion, $("audioOn").checked))} en ${RESOLUCIONES[f.resolucion.value || ajustes.resolucion].etiqueta}`;
  $("cuota").setAttribute("aria-valuetext", `${gb} gigabytes`);
}
$("formAjustes").addEventListener("input", pintarCuota);
$("formAjustes").addEventListener("change", () => {
  const f = $("formAjustes");
  const antes = { resolucion: ajustes.resolucion, audio: ajustes.audio };
  Object.assign(ajustes, {
    cuotaGB: Number($("cuota").value), resolucion: f.resolucion.value, minutos: Number(f.minutos.value), sensibilidad: f.sensibilidad.value,
    voz: $("vozOn").checked, tts: $("ttsOn").checked, audio: $("audioOn").checked, placa: $("placa").value.trim().toUpperCase().slice(0, 10),
    autoInicio: $("autoOn").checked, autoUmbral: Number($("autoUmbral").value), autoParada: Number($("autoParada").value), vibrar: $("vibrarOn").checked,
  });
  configurarAuto();
  guardarAjustes(); aplicarAjustes(); pintarEspacio(); pintarAjustes();
  if (ajustes.voz) encenderVoz(); else voz.detener();
  if (grab.grabando && (antes.resolucion !== ajustes.resolucion || antes.audio !== ajustes.audio)) {
    avisar("La nueva resolución o el audio se aplican al detener y volver a grabar.");
  }
});
$("borrarTodo").addEventListener("click", async () => {
  if (!confirm("Se borrarán todos los clips del bucle. La bóveda (protegidos) se conserva. ¿Continuar?")) return;
  for (const c of await db.listarClips()) if (!c.protegido && c.estado !== "grabando") await db.borrarClip(c.id);
  pintarEspacio(); avisar("Bucle vaciado.");
});

/* ---------- Arranque ---------- */
/* ---------- Guía de bienvenida (4 pantallas) ---------- */
const pasosGuia = [...document.querySelectorAll(".guia-paso")];
const puntosGuia = [...document.querySelectorAll(".guia-puntos button")];
let pasoGuia = 0;
function irPaso(n) {
  pasoGuia = Math.max(0, Math.min(pasosGuia.length - 1, n));
  pasosGuia.forEach((s, i) => { s.hidden = i !== pasoGuia; });
  puntosGuia.forEach((b, i) => b.setAttribute("aria-selected", String(i === pasoGuia)));
  const ultimo = pasoGuia === pasosGuia.length - 1, yaAcepto = aceptoTerminos();
  $("guiaAtras").hidden = pasoGuia === 0;
  $("guiaSig").hidden = ultimo;
  $("btnEmpezar").hidden = !ultimo;
  $("btnEmpezar").textContent = yaAcepto ? "Cerrar" : "Empezar";
  $("btnEmpezar").disabled = !yaAcepto && !$("acepto").checked;
  document.querySelector(".guia-acepto").hidden = yaAcepto;
  $("guiaSaltar").hidden = ultimo;
  pasosGuia.at(pasoGuia).querySelector("h2").focus?.();
}
function abrirGuia(desde = 0) { if (!$("dlgBienvenida").open) $("dlgBienvenida").showModal(); irPaso(desde); }
pasosGuia.forEach((s) => s.querySelector("h2").setAttribute("tabindex", "-1"));
$("guiaSig").addEventListener("click", () => irPaso(pasoGuia + 1));
$("guiaAtras").addEventListener("click", () => irPaso(pasoGuia - 1));
$("guiaSaltar").addEventListener("click", () => irPaso(pasosGuia.length - 1));
puntosGuia.forEach((b, i) => b.addEventListener("click", () => irPaso(i)));
// Deslizar con el dedo entre pantallas
let toqueX = null;
$("dlgBienvenida").addEventListener("touchstart", (e) => { toqueX = e.touches[0].clientX; }, { passive: true });
$("dlgBienvenida").addEventListener("touchend", (e) => {
  if (toqueX === null) return;
  const dx = e.changedTouches[0].clientX - toqueX; toqueX = null;
  if (Math.abs(dx) > 60) irPaso(pasoGuia + (dx < 0 ? 1 : -1));
});
// Sin aceptar los términos no se puede cerrar con Escape
$("dlgBienvenida").addEventListener("cancel", (e) => { if (!aceptoTerminos()) { e.preventDefault(); irPaso(pasosGuia.length - 1); } });
$("acepto").addEventListener("change", (e) => { $("btnEmpezar").disabled = !e.target.checked; });
$("formBienv").addEventListener("submit", async (e) => {
  if (aceptoTerminos()) return; // solo cerrar
  if (!$("acepto").checked) { e.preventDefault(); return; }
  ajustes.bienvenida = true; ajustes.terminos = TERMINOS; ajustes.terminosFecha = new Date().toISOString(); guardarAjustes();
  await tel.pedirPermisoMovimiento();
  if (ajustes.voz) encenderVoz();
  configurarAuto();
});
$("abrirGuia").addEventListener("click", () => { $("dlgAjustes").close(); abrirGuia(0); });

/* ---------- Qué hacer tras un choque ---------- */
document.querySelectorAll("[data-abrir-choque]").forEach((b) => b.addEventListener("click", () => {
  b.closest("dialog")?.close();
  $("dlgChoque").showModal();
}));
$("choqueProteger").addEventListener("click", () => proteger("Protegido desde la guía de choque"));
$("choqueFoto").addEventListener("click", () => foto());
$("choqueActa").addEventListener("click", () => { $("dlgChoque").close(); pestana = "bov"; pintarLista(); $("dlgBoveda").showModal(); });

/* ---------- Registro de eventos (pantalla) ---------- */
function pintarRegistro() {
  const lista = registro.listar().slice().reverse();
  $("registroNota").textContent = lista.length
    ? `${lista.length} evento(s) guardados en este teléfono (se conservan los últimos 500).`
    : "Aún no hay eventos. Aquí quedan los inicios, detenciones, impactos, protecciones, fotos y actas.";
  $("registroLista").innerHTML = lista.slice(0, 200).map((e) => `<li class="${e.tipo === "impacto" ? "imp" : ""}"><time>${esc(fechaHora(new Date(e.t)))}</time><span>${esc(TIPOS[e.tipo] || e.tipo)}</span><small>${esc([ORIGENES[e.origen] || e.origen, e.detalle].filter(Boolean).join(" · "))}</small></li>`).join("");
  $("registroExportar").disabled = $("registroBorrar").disabled = !lista.length;
}
$("abrirRegistro").addEventListener("click", () => { $("dlgAjustes").close(); pintarRegistro(); $("dlgRegistro").showModal(); });
$("registroExportar").addEventListener("click", () => {
  const blob = new Blob([registro.csv((t) => fechaHora(new Date(t)))], { type: "text/csv;charset=utf-8" });
  compartir(blob, `PVCar_registro_${fechaHora().slice(0, 10)}.csv`);
});
$("registroBorrar").addEventListener("click", () => { if (confirm("¿Borrar todo el registro de eventos?")) { registro.limpiar(); pintarRegistro(); } });

/* ---------- Inicio automático por velocidad ---------- */
const auto = new Autoarranque({ umbralKmh: ajustes.autoUmbral, minutosParada: ajustes.autoParada });
let ocupadoAuto = false;
async function revisarAuto() {
  if (!ajustes.autoInicio || !aceptoTerminos() || ocupadoAuto || document.visibilityState !== "visible") return;
  const accion = auto.actualizar({ velKmh: tel.estado.velKmh, ahora: Date.now(), grabando: grab.grabando, iniciadaPorAuto });
  if (!accion) return;
  ocupadoAuto = true;
  try { if (accion === "iniciar") await iniciarGrabacion("auto"); else await detenerGrabacion("auto"); }
  finally { ocupadoAuto = false; }
}
function configurarAuto() {
  auto.configurar({ umbralKmh: ajustes.autoUmbral, minutosParada: ajustes.autoParada });
  if (ajustes.autoInicio && aceptoTerminos()) { tel.iniciar(); mantenerPantalla(true); }
  else if (!grab.grabando) { tel.detener(); chip("chipGps", "apagado", "GPS <b>—</b>"); }
}
tel.addEventListener("cambio", revisarAuto);
setInterval(revisarAuto, 15000); // el GPS deja de avisar cuando el carro está quieto

(async function arrancar() {
  pintarRec();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  try { await navigator.storage?.persist?.(); } catch {}
  try {
    const n = await recuperarHuerfanos();
    if (n) avisar(`Se recuperaron ${n} clip(s) tras un cierre inesperado.`);
  } catch (err) {
    avisar(`No se pudo abrir el almacenamiento local (${err.message}). ¿Navegación privada?`, { tono: "mal" });
  }
  // Sella las evidencias que hayan quedado sin huella.
  for (const c of await db.listarClips().catch(() => [])) sellarSiCorresponde(c);
  pintarEspacio();
  if (!aceptoTerminos()) abrirGuia(0);
  else configurarAuto();
  if (aceptoTerminos() && ajustes.voz) {
    // Algunos navegadores solo permiten el micrófono tras un toque.
    document.addEventListener("pointerdown", () => encenderVoz(), { once: true });
  }
})();

// Gancho para pruebas automáticas (solo con ?prueba en la URL).
if (new URLSearchParams(location.search).has("prueba")) window.__pvcar = { grab, tel, db, voz, proteger, ajustes, registro, auto, revisarAuto };
