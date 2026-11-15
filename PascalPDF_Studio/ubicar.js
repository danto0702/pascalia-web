// Ubicación de la firma en la firma en masa. Para cada PDF decide dónde va la firma, en este orden:
//   1. Campo de firma del PDF (AcroForm /Sig).
//   2. Palabra o frase que escribe la persona (p. ej. «Firma del contratista»).
//   3. Línea de firma «_____» cerca de palabras como Firma, Contratista, Supervisor o C.C.
//   4. Posición marcada por la persona en el primer documento.
//   5. Posición fija (página y esquina).
// Coordenadas en el espacio del PDF (origen abajo a la izquierda), como las usa pdf-lib.
(function () {
    'use strict';
    const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const PALABRAS_FIRMA = /firma|firmado|contratista|supervisor|representante|ordenador|interventor|c\.?\s?c\.?\b|cedula|nombre|aprob/;
    const LINEA = /_{5,}|\.{12,}|-{12,}/;

    // ------------------------------------------------------------------ lectura del PDF
    async function leerTexto(bytes) {
        if (!window.pdfjsLib) throw new Error('No se pudo cargar el lector de PDF.');
        if (typeof PDFJS_WORKER !== 'undefined') pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
        const paginas = [];
        for (let i = 1; i <= doc.numPages; i++) {
            const pg = await doc.getPage(i);
            const tc = await pg.getTextContent();
            const items = tc.items.filter(it => it.str && it.str.trim()).map(it => ({
                s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0,
                h: Math.abs(it.transform[3]) || it.height || 8
            }));
            paginas.push({ view: pg.view, rot: pg.rotate || 0, items, lineas: agrupar(items) });
            pg.cleanup();
        }
        doc.destroy();
        return paginas;
    }
    // Agrupa los textos en renglones (misma altura) ordenados de izquierda a derecha
    function agrupar(items) {
        const lineas = [];
        [...items].sort((a, b) => b.y - a.y || a.x - b.x).forEach(it => {
            const l = lineas.find(l => Math.abs(l.y - it.y) < Math.max(2.5, it.h * 0.35));
            if (l) l.items.push(it); else lineas.push({ y: it.y, h: it.h, items: [it] });
        });
        lineas.forEach(l => {
            l.items.sort((a, b) => a.x - b.x);
            let txt = '', mapa = [];
            l.items.forEach((it, k) => {
                if (k && it.x - (l.items[k - 1].x + l.items[k - 1].w) > it.h * 0.25) { txt += ' '; mapa.push(null); }
                for (let c = 0; c < it.s.length; c++) { mapa.push({ it, c }); }
                txt += it.s;
            });
            l.texto = txt; l.norm = sinTildes(txt); l.mapa = mapa;
            l.x0 = l.items[0].x; l.x1 = Math.max(...l.items.map(i => i.x + i.w));
            l.h = Math.max(...l.items.map(i => i.h));
        });
        return lineas;
    }
    const xDeCaracter = (l, idx) => {
        const m = l.mapa[Math.min(idx, l.mapa.length - 1)] || l.mapa.find(Boolean);
        if (!m) return l.x0;
        return m.it.x + (m.it.s.length ? m.it.w * m.c / m.it.s.length : 0);
    };

    // ------------------------------------------------------------------ 1. campo de firma del PDF
    async function campoFirma(bytes) {
        try {
            const pdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
            const form = pdf.getForm();
            const paginas = pdf.getPages();
            for (const f of form.getFields()) {
                if (!(f instanceof PDFLib.PDFSignature)) continue;
                for (const w of f.acroField.getWidgets()) {
                    const r = w.getRectangle();
                    if (!r || r.width < 10 || r.height < 5) continue;
                    const pref = w.P();
                    let idx = paginas.findIndex(p => p.ref === pref);
                    if (idx < 0) idx = paginas.findIndex(p => { const an = p.node.Annots(); return an && an.asArray().some(a => a === pdf.context.getObjectRef(w.dict)); });
                    if (idx < 0) idx = paginas.length - 1;
                    return { pagina: idx, tipo: 'campo', x: r.x, y: r.y, w: r.width, h: r.height, metodo: 'Campo de firma del PDF', detalle: f.getName() };
                }
            }
        } catch (e) { /* sin formulario legible */ }
        return null;
    }

    // ------------------------------------------------------------------ 2. palabra o frase
    function porPalabra(paginas, palabra) {
        const buscada = sinTildes(palabra).trim();
        if (!buscada) return null;
        for (let p = paginas.length - 1; p >= 0; p--) {
            const { lineas } = paginas[p];
            for (let k = lineas.length - 1; k >= 0; k--) {
                const l = lineas[k];
                const i = l.norm.lastIndexOf(buscada);
                if (i < 0) continue;
                const x = xDeCaracter(l, i);
                // «Firma: ________» en el mismo renglón: la firma va sobre la línea
                const resto = l.texto.slice(i + buscada.length);
                const m = resto.match(LINEA);
                if (m) {
                    const ini = i + buscada.length + m.index;
                    const xl = xDeCaracter(l, ini), xf = xDeCaracter(l, ini + m[0].length);
                    return { pagina: p, tipo: 'linea', x: xl, y: l.y, w: Math.max(80, xf - xl), metodo: `Palabra «${palabra}»`, detalle: 'sobre la línea del mismo renglón' };
                }
                // Línea de firma justo encima (lo usual: línea, y debajo el nombre o «Firma»)
                const arriba = lineas.filter(o => o.y > l.y && o.y - l.y < 45 && LINEA.test(o.texto) && o.x1 > x - 40 && o.x0 < x + 220).sort((a, b) => a.y - b.y)[0];
                if (arriba) {
                    const mm = arriba.texto.match(LINEA);
                    const xl = xDeCaracter(arriba, mm.index), xf = xDeCaracter(arriba, mm.index + mm[0].length);
                    return { pagina: p, tipo: 'linea', x: xl, y: arriba.y, w: Math.max(80, xf - xl), metodo: `Palabra «${palabra}»`, detalle: 'sobre la línea de firma de arriba' };
                }
                // Sin línea: la firma va encima de la palabra
                return { pagina: p, tipo: 'linea', x, y: l.y + l.h + 2, w: 170, metodo: `Palabra «${palabra}»`, detalle: 'encima de la palabra' };
            }
        }
        return null;
    }

    // ------------------------------------------------------------------ 2b. bloque de firma con el nombre
    // Distingue el nombre del bloque de firma de las menciones en el texto: el nombre va solo en su
    // renglón, con el cargo (u otro dato) justo debajo y espacio libre o una línea encima.
    function porNombre(paginas, cfg) {
        const nombre = sinTildes(cfg.nombre).replace(/\s+/g, ' ').trim();
        if (nombre.length < 4) return null;
        const cargo = sinTildes(cfg.cargo || '').replace(/\s+/g, ' ').trim();
        let mejor = null;
        paginas.forEach((pg, p) => {
            const { lineas } = pg;
            lineas.forEach(l => {
                const norm = l.norm.replace(/\s+/g, ' ');
                const i = norm.indexOf(nombre);
                if (i < 0) return;
                const xi = xDeCaracter(l, l.norm.indexOf(nombre.split(' ')[0]));
                const xf = xDeCaracter(l, Math.min(l.mapa.length - 1, l.norm.indexOf(nombre.split(' ')[0]) + nombre.length));
                const solo = norm.replace(nombre, '').replace(/[^a-z0-9]/g, '').length <= 6;
                // Renglón justo debajo que se cruza horizontalmente con el nombre
                const debajo = lineas.filter(o => o.y < l.y && l.y - o.y < Math.max(26, l.h * 2.4) && o.x1 > xi - 40 && o.x0 < xf + 40).sort((a, b) => b.y - a.y)[0];
                if (cargo && !(debajo && debajo.norm.replace(/\s+/g, ' ').includes(cargo))) return; // el cargo es obligatorio si se configuró
                let puntos = 0;
                if (solo) puntos += 3;
                if (cargo) puntos += 4;
                else if (debajo && (debajo.texto.length < 60 || PALABRAS_FIRMA.test(debajo.norm))) puntos += 2;
                // Encima: una línea de firma cercana, o espacio libre para la firma
                const arriba = lineas.filter(o => o.y > l.y && o.y - l.y < 60 && o.x1 > xi - 30 && o.x0 < xf + 30).sort((a, b) => a.y - b.y);
                const linea = arriba.find(o => o.y - l.y < 36 && LINEA.test(o.texto));
                if (linea) puntos += 3;
                else if (!arriba.length || arriba[0].y - l.y > 34) puntos += 2;
                if (!cargo && puntos < 3) return; // una mención dentro de un párrafo no basta
                const cand = { p, l, xi, xf, linea, puntos, orden: p * 10000 - l.y };
                if (!mejor || cand.puntos > mejor.puntos || (cand.puntos === mejor.puntos && cand.orden > mejor.orden)) mejor = cand;
            });
        });
        if (!mejor) return null;
        const { p, l, xi, xf, linea } = mejor;
        const detalle = cfg.cargo ? `sobre «${cfg.nombre}» con «${cfg.cargo}» debajo` : `sobre «${cfg.nombre}»`;
        if (linea && (cfg.lado || 'encima') === 'encima') {
            const m = linea.texto.match(LINEA);
            const xl = xDeCaracter(linea, m.index), xr = xDeCaracter(linea, m.index + m[0].length);
            return { pagina: p, tipo: 'linea', x: xl, y: linea.y, w: Math.max(80, xr - xl), metodo: 'Bloque de firma (nombre)', detalle };
        }
        const anchoNombre = Math.max(60, xf - xi);
        if (cfg.lado === 'izquierda') return { pagina: p, tipo: 'linea', x: Math.max(paginas[p].view[0] + 12, xi - 178), y: l.y - 6, w: 170, datos: 'arriba', metodo: 'Bloque de firma (nombre)', detalle: detalle + ', a la izquierda' };
        if (cfg.lado === 'derecha') return { pagina: p, tipo: 'linea', x: xf + 8, y: l.y - 6, w: 170, datos: 'arriba', metodo: 'Bloque de firma (nombre)', detalle: detalle + ', a la derecha' };
        const w = Math.max(150, anchoNombre);
        return { pagina: p, tipo: 'linea', x: xi + anchoNombre / 2 - w / 2, y: l.y + l.h + 2, w, metodo: 'Bloque de firma (nombre)', detalle };
    }

    // ------------------------------------------------------------------ 3. línea de firma «____»
    function porLinea(paginas) {
        for (let p = paginas.length - 1; p >= 0; p--) {
            const { lineas } = paginas[p];
            const candidatas = [];
            lineas.forEach(l => {
                const m = l.texto.match(LINEA);
                if (!m) return;
                const xl = xDeCaracter(l, m.index), xf = xDeCaracter(l, m.index + m[0].length);
                if (xf - xl < 60) return;
                // Palabras de firma en el mismo renglón o hasta 45 pt por debajo, cerca horizontalmente
                const cerca = lineas.filter(o => (o === l || (o.y < l.y && l.y - o.y < 45)) && o.x1 > xl - 60 && o.x0 < xf + 60);
                const etiqueta = cerca.find(o => PALABRAS_FIRMA.test(o === l ? sinTildes(l.texto.replace(m[0], ' ')) : o.norm));
                if (etiqueta) candidatas.push({ l, xl, xf, etiqueta: etiqueta.texto.trim().slice(0, 40) });
            });
            if (candidatas.length) {
                // La más baja de la página (las firmas suelen ir al final)
                const c = candidatas.sort((a, b) => a.l.y - b.l.y)[0];
                return { pagina: p, tipo: 'linea', x: c.xl, y: c.l.y, w: c.xf - c.xl, metodo: 'Línea de firma', detalle: `junto a «${c.etiqueta}»` };
            }
        }
        return null;
    }

    // ------------------------------------------------------------------ 4 y 5. marcada y fija
    function marcada(paginas, marca, nPaginas) {
        const p = marca.pagina === 'ultima' ? nPaginas - 1 : Math.min(marca.pagina, nPaginas - 1);
        const v = paginas[p] ? paginas[p].view : [0, 0, 612, 792];
        const W = v[2] - v[0], H = v[3] - v[1];
        return { pagina: p, tipo: 'apilado', x: v[0] + marca.fx * W, yTop: v[3] - marca.fy * H, metodo: 'Posición marcada', detalle: marca.pagina === 'ultima' ? 'última página' : `página ${p + 1}` };
    }
    function fija(paginas, ops, nPaginas) {
        const idxs = ops.pagina === 'todas' ? [...Array(nPaginas).keys()] : [ops.pagina === 'primera' ? 0 : nPaginas - 1];
        return idxs.map(p => {
            const v = paginas[p] ? paginas[p].view : [0, 0, 612, 792];
            return { pagina: p, tipo: 'fija', lugar: ops.lugar, view: v, metodo: 'Posición fija', detalle: `${ops.pagina === 'todas' ? 'todas las páginas' : ops.pagina + ' página'}, abajo ${ops.lugar === 'centro' ? 'al centro' : 'a la ' + ops.lugar}` };
        });
    }

    // Decide la ubicación de un documento. Devuelve una lista (la posición fija puede ir en varias páginas)
    async function localizar(bytes, op) {
        let paginas = [];
        try { paginas = await leerTexto(bytes); } catch (e) { paginas = []; }
        const n = paginas.length || (await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount();
        const sinTexto = !paginas.some(p => p.items.length);
        if (op.modo === 'marcada' && op.marca) return [marcada(paginas, op.marca, n)];
        if (op.modo === 'fija') return fija(paginas, op.fija, n);
        const r = (await campoFirma(bytes)) || (op.bloque && op.bloque.activo ? porNombre(paginas, op.bloque) : null)
            || (op.palabra ? porPalabra(paginas, op.palabra) : null) || porLinea(paginas);
        if (r) return [r];
        if (op.marca) return [{ ...marcada(paginas, op.marca, n), aviso: sinTexto ? 'sin texto (imagen)' : 'no se encontró el campo' }];
        return fija(paginas, op.fija, n).map(u => ({ ...u, aviso: sinTexto ? 'sin texto (imagen)' : 'no se encontró el campo' }));
    }

    // ------------------------------------------------------------------ dibujar la firma en la ubicación
    // Bloque de datos: ancho fijo; altura según las líneas (nombre, fecha, objeto, radicado, consecutivo)
    function estamparEn(page, u, img, fuente, datos, winAnsi) {
        const { width: W0, height: H0 } = page.getSize();
        const box = page.getCropBox ? page.getCropBox() : { x: 0, y: 0, width: W0, height: H0 };
        const W = box.width, H = box.height, X0 = box.x, Y0 = box.y;
        // PascalSello.pdf da coordenadas desde la parte de arriba del bloque: se pasan a coordenadas del PDF
        const dibujarDatos = (anchoDatos, x, yTop) => PascalSello.pdf({
            texto: (t, tx, ty, size, font, color) => page.drawText(t, { x: tx, y: yTop - ty - size, size, font, color }),
            rect: () => {}
        }, { regular: fuente }, x, 0, anchoDatos, datos, winAnsi);
        if (u.tipo === 'fija' || u.tipo === 'apilado') {
            const ancho = Math.min(210, W * 0.38), margen = Math.max(24, W * 0.05);
            const k = Math.min(ancho / img.width, 56 / img.height);
            const iw = img.width * k, ih = img.height * k;
            const altoDatos = PascalSello.alto(ancho, datos);
            let x, top;
            if (u.tipo === 'fija') {
                x = X0 + (u.lugar === 'izquierda' ? margen : u.lugar === 'centro' ? (W - ancho) / 2 : W - margen - ancho);
                top = Y0 + margen + ih + 4 + altoDatos;
            } else {
                x = Math.min(X0 + W - ancho - 4, Math.max(X0 + 4, u.x));
                top = Math.min(Y0 + H - 4, Math.max(Y0 + ih + altoDatos + 8, u.yTop));
            }
            const centrar = u.tipo === 'fija' && u.lugar === 'centro' ? (ancho - iw) / 2 : 0;
            page.drawImage(img, { x: x + centrar, y: top - ih, width: iw, height: ih });
            dibujarDatos(ancho, x, top - ih - 4);
            return;
        }
        // Sobre una línea o dentro de un campo: la imagen de la firma se apoya en la línea
        const anchoFirma = Math.max(90, Math.min(170, u.w || 150));
        const altoMax = u.tipo === 'campo' ? Math.max(18, u.h - 2) : 52;
        const k = Math.min(anchoFirma / img.width, altoMax / img.height);
        const iw = img.width * k, ih = img.height * k;
        const base = u.y + 1;
        const xImg = u.tipo === 'campo' ? u.x + (u.w - iw) / 2 : u.x + Math.max(0, ((u.w || iw) - iw) / 2);
        page.drawImage(img, { x: xImg, y: base, width: iw, height: ih });
        // Datos a la derecha de la firma si caben; si no, encima de la firma
        const anchoDatos = 190;
        const altoDatos = PascalSello.alto(anchoDatos, datos);
        const derecha = Math.max(xImg + iw, u.x + (u.w || 0)) + 8;
        if (u.datos !== 'arriba' && derecha + anchoDatos <= X0 + W - 12) dibujarDatos(anchoDatos, derecha, base + Math.max(ih, altoDatos));
        else dibujarDatos(anchoDatos, Math.max(X0 + 12, Math.min(xImg, X0 + W - anchoDatos - 12)), base + ih + 4 + altoDatos);
    }

    // ------------------------------------------------------------------ vista previa y marcar posición
    async function renderPagina(bytes, pagina, maxW) {
        const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
        const pg = await doc.getPage(pagina + 1);
        const v1 = pg.getViewport({ scale: 1 });
        const vp = pg.getViewport({ scale: Math.min(2, (maxW || 520) / v1.width) * (window.devicePixelRatio > 1 ? 1.5 : 1) });
        const c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height;
        await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        const info = { canvas: c, escala: vp.scale, view: pg.view, n: doc.numPages };
        doc.destroy();
        return info;
    }
    // Rectángulo aproximado que ocupará la firma (para la vista previa), en coordenadas del canvas
    function cajaPrevia(u, info) {
        const s = info.escala, [x0, , , y1] = info.view, W = info.view[2] - x0, H = y1 - info.view[1];
        const aCanvas = (x, y) => [(x - x0) * s, (y1 - y) * s];
        if (u.tipo === 'fija' || u.tipo === 'apilado') {
            const ancho = Math.min(210, W * 0.38), margen = Math.max(24, W * 0.05), alto = 110;
            let x, top;
            if (u.tipo === 'fija') { x = x0 + (u.lugar === 'izquierda' ? margen : u.lugar === 'centro' ? (W - ancho) / 2 : W - margen - ancho); top = info.view[1] + margen + alto; }
            else { x = u.x; top = u.yTop; }
            const [cx, cy] = aCanvas(x, top);
            return [cx, cy, ancho * s, alto * s];
        }
        const w = Math.max(90, Math.min(170, u.w || 150)), h = u.tipo === 'campo' ? u.h : 52;
        const [cx, cy] = aCanvas(u.x, u.y + h);
        return [cx, cy, (u.tipo === 'campo' ? u.w : w) * s, h * s];
    }
    async function vistaPrevia(bytes, u) {
        const info = await renderPagina(bytes, u.pagina, 560);
        const ctx = info.canvas.getContext('2d');
        const [x, y, w, h] = cajaPrevia(u, info);
        ctx.fillStyle = 'rgba(255, 193, 7, .28)'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#B45309'; ctx.lineWidth = Math.max(2, info.escala * 1.5); ctx.setLineDash([8, 5]); ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]); ctx.fillStyle = '#92400E'; ctx.font = `600 ${Math.round(12 * info.escala)}px Inter, sans-serif`;
        ctx.fillText('Firma', x + 6 * info.escala, y + 15 * info.escala);
        return info.canvas;
    }

    // Pantalla para marcar en el primer documento dónde va la firma (arrastrando un recuadro)
    function marcar(bytes, nombre) {
        return new Promise(async (resolve) => {
            const capa = document.createElement('div');
            capa.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(20,20,20,.86);display:flex;flex-direction:column;align-items:center;padding:14px;gap:10px;font:14px Inter,system-ui,sans-serif;color:#fff;overflow:auto';
            capa.innerHTML = `<div style="max-width:620px;text-align:center"><b style="font:800 16px Montserrat,Inter,sans-serif">Marca dónde va la firma</b><br>Arrastra el recuadro amarillo sobre «${(nombre || 'el documento').replace(/[<>&"]/g, '')}». Esa posición se usará en los documentos donde no se encuentre el campo de firma.</div>
                <div style="display:flex;gap:8px;align-items:center"><button data-ant style="min-height:40px;padding:0 14px;border-radius:999px;border:0;background:#333;color:#fff">‹ Página</button><span data-pag></span><button data-sig style="min-height:40px;padding:0 14px;border-radius:999px;border:0;background:#333;color:#fff">Página ›</button></div>
                <div data-lienzo style="position:relative;max-width:min(560px,94vw);touch-action:none"></div>
                <div style="display:flex;gap:10px;padding-bottom:10px"><button data-cancelar style="min-height:46px;padding:0 20px;border-radius:999px;border:1px solid #555;background:#222;color:#fff;font:700 14px Montserrat,Inter,sans-serif">Cancelar</button><button data-usar style="min-height:46px;padding:0 24px;border-radius:999px;border:0;background:#FFC107;color:#1F1F1F;font:700 14px Montserrat,Inter,sans-serif">Usar esta posición</button></div>`;
            document.body.appendChild(capa);
            const lienzo = capa.querySelector('[data-lienzo]');
            let pagina = null, total = 1, info = null, caja = null, pos = { fx: 0.55, fy: 0.72 };
            async function mostrar(p) {
                info = await renderPagina(bytes, p, Math.min(560, innerWidth * 0.94));
                total = info.n; pagina = p;
                capa.querySelector('[data-pag]').textContent = `Página ${p + 1} de ${total}${p === total - 1 ? ' (última)' : ''}`;
                info.canvas.style.cssText = 'width:100%;height:auto;display:block;border-radius:6px;background:#fff';
                lienzo.innerHTML = '';
                lienzo.appendChild(info.canvas);
                const W = info.view[2] - info.view[0], H = info.view[3] - info.view[1];
                caja = document.createElement('div');
                caja.style.cssText = `position:absolute;width:${Math.min(210, W * 0.38) / W * 100}%;height:${110 / H * 100}%;border:2px dashed #B45309;background:rgba(255,193,7,.35);border-radius:6px;cursor:move;display:flex;align-items:center;justify-content:center;color:#78350F;font-weight:700;touch-action:none`;
                caja.textContent = 'Firma';
                const ubicar = () => { caja.style.left = pos.fx * 100 + '%'; caja.style.top = pos.fy * 100 + '%'; };
                ubicar();
                lienzo.appendChild(caja);
                caja.onpointerdown = (e) => {
                    e.preventDefault();
                    caja.setPointerCapture(e.pointerId);
                    const r = lienzo.getBoundingClientRect(), cw = caja.offsetWidth / r.width, ch = caja.offsetHeight / r.height;
                    const dx = e.clientX - caja.getBoundingClientRect().left, dy = e.clientY - caja.getBoundingClientRect().top;
                    caja.onpointermove = (ev) => {
                        pos.fx = Math.min(1 - cw, Math.max(0, (ev.clientX - r.left - dx) / r.width));
                        pos.fy = Math.min(1 - ch, Math.max(0, (ev.clientY - r.top - dy) / r.height));
                        ubicar();
                    };
                    caja.onpointerup = () => { caja.onpointermove = null; };
                };
            }
            capa.querySelector('[data-ant]').onclick = () => { if (pagina > 0) mostrar(pagina - 1); };
            capa.querySelector('[data-sig]').onclick = () => { if (pagina < total - 1) mostrar(pagina + 1); };
            capa.querySelector('[data-cancelar]').onclick = () => { capa.remove(); resolve(null); };
            capa.querySelector('[data-usar]').onclick = () => { capa.remove(); resolve({ pagina: pagina === total - 1 ? 'ultima' : pagina, fx: pos.fx, fy: pos.fy }); };
            try {
                const d = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
                await mostrar(d.getPageCount() - 1);
            } catch (e) { capa.remove(); resolve(null); }
        });
    }

    window.PascalUbicar = { localizar, estamparEn, vistaPrevia, marcar, leerTexto };
})();
