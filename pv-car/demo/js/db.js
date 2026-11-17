// Almacenamiento local en IndexedDB: es el «sandbox» /pbcar_loop/ de la app.
// Vive en el espacio privado del navegador para este sitio: nunca lee ni
// escribe en la galería, las fotos ni los archivos personales del teléfono.
//
// - `clips`:  metadatos de cada fragmento o foto (telemetría, eventos, hash).
// - `partes`: el video en trozos de pocos segundos, guardados según llegan.
//   Si el teléfono se apaga o se golpea a mitad de un fragmento, lo escrito
//   hasta ese momento queda en disco y se recupera al volver a abrir la app.
// Funciona igual en la página y en el worker que calcula el hash.

const NOMBRE = "pbcar_loop";
const VERSION = 1;
let conexion = null;

export function abrir() {
  if (conexion) return conexion;
  conexion = new Promise((ok, mal) => {
    const req = indexedDB.open(NOMBRE, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const clips = db.createObjectStore("clips", { keyPath: "id" });
      clips.createIndex("inicio", "inicio");
      db.createObjectStore("partes", { keyPath: ["clipId", "seq"] });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); conexion = null; };
      ok(db);
    };
    req.onerror = () => { conexion = null; mal(req.error); };
  });
  return conexion;
}

function hecho(tx) {
  return new Promise((ok, mal) => {
    tx.oncomplete = () => ok();
    tx.onabort = tx.onerror = () => mal(tx.error || new Error("Transacción abortada"));
  });
}
const resultado = (req) => new Promise((ok, mal) => { req.onsuccess = () => ok(req.result); req.onerror = () => mal(req.error); });
const rango = (id) => IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);

export async function guardarClip(meta) {
  const db = await abrir();
  const tx = db.transaction("clips", "readwrite");
  tx.objectStore("clips").put(meta);
  await hecho(tx);
  return meta;
}

export async function obtenerClip(id) {
  const db = await abrir();
  return resultado(db.transaction("clips").objectStore("clips").get(id));
}

/** Modifica un clip de forma atómica. `fn` recibe el clip y lo muta. */
export async function actualizarClip(id, fn) {
  const db = await abrir();
  const tx = db.transaction("clips", "readwrite");
  const st = tx.objectStore("clips");
  const clip = await resultado(st.get(id));
  if (!clip) { tx.abort(); return null; }
  fn(clip);
  st.put(clip);
  await hecho(tx);
  return clip;
}

/** Todos los clips, del más reciente al más antiguo. */
export async function listarClips() {
  const db = await abrir();
  const todos = await resultado(db.transaction("clips").objectStore("clips").getAll());
  return todos.sort((a, b) => b.inicio - a.inicio);
}

/** Guarda un trozo del video y suma su tamaño al clip en la misma transacción. */
export async function agregarParte(clipId, seq, blob) {
  const db = await abrir();
  const tx = db.transaction(["partes", "clips"], "readwrite");
  tx.objectStore("partes").put({ clipId, seq, blob });
  const st = tx.objectStore("clips");
  const clip = await resultado(st.get(clipId));
  if (clip) {
    clip.bytes = (clip.bytes || 0) + blob.size;
    clip.partes = Math.max(clip.partes || 0, seq + 1);
    clip.actualizado = Date.now();
    st.put(clip);
  }
  await hecho(tx);
}

/** Recorre los trozos en orden sin cargarlos todos a la vez. */
export async function* recorrerPartes(clipId) {
  const db = await abrir();
  const claves = await resultado(db.transaction("partes").objectStore("partes").getAllKeys(rango(clipId)));
  for (const k of claves) {
    const p = await resultado(db.transaction("partes").objectStore("partes").get(k));
    if (p) yield p.blob;
  }
}

/** Reconstruye el archivo completo (el navegador lo deja en disco, no en RAM). */
export async function archivoDe(clip) {
  const trozos = [];
  for await (const b of recorrerPartes(clip.id)) trozos.push(b);
  return new Blob(trozos, { type: clip.mime || "video/webm" });
}

export async function borrarClip(id) {
  const db = await abrir();
  const tx = db.transaction(["partes", "clips"], "readwrite");
  tx.objectStore("partes").delete(rango(id));
  tx.objectStore("clips").delete(id);
  await hecho(tx);
}
