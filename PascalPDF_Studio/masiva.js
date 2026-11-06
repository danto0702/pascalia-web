// Firma en masa: un lote de PDF o Word se firma con la misma firma y el mismo objeto.
// Cada documento recibe su propio consecutivo (asignado por el servidor) y su registro en el historial.
// Todo se procesa en el navegador; los documentos no se suben a ningún servidor.
(function () {
    'use strict';
    if (!window.PascalCuenta || !window.PascalSello) return;
    const { api } = PascalCuenta;
    const { hoja, aviso, esc, toast, conBoton } = PascalCuenta.ui;
    const MAX_ARCHIVOS = 200, MAX_MB = 30;
    const LIBS = {
        jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
        docx: 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.7/dist/docx-preview.min.js',
        h2c: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    };
    const cargadas = {};
    function cargar(url) {
        return cargadas[url] || (cargadas[url] = new Promise((ok, mal) => {
            const s = document.createElement('script');
            s.src = url; s.onload = ok; s.onerror = () => { delete cargadas[url]; mal(new Error('No se pudo cargar una librería. Revisa tu conexión.')); };
            document.head.appendChild(s);
        }));
    }
    const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    const huella = async (bytes) => hex(await crypto.subtle.digest('SHA-256', bytes));
    const winAnsi = (t) => String(t).normalize('NFC').replace(/[^\x20-\x7E\xA0-\xFF—–‘’“”…•€]/g, '?');
    const base = (n) => n.replace(/\.(pdf|docx)$/i, '').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Documento';

    // ------------------------------------------------------------------ Word → PDF (en el navegador)
    // Se dibuja el documento con docx-preview y se pasa a imágenes de página: el resultado conserva el
    // aspecto del Word, pero el texto del PDF no se puede seleccionar.
    async function wordAPdf(file) {
        await cargar(LIBS.jszip); await cargar(LIBS.docx); await cargar(LIBS.h2c);
        const caja = document.createElement('div');
        caja.style.cssText = 'position:fixed;left:-20000px;top:0;background:#fff;color:#000';
        document.body.appendChild(caja);
        try {
            await window.docx.renderAsync(file, caja, null, { inWrapper: false, breakPages: true, ignoreLastRenderedPageBreak: false, renderHeaders: true, renderFooters: true, useBase64URL: true });
            const secciones = [...caja.querySelectorAll('section.docx')];
            if (!secciones.length) throw new Error('El Word no tiene contenido que se pueda mostrar.');
            const pdf = await PDFLib.PDFDocument.create();
            for (const sec of secciones) {
                const cs = getComputedStyle(sec);
                const wpx = sec.offsetWidth;
                const hpx = parseFloat(cs.minHeight) || wpx * 1.294;
                const escala = 2;
                const lienzo = await html2canvas(sec, { scale: escala, backgroundColor: '#ffffff', logging: false, useCORS: true });
                // Cada página repite los márgenes superior e inferior del Word; se corta solo el área de texto
                const mT = Math.round((parseFloat(cs.paddingTop) || 72) * escala), mB = Math.round((parseFloat(cs.paddingBottom) || 72) * escala);
                const altoPag = Math.round(hpx * escala), util = altoPag - mT - mB;
                const cx = lienzo.getContext('2d');
                const finContenido = lienzo.height;
                const enBlanco = (y0, y1) => { const d = cx.getImageData(0, y0, lienzo.width, Math.max(1, y1 - y0)).data; for (let i = 0; i < d.length; i += 64) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) return false; return true; };
                let y = mT;
                while (y < finContenido - 4) {
                    let fin = Math.min(finContenido, y + util);
                    // Corta en una fila en blanco cerca del borde para no partir líneas de texto
                    if (fin < finContenido) {
                        const desde = fin - util * 0.15;
                        for (let f = fin; f > desde; f -= 2) {
                            const fila = cx.getImageData(0, f, lienzo.width, 1).data;
                            let blanca = true;
                            for (let i = 0; i < fila.length; i += 16) if (fila[i] < 245 || fila[i + 1] < 245 || fila[i + 2] < 245) { blanca = false; break; }
                            if (blanca) { fin = f; break; }
                        }
                    }
                    if (enBlanco(y, fin)) break; // lo que queda es margen vacío
                    const trozo = document.createElement('canvas');
                    trozo.width = lienzo.width; trozo.height = altoPag;
                    const tx = trozo.getContext('2d');
                    tx.fillStyle = '#fff'; tx.fillRect(0, 0, trozo.width, trozo.height);
                    tx.drawImage(lienzo, 0, y, lienzo.width, fin - y, 0, mT, lienzo.width, fin - y);
                    const jpg = await pdf.embedJpg(await (await fetch(trozo.toDataURL('image/jpeg', 0.9))).arrayBuffer());
                    const page = pdf.addPage([wpx * 0.75, hpx * 0.75]);
                    page.drawImage(jpg, { x: 0, y: 0, width: wpx * 0.75, height: hpx * 0.75 });
                    y = fin;
                }
            }
            return await pdf.save();
        } finally { caja.remove(); }
    }

    // ------------------------------------------------------------------ estampar firma + datos en un PDF
    async function estampar(bytes, firma, datos, opciones, evidencia) {
        const { PDFDocument, StandardFonts, rgb } = PDFLib;
        let pdf;
        try { pdf = await PDFDocument.load(bytes); }
        catch (e) { throw new Error(/encrypt/i.test(e.message) ? 'está protegido con contraseña' : 'no es un PDF válido'); }
        const fuente = await pdf.embedFont(StandardFonts.Helvetica);
        const img = await pdf.embedPng(firma.png);
        const paginas = pdf.getPages();
        const elegidas = opciones.pagina === 'todas' ? paginas : [opciones.pagina === 'primera' ? paginas[0] : paginas[paginas.length - 1]];
        for (const page of elegidas) {
            const { width: W, height: H } = page.getSize();
            const ancho = Math.min(210, W * 0.38), margen = Math.max(24, W * 0.05);
            const k = Math.min(ancho / img.width, 56 / img.height);
            const iw = img.width * k, ih = img.height * k;
            const altoDatos = PascalSello.alto(ancho, datos);
            const altoTotal = ih + 4 + altoDatos;
            const x = opciones.lugar === 'izquierda' ? margen : opciones.lugar === 'centro' ? (W - ancho) / 2 : W - margen - ancho;
            const arriba = H - margen - altoTotal; // coordenada desde arriba
            page.drawImage(img, { x: x + (opciones.lugar === 'centro' ? (ancho - iw) / 2 : 0), y: H - arriba - ih, width: iw, height: ih });
            PascalSello.pdf({
                texto: (t, tx, ty, size, font, color) => page.drawText(t, { x: tx, y: H - ty - size, size, font, color }),
                rect: () => {}
            }, { regular: fuente }, x, arriba + ih + 4, ancho, datos, winAnsi);
        }
        if (evidencia) {
            const p = pdf.addPage([612, 792]);
            const negra = await pdf.embedFont(StandardFonts.HelveticaBold);
            const gris = rgb(0.35, 0.35, 0.4), tinta = rgb(0.12, 0.12, 0.12);
            let y = 740;
            const linea = (t, f = fuente, s = 10, c = tinta) => { p.drawText(winAnsi(t).slice(0, 110), { x: 56, y, size: s, font: f, color: c }); y -= s + 8; };
            linea('Hoja de evidencia de firma electrónica', negra, 16); y -= 6;
            linea('Firmado electrónicamente por ' + datos.nombre.toUpperCase());
            if (datos.delegado) linea('Usada por delegación: ' + datos.delegado);
            linea('Objeto: ' + (datos.objeto || '—'));
            if (datos.radicado) linea('Radicado: ' + datos.radicado);
            linea('Consecutivo: ' + datos.consecutivo);
            linea('Registrada el ' + new Date(evidencia.firmado_en).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'medium', timeZone: 'America/Bogota' }) + ' (hora del servidor, Colombia)');
            linea('Registro: ' + evidencia.id, fuente, 9, gris);
            linea('Huella SHA-256 del documento original:', fuente, 9, gris);
            linea(evidencia.hash, fuente, 8, gris);
            y -= 10;
            linea('Firma electrónica (Ley 527 de 1999 y Decreto 2364 de 2012) hecha con PascalPDF, en lote.', fuente, 8, gris);
            linea('No es firma digital certificada. Verifica que tu trámite la acepte.', fuente, 8, gris);
        }
        return pdf.save();
    }

    // ------------------------------------------------------------------ pantalla
    async function abrir() {
        if (!(await PascalCuenta.requiere(2, 'Firma en masa'))) return;
        const propias = typeof mySignatures !== 'undefined' ? mySignatures : [];
        let delegadas = [];
        try { if (window.PascalDelegar) delegadas = await PascalDelegar.vigentes(); } catch (e) { /* sin delegaciones */ }
        const opciones = [
            ...propias.map((s, i) => ({ v: 'p' + i, t: `${s.signer} · mi firma` })),
            ...delegadas.map((d, i) => ({ v: 'd' + i, t: `${d.firma_nombre} · delegada por ${d.titular_nombre || d.titular_correo}` }))
        ];
        const h = hoja(`
            <h2>Firma en masa</h2>
            <p class="pc-muted">Carga hasta ${MAX_ARCHIVOS} PDF o Word. Todos se firman con la misma firma y el mismo objeto; cada uno recibe su propio consecutivo y queda en tu historial. Los documentos no salen de tu dispositivo.</p>
            <label class="pc-btn pc-sec" style="width:100%;box-sizing:border-box;margin:6px 0">Elegir documentos (PDF o Word)<input type="file" data-archivos multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></label>
            <p class="pc-muted" data-cuantos style="margin:0 0 6px">Ningún documento elegido.</p>
            ${opciones.length ? `<label class="pc-muted" for="ms-firma">Firma</label><select class="pc-campo" id="ms-firma">${opciones.map(o => `<option value="${o.v}">${esc(o.t)}</option>`).join('')}</select>`
            : '<p class="pc-msg pc-err">Primero guarda una firma en este dispositivo (Firmar → «Guardar esta firma»).</p>'}
            <label class="pc-muted" for="ms-objeto">Objeto (va en todos los documentos)</label>
            <input class="pc-campo" id="ms-objeto" maxlength="120" placeholder="Ej. Certificado de cumplimiento">
            <select class="pc-campo" id="ms-objeto-sel" hidden></select>
            <label class="pc-muted" for="ms-radicado">Radicado (opcional, igual para todos)</label>
            <input class="pc-campo" id="ms-radicado" maxlength="60">
            <div class="pc-fila" style="margin-top:4px">
                <div><label class="pc-muted" for="ms-pagina">Página</label><select class="pc-campo" id="ms-pagina"><option value="ultima">Última</option><option value="primera">Primera</option><option value="todas">Todas</option></select></div>
                <div><label class="pc-muted" for="ms-lugar">Ubicación</label><select class="pc-campo" id="ms-lugar"><option value="derecha">Abajo a la derecha</option><option value="centro">Abajo al centro</option><option value="izquierda">Abajo a la izquierda</option></select></div>
            </div>
            <label style="display:flex;gap:8px;align-items:center;margin:8px 0;font-size:14px"><input type="checkbox" id="ms-evidencia" checked> Agregar hoja de evidencia al final de cada documento</label>
            <div class="pc-fila"><button class="pc-btn" data-firmar ${opciones.length ? '' : 'disabled'}>Firmar los documentos</button></div>
            <div data-progreso class="pc-muted" style="margin-top:10px" aria-live="polite"></div>
            <div data-msg></div>
            <p class="pc-muted" style="font-size:12px;margin-top:12px">Los Word se convierten a PDF en tu navegador: conservan su aspecto, pero el texto queda como imagen. Si necesitas texto seleccionable, guárdalos como PDF desde Word antes de cargarlos.</p>`);
        const q = (s) => h.querySelector(s);
        let archivos = [];
        q('[data-archivos]').onchange = (e) => {
            archivos = [...e.target.files].filter(f => /\.(pdf|docx)$/i.test(f.name));
            const grandes = archivos.filter(f => f.size > MAX_MB * 1048576);
            if (archivos.length > MAX_ARCHIVOS) { aviso(q('[data-msg]'), `Máximo ${MAX_ARCHIVOS} documentos por lote.`); archivos = archivos.slice(0, MAX_ARCHIVOS); }
            else if (grandes.length) { aviso(q('[data-msg]'), `${grandes.length} documento(s) pasan de ${MAX_MB} MB y no se incluirán.`); archivos = archivos.filter(f => f.size <= MAX_MB * 1048576); }
            else aviso(q('[data-msg]'), '');
            const w = archivos.filter(f => /\.docx$/i.test(f.name)).length;
            q('[data-cuantos]').textContent = archivos.length ? `${archivos.length} documento(s): ${archivos.length - w} PDF y ${w} Word.` : 'Ningún documento elegido.';
            q('[data-firmar]').textContent = archivos.length ? `Firmar ${archivos.length} documento(s)` : 'Firmar los documentos';
        };
        // Firma delegada con objetos restringidos: el objeto se elige de la lista autorizada
        const elegida = () => {
            const v = q('#ms-firma') ? q('#ms-firma').value : '';
            return v.startsWith('d') ? { delegada: delegadas[+v.slice(1)] } : { propia: propias[+v.slice(1)] };
        };
        const ajustarObjeto = () => {
            const e = elegida(), lista = e.delegada ? e.delegada.objetos : [];
            q('#ms-objeto').hidden = lista.length > 0;
            q('#ms-objeto-sel').hidden = !lista.length;
            q('#ms-objeto-sel').innerHTML = lista.map(o => `<option>${esc(o)}</option>`).join('');
        };
        if (q('#ms-firma')) { q('#ms-firma').onchange = ajustarObjeto; ajustarObjeto(); }

        const btn = q('[data-firmar]');
        btn.onclick = () => conBoton(btn, async () => {
            const msg = q('[data-msg]'), prog = q('[data-progreso]');
            aviso(msg, '');
            if (!archivos.length) return aviso(msg, 'Elige los documentos que vas a firmar.');
            const e = elegida();
            const objeto = (e.delegada && e.delegada.objetos.length ? q('#ms-objeto-sel').value : q('#ms-objeto').value).trim();
            if (!objeto) return aviso(msg, 'Escribe el objeto que va en los documentos.');
            const radicado = q('#ms-radicado').value.trim();
            if (!confirm(`Vas a firmar ${archivos.length} documento(s) con el objeto «${objeto}». Revisa que sean los correctos: tú respondes por lo que firmas. ¿Continuar?`)) return;
            const ops = { pagina: q('#ms-pagina').value, lugar: q('#ms-lugar').value };
            const conEvidencia = q('#ms-evidencia').checked;
            try {
                // 1. Firma a usar
                let firma, delegacionId = null, delegado = null, metodo;
                if (e.delegada) {
                    prog.textContent = 'Trayendo la firma delegada…';
                    const x = await PascalDelegar.obtener(e.delegada, objeto);
                    firma = { id: x.sig.id, nombre: x.sig.signer, png: x.sig.src };
                    delegacionId = x.delegacionId; metodo = 'imagen';
                    const c = PascalCuenta.cuenta; delegado = c ? (c.nombre || c.correo) : null;
                } else {
                    firma = { id: e.propia.id, nombre: e.propia.signer, png: await PascalDelegar.firmaPNG(e.propia) };
                    metodo = e.propia.kind === 'text' ? 'escrita' : e.propia.kind === 'drawn' ? 'dibujada' : 'imagen';
                }
                // 2. Preparar cada documento (Word → PDF) y su huella
                const docs = [], errores = [];
                for (let i = 0; i < archivos.length; i++) {
                    const f = archivos[i];
                    prog.textContent = `Preparando ${i + 1} de ${archivos.length}: ${f.name}`;
                    try {
                        const original = new Uint8Array(await f.arrayBuffer());
                        const pdfBytes = /\.docx$/i.test(f.name) ? await wordAPdf(f) : original;
                        const doc = await PDFLib.PDFDocument.load(pdfBytes).catch(err => { throw new Error(/encrypt/i.test(err.message) ? 'está protegido con contraseña' : 'no es un PDF válido'); });
                        docs.push({ nombre: f.name, bytes: pdfBytes, hash: await huella(original), paginas: doc.getPageCount() });
                    } catch (err) { errores.push(`${f.name}: ${err.message}`); }
                }
                if (!docs.length) throw new Error('Ningún documento se pudo leer. ' + errores.slice(0, 3).join(' · '));
                // 3. Registrar las firmas en el servidor (consecutivo y hora del servidor), de a 50
                const registros = [];
                for (let i = 0; i < docs.length; i += 50) {
                    prog.textContent = `Registrando firmas ${i + 1}–${Math.min(i + 50, docs.length)} de ${docs.length}…`;
                    const r = await api('registrar_firmas', {
                        eventos: docs.slice(i, i + 50).map(d => ({
                            app: 'pascalpdf', documento_nombre: d.nombre, documento_tipo: 'Otro', documento_hash: d.hash,
                            firma_id: firma.id, metodo, paginas: d.paginas, firmante: firma.nombre, objeto, radicado: radicado || null,
                            delegacion_id: delegacionId
                        }))
                    });
                    registros.push(...r.registros);
                }
                // 4. Estampar firma, datos y consecutivo en cada documento
                await cargar(LIBS.jszip);
                const zip = new JSZip();
                const salidas = [];
                for (let i = 0; i < docs.length; i++) {
                    const d = docs[i], reg = registros[i];
                    prog.textContent = `Firmando ${i + 1} de ${docs.length}: ${d.nombre}`;
                    const datos = { nombre: firma.nombre, fecha: PascalSello.fechaISO(new Date(reg.firmado_en)), objeto, radicado, consecutivo: reg.consecutivo, delegado };
                    try {
                        const out = await estampar(d.bytes, firma, datos, ops, conEvidencia ? { ...reg, hash: d.hash } : null);
                        let n = `${base(d.nombre)}_firmado_${reg.consecutivo}.pdf`;
                        salidas.push({ n, out });
                        zip.file(n, out);
                    } catch (err) { errores.push(`${d.nombre}: ${err.message}`); }
                }
                // 5. Descargar
                prog.textContent = 'Preparando la descarga…';
                if (salidas.length === 1) await downloadBlob(new Blob([salidas[0].out], { type: 'application/pdf' }), salidas[0].n);
                else if (salidas.length) await downloadBlob(await zip.generateAsync({ type: 'blob' }), `PascalPDF_firmados_${new Date().toISOString().slice(0, 10)}.zip`);
                prog.textContent = `Listo: ${salidas.length} documento(s) firmados, consecutivos ${registros[0].consecutivo} a ${registros[registros.length - 1].consecutivo}.`;
                if (errores.length) aviso(msg, `No se pudieron firmar ${errores.length}: ${errores.slice(0, 5).join(' · ')}${errores.length > 5 ? '…' : ''}`);
                else aviso(msg, 'Todos los documentos quedaron firmados y registrados en tu historial.', true);
                toast(`${salidas.length} documento(s) firmados.`);
            } catch (err) {
                console.error(err);
                prog.textContent = '';
                aviso(msg, err.message);
            }
        });
    }

    window.PascalMasiva = { abrir, wordAPdf, estampar };
    if (typeof SUITE_CATEGORIES !== 'undefined' && SUITE_CATEGORIES.sign) {
        SUITE_CATEGORIES.sign.tools.push({ label: 'Firma en masa (PDF y Word)', icon: 'fa-layer-group', action: () => abrir() });
    }
})();
