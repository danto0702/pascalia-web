// PV Car · orquestación de la interfaz.
import * as db from "./db.js";
import { Grabador, recuperarHuerfanos, mimeSoportado, fechaHora, coordenadas } from "./grabador.js";
import { Telemetria, SENSIBILIDAD } from "./telemetria.js";
import { Voz, vozDisponible } from "./voz.js";
import { ACCIONES } from "./comandos.js";
import { horasDeGrabacion, formatoHoras, formatoBytes, GB, RESOLUCIONES } from "./fifo.js";
import { generarActa, fotogramaDeArchivo, nombreArchivo } from "./acta.js";

const $ = (id) => document.getElementById(id);
const CLAVE = "pvcar_ajustes";
const PREDETERMINADOS = { cuotaGB: 16, resolucion: "1080p", minutos: 3, sensibilidad: "media", voz: true, tts: true, audio: false, placa: "", nombre: "", documento: "", bienvenida: false };

function leerAjustes() {
  try { return { ...PREDETERMINADOS, ...JSON.parse(localStorage.getItem(CLAVE) || "{}") }; } catch { return { ...PREDETERMINADOS }; }
}
let ajustes = leerAjustes();
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
const vibrar = (p) => { try { navigator.vibrate?.(p); } catch {} };

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
  chip("chipEspacio", pct > 90 ? "alerta" : "ok", `Bucle <b>${formatoBytes(usados)} / ${ajustes.cuotaGB} GB</b>`);
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
async function iniciarGrabacion() {
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
  inicioSesion = Date.now();
  mantenerPantalla(true);
  pintarRec();
  if (ajustes.voz) encenderVoz();
  avisar("Grabación activada", { hablar: true });
}

async function detenerGrabacion() {
  if (!grab.grabando) return;
  await grab.detener();
  grab.apagarCamara();
  tel.detener();
  chip("chipGps", "apagado", "GPS <b>—</b>");
  chip("chipG", "apagado", "G <b>—</b>");
  mantenerPantalla(false);
  salirAhorro();
  pintarRec();
  pintarEspacio();
  avisar("Grabación detenida", { hablar: true });
}

async function proteger(motivo = "Protegido por el conductor", extra = {}) {
  const ids = await grab.proteger(motivo, extra);
  if (!ids.length) {
    const ult = (await db.listarClips()).find((c) => c.tipo === "video" && !c.protegido);
    if (ult) { await db.actualizarClip(ult.id, (c) => { c.protegido = true; c.eventos = [...(c.eventos || []), { t: Date.now(), motivo }]; }); sellarSiCorresponde(await db.obtenerClip(ult.id)); ids.push(ult.id); }
  }
  if (!ids.length) return avisar("No hay un clip para proteger todavía.", { hablar: true });
  vibrar([60, 40, 60]);
  avisar(ids.length > 1 ? "Video protegido en la bóveda, con los segundos previos." : "Video protegido en la bóveda.", { hablar: true });
  pintarEspacio();
}

