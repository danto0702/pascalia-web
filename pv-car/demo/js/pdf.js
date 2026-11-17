// Escritor de PDF mínimo (PDF 1.4) sin dependencias: texto Helvetica con
// acentos en español (WinAnsiEncoding), rectángulos, líneas e imágenes JPEG.
// Coordenadas en puntos con origen ARRIBA a la izquierda (se convierten).

export const A4 = { ancho: 595.28, alto: 841.89 };

const ESPECIALES = { "€": 0x80, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97 };

/** Convierte texto Unicode a bytes WinAnsi escapados para un literal PDF. */
export function winAnsi(texto) {
  let out = "";
  for (const ch of String(texto)) {
    let c = ch.codePointAt(0);
    if (ESPECIALES[ch]) c = ESPECIALES[ch];
    else if (c > 255 || (c < 32 && c !== 9)) c = 63; // «?»
    const s = String.fromCharCode(c);
    out += s === "(" || s === ")" || s === "\\" ? "\\" + s : s;
  }
  return out;
}

function latin1(str) {
  const b = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) b[i] = str.charCodeAt(i) & 0xff;
  return b;
}

const n2 = (v) => (Math.round(v * 100) / 100).toString();
function rgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => n2(parseInt(h.slice(i, i + 2), 16) / 255)).join(" ");
}

/** Ancho aproximado de un texto en Helvetica (para ajustar líneas). */
export function anchoTexto(texto, tam, negrita = false) {
  let w = 0;
  for (const ch of String(texto)) {
    if (ch === " ") w += 0.278;
    else if ("il.,;:'|!".includes(ch)) w += 0.25;
    else if ("mwMW@".includes(ch)) w += 0.85;
    else if (ch >= "A" && ch <= "Z") w += 0.67;
    else if (ch >= "0" && ch <= "9") w += 0.556;
    else w += 0.52;
  }
  return w * tam * (negrita ? 1.06 : 1);
}

/** Parte un texto en líneas que caben en `ancho` puntos. */
export function ajustar(texto, ancho, tam, negrita = false) {
  const lineas = [];
  for (const parrafo of String(texto).split("\n")) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/)) {
      if (!palabra) continue;
      const prueba = actual ? actual + " " + palabra : palabra;
      if (anchoTexto(prueba, tam, negrita) <= ancho || !actual) actual = prueba;
      else { lineas.push(actual); actual = palabra; }
    }
    lineas.push(actual);
  }
  return lineas;
}

class Pagina {
  constructor(doc) { this.doc = doc; this.ops = []; this.imgs = new Set(); }
  _y(y) { return A4.alto - y; }

  texto(x, y, str, { tam = 10, negrita = false, color = "#1F1F1F", mono = false } = {}) {
    const f = mono ? "F3" : negrita ? "F2" : "F1";
    this.ops.push(`BT /${f} ${n2(tam)} Tf ${rgb(color)} rg ${n2(x)} ${n2(this._y(y))} Td (${winAnsi(str)}) Tj ET`);
    return this;
  }

  /** Párrafo ajustado; devuelve la y siguiente. */
  parrafo(x, y, str, ancho, { tam = 10, negrita = false, color = "#1F1F1F", interlinea = 1.4, mono = false } = {}) {
    for (const l of ajustar(str, ancho, tam, negrita)) {
      this.texto(x, y, l, { tam, negrita, color, mono });
      y += tam * interlinea;
    }
    return y;
  }

  rect(x, y, w, h, { relleno = null, borde = null, grosor = 1 } = {}) {
    const parts = [];
    if (relleno) parts.push(`${rgb(relleno)} rg`);
    if (borde) parts.push(`${rgb(borde)} RG ${n2(grosor)} w`);
    parts.push(`${n2(x)} ${n2(this._y(y + h))} ${n2(w)} ${n2(h)} re ${relleno && borde ? "B" : relleno ? "f" : "S"}`);
    this.ops.push("q " + parts.join(" ") + " Q");
    return this;
  }

