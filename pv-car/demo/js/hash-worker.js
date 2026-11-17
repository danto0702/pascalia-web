// Calcula el SHA-256 de un clip fuera del hilo principal, para no
// interrumpir la grabación ni el dibujo de la telemetría.
import { Sha256 } from "./sha256.js";
import { recorrerPartes } from "./db.js";

self.onmessage = async (e) => {
  const { id } = e.data;
  try {
    const h = new Sha256();
    let bytes = 0;
    for await (const blob of recorrerPartes(id)) {
      // Se lee en ventanas de 4 MB para no reservar todo el trozo de una vez.
      for (let o = 0; o < blob.size; o += 4 << 20) {
        const buf = new Uint8Array(await blob.slice(o, o + (4 << 20)).arrayBuffer());
        h.update(buf);
        bytes += buf.length;
      }
    }
    self.postMessage({ id, hash: h.hex(), bytes });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