async function foto() {
  try {
    const { meta, blob } = await grab.foto();
    if (!grab.grabando) { grab.apagarCamara(); pintarRec(); } // no dejar la cámara encendida
    descargar(blob, nombreArchivo(meta));
    vibrar(40);
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
    case ACCIONES.iniciar: return iniciarGrabacion();
    case ACCIONES.detener: return detenerGrabacion();
    case ACCIONES.proteger: return proteger("Comando de voz");
    case ACCIONES.foto: return foto();
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
  await proteger("Impacto detectado", { g: e.detail.g });
});
grab.addEventListener("cerrado", (e) => { sellarSiCorresponde(e.detail); pintarEspacio(); if ($("dlgBoveda").open) pintarLista(); });
grab.addEventListener("fragmento", () => pintarEspacio());
grab.addEventListener("sin-espacio", () => {
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
  if (ajustes.voz && !voz.activa && ajustes.bienvenida) encenderVoz();
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

/* ---------- Bóveda ---------- */
let pestana = "prot";
$("tabProt").addEventListener("click", () => { pestana = "prot"; pintarLista(); });
$("tabBucle").addEventListener("click", () => { pestana = "bucle"; pintarLista(); });

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.rel = "noopener";
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
async function compartir(blob, nombre) {
  const f = new File([blob], nombre, { type: blob.type });
  if (navigator.canShare?.({ files: [f] })) {
    try { await navigator.share({ files: [f], title: nombre }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  descargar(blob, nombre);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function duracion(c) {
  if (c.tipo === "foto") return "Foto";
  const s = Math.round(((c.fin || Date.now()) - c.inicio) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} min`;
}

async function pintarLista() {
  const { clips, usados, cuota } = await pintarEspacio();
  const prot = clips.filter((c) => c.protegido), bucle = clips.filter((c) => !c.protegido);
  $("nProt").textContent = prot.length; $("nBucle").textContent = bucle.length;
  $("tabProt").setAttribute("aria-selected", String(pestana === "prot"));
  $("tabBucle").setAttribute("aria-selected", String(pestana === "bucle"));
  $("lista").setAttribute("aria-labelledby", pestana === "prot" ? "tabProt" : "tabBucle");
  const bytesProt = prot.reduce((a, c) => a + c.bytes, 0);
  $("notaLista").textContent = pestana === "prot"
    ? `La bóveda nunca se recicla. Ocupa ${formatoBytes(bytesProt)} de la cuota de ${ajustes.cuotaGB} GB.`
    : `Estos clips se borran solos, del más antiguo al más reciente, cuando el bucle llega a ${ajustes.cuotaGB} GB (usados: ${formatoBytes(usados)}, ${Math.round((usados / cuota) * 100)} %).`;
  const items = pestana === "prot" ? prot : bucle;
  const ul = $("lista");
  if (!items.length) {
    ul.innerHTML = `<li class="vacio">${pestana === "prot" ? "Aún no hay evidencias protegidas. Un golpe fuerte, el botón Proteger o «Okay Pascal, guarda este video» las envían aquí." : "El bucle está vacío. Toca Grabar para empezar."}</li>`;
    return;
  }
  ul.innerHTML = items.map((c) => {
    const ins = c.estado === "grabando" ? '<span class="insignia rec">Grabando</span>' : c.protegido ? '<span class="insignia prot">Protegido</span>' : c.estado === "recuperado" ? '<span class="insignia">Recuperado</span>' : "";
    const evento = c.eventos?.length ? ` · ${esc(c.eventos.at(-1).motivo)}` : "";
    const hash = c.protegido ? `<p class="hash">${c.hash ? "SHA-256 " + c.hash : c.estado === "grabando" ? "Se sellará al cerrar el fragmento" : "Calculando huella SHA-256…"}</p>` : "";
    const listo = c.estado !== "grabando";
    return `<li class="clip${c.protegido ? " prot" : ""}" data-id="${esc(c.id)}">
      <h3>${esc(fechaHora(new Date(c.inicio)))}</h3>${ins}
      <p class="meta">${duracion(c)} · ${formatoBytes(c.bytes)} · ${esc(RESOLUCIONES[c.resolucion]?.etiqueta || `${c.ancho}×${c.alto}`)}${evento}</p>${hash}
      <div class="botones">${listo ? `
        <button type="button" data-a="ver">Ver</button>
        <button type="button" data-a="compartir">Guardar / compartir</button>
        ${c.protegido ? '<button type="button" class="dest" data-a="acta">Acta PDF</button><button type="button" data-a="desproteger">Quitar protección</button>' : '<button type="button" class="dest" data-a="proteger">Proteger</button>'}
        <button type="button" class="mal" data-a="borrar">Borrar</button>` : ""}
      </div></li>`;
  }).join("");
}

$("lista").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-a]"); if (!b) return;
  const id = b.closest("[data-id]").dataset.id;
  const clip = await db.obtenerClip(id); if (!clip) return pintarLista();
  const a = b.dataset.a;
  if (a === "ver") return ver(clip);
  if (a === "compartir") return compartir(await db.archivoDe(clip), nombreArchivo(clip));
  if (a === "acta") return abrirActa(clip);
  if (a === "proteger") {
    await db.actualizarClip(id, (c) => { c.protegido = true; c.eventos = [...(c.eventos || []), { t: Date.now(), motivo: "Protegido desde la lista" }]; });
    sellarSiCorresponde(await db.obtenerClip(id));
  }
  if (a === "desproteger" && confirm("Este clip volverá al bucle y podrá borrarse cuando se llene la memoria. ¿Continuar?")) {
    await db.actualizarClip(id, (c) => { c.protegido = false; });
  }
  if (a === "borrar" && confirm(clip.protegido ? "Es una evidencia protegida. ¿Borrarla para siempre?" : "¿Borrar este clip?")) {
    await db.borrarClip(id);
  }
  pintarLista();
});

let urlVer = null;
async function ver(clip) {
  if (urlVer) URL.revokeObjectURL(urlVer);
  urlVer = URL.createObjectURL(await db.archivoDe(clip));
  $("tVer").textContent = fechaHora(new Date(clip.inicio));
  $("verMedio").innerHTML = clip.tipo === "foto" ? `<img src="${urlVer}" alt="Foto tomada el ${esc(fechaHora(new Date(clip.inicio)))}">` : `<video src="${urlVer}" controls playsinline></video>`;
  const t = clip.telemetria || [];
  const conPos = t.find((m) => m.lat !== null);
  const vmax = Math.max(0, ...t.map((m) => m.vel || 0));
  const gmax = Math.max(0, ...t.map((m) => m.g || 0));
  const filas = [
    ["Archivo", nombreArchivo(clip)], ["Tamaño", formatoBytes(clip.bytes)], ["Duración", duracion(clip)],
    ["Posición", conPos ? coordenadas(conPos.lat, conPos.lon) : "Sin GPS"], ["Vel. máx.", `${vmax} km/h`], ["G máx.", `${gmax.toFixed(2)} G`],
    ...(clip.eventos || []).map((e) => [fechaHora(new Date(e.t)).slice(11), e.motivo]),
    ...(clip.hash ? [["SHA-256", clip.hash]] : []),
  ];
  $("verDatos").innerHTML = filas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  $("dlgVer").showModal();
}
$("dlgVer").addEventListener("close", () => { $("verMedio").innerHTML = ""; if (urlVer) URL.revokeObjectURL(urlVer); urlVer = null; });

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
  });
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
$("acepto").addEventListener("change", (e) => { $("btnEmpezar").disabled = !e.target.checked; });
$("formBienv").addEventListener("submit", async () => {
  ajustes.bienvenida = true; guardarAjustes();
  await tel.pedirPermisoMovimiento();
  if (ajustes.voz) encenderVoz();
});

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
  if (!ajustes.bienvenida) $("dlgBienvenida").showModal();
  else if (ajustes.voz) {
    // Algunos navegadores solo permiten el micrófono tras un toque.
    document.addEventListener("pointerdown", () => encenderVoz(), { once: true });
  }
})();

// Gancho para pruebas automáticas (solo con ?prueba en la URL).
if (new URLSearchParams(location.search).has("prueba")) window.__pvcar = { grab, tel, db, voz, proteger, ajustes };