  linea(x1, y1, x2, y2, { color = "#E2DED3", grosor = 1 } = {}) {
    this.ops.push(`q ${rgb(color)} RG ${n2(grosor)} w ${n2(x1)} ${n2(this._y(y1))} m ${n2(x2)} ${n2(this._y(y2))} l S Q`);
    return this;
  }

  /** @param {{id:number}} img devuelto por doc.jpeg() */
  imagen(img, x, y, w, h) {
    this.imgs.add(img);
    this.ops.push(`q ${n2(w)} 0 0 ${n2(h)} ${n2(x)} ${n2(this._y(y + h))} cm /Im${img.n} Do Q`);
    return this;
  }
}

export class Pdf {
  constructor({ titulo = "Documento", autor = "PV Car · PascalIA" } = {}) {
    this.titulo = titulo; this.autor = autor;
    this.paginas = []; this.imagenes = [];
  }

  pagina() { const p = new Pagina(this); this.paginas.push(p); return p; }

  /** Registra un JPEG (Uint8Array) con su tamaño en píxeles. */
  jpeg(bytes, ancho, alto) {
    const img = { n: this.imagenes.length + 1, bytes, ancho, alto };
    this.imagenes.push(img);
    return img;
  }

  /** @returns {Uint8Array} */
  bytes(fecha = new Date()) {
    const chunks = [];
    const offsets = [];
    let pos = 0;
    const push = (b) => { const u = typeof b === "string" ? latin1(b) : b; chunks.push(u); pos += u.length; };

    // Numeración: 1 catálogo, 2 páginas, 3-5 fuentes, 6 info, luego imágenes, luego (página, contenido)*
    const nImg0 = 7;
    const nPag0 = nImg0 + this.imagenes.length;
    const total = nPag0 + this.paginas.length * 2 - 1;
    const objeto = (n, cuerpo) => { offsets[n] = pos; push(`${n} 0 obj\n`); for (const c of [].concat(cuerpo)) push(c); push("\nendobj\n"); };

    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
    const kids = this.paginas.map((_, i) => `${nPag0 + i * 2} 0 R`).join(" ");
    objeto(2, `<< /Type /Pages /Kids [${kids}] /Count ${this.paginas.length} >>`);
    objeto(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    objeto(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    objeto(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
    const f = fecha;
    const d = (v) => String(v).padStart(2, "0");
    const off = -f.getTimezoneOffset();
    const tz = `${off >= 0 ? "+" : "-"}${d(Math.floor(Math.abs(off) / 60))}'${d(Math.abs(off) % 60)}'`;
    const cd = `D:${f.getFullYear()}${d(f.getMonth() + 1)}${d(f.getDate())}${d(f.getHours())}${d(f.getMinutes())}${d(f.getSeconds())}${tz}`;
    objeto(6, `<< /Title (${winAnsi(this.titulo)}) /Author (${winAnsi(this.autor)}) /Producer (PV Car) /CreationDate (${cd}) >>`);

    this.imagenes.forEach((img, i) => {
      objeto(nImg0 + i, [
        `<< /Type /XObject /Subtype /Image /Width ${img.ancho} /Height ${img.alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`,
        img.bytes,
        "\nendstream",
      ]);
    });

    this.paginas.forEach((p, i) => {
      const nP = nPag0 + i * 2, nC = nP + 1;
      const xo = [...p.imgs].map((img) => `/Im${img.n} ${nImg0 + img.n - 1} 0 R`).join(" ");
      objeto(nP, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.ancho} ${A4.alto}] /Contents ${nC} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${xo ? ` /XObject << ${xo} >>` : ""} >> >>`);
      const contenido = latin1(p.ops.join("\n"));
      objeto(nC, [`<< /Length ${contenido.length} >>\nstream\n`, contenido, "\nendstream"]);
    });

    const xref = pos;
    let x = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
    for (let n = 1; n <= total; n++) x += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
    push(x);
    push(`trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

    const out = new Uint8Array(pos);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
}
