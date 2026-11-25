// Convertir Word a PDF en lote: varios .docx/.doc a la vez, con la conversión exacta (servidor) o en el navegador.
// Se descarga un ZIP con un PDF por documento, o un solo PDF con todos unidos.
(function () {
    'use strict';
    if (!window.PascalCuenta || !window.PascalWord) return;
    const { hoja, aviso, esc } = PascalCuenta.ui;
    const MAX_ARCHIVOS = 100, MAX_MB = 20;
    const JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    const cargarZip = () => window.JSZip ? Promise.resolve() : new Promise((ok, mal) => {
        const s = document.createElement('script'); s.src = JSZIP; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar el compresor. Revisa tu conexión.')); document.head.appendChild(s);
    });
    const hayServidor = () => !!(window.PASCAL_CONVERTIDOR && PascalCuenta.token && PascalCuenta.token());
    const base = (n) => n.replace(/\.docx?$/i, '').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Documento';

    // El plan (Suite) lo exige acceso.js al tocar la herramienta
    async function abrir() {
        let archivos = [], trabajando = false;
        let modoGuardado = null; try { modoGuardado = localStorage.getItem('pascal-word-modo'); } catch (e) { /* nada */ }
        const exacta = hayServidor();
        const h = hoja(`<h2 class="pc-h" style="margin:0 0 4px">Convertir Word a PDF en lote</h2>
            <p class="pc-muted">Elige varios documentos de Word y los pasamos a PDF de una vez.</p>
            <label class="pc-btn pc-sec" style="width:100%;box-sizing:border-box;margin:6px 0">Elegir documentos de Word<input type="file" data-archivos multiple accept=".docx,.doc,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></label>
            <p class="pc-muted" data-cuantos style="margin:2px 0 10px">Ningún documento elegido.</p>
            <fieldset style="border:0;padding:0;margin:0 0 10px"><legend style="font-weight:700;font-size:14px;margin-bottom:6px">Cómo convertir</legend>
              <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;font-size:14px${exacta ? '' : ';opacity:.5'}"><input type="radio" name="wl-modo" value="servidor" ${exacta && modoGuardado !== 'local' ? 'checked' : ''} ${exacta ? '' : 'disabled'}><span><b>Conversión exacta</b><br><span class="pc-muted" style="font-size:12px">Respeta tablas, márgenes y letras; el texto queda seleccionable. Cada archivo se envía cifrado al convertidor y se borra apenas se convierte.</span></span></label>
              <label style="display:flex;gap:8px;align-items:flex-start;font-size:14px"><input type="radio" name="wl-modo" value="local" ${!exacta || modoGuardado === 'local' ? 'checked' : ''}><span><b>Solo en mi dispositivo</b><br><span class="pc-muted" style="font-size:12px">No sale de tu dispositivo, pero el formato puede variar y el texto queda como imagen. Es más lento.</span></span></label>
            </fieldset>
            <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-bottom:12px"><input type="checkbox" data-unir> Unir todo en un solo PDF (en el orden elegido)</label>
            <div data-msg></div>
            <ol data-lista style="list-style:none;padding:0;margin:0 0 12px;max-height:240px;overflow:auto;font-size:13px"></ol>
            <button class="pc-btn" data-convertir style="width:100%" disabled>Convertir</button>`);
        const q = (s) => h.querySelector(s), msg = q('[data-msg]');
        const fila = (i, estado, nota) => {
            const li = q(`[data-i="${i}"]`); if (!li) return;
            const ic = { espera: '<span style="color:#a1a1aa">•</span>', trabajando: '<span style="color:#d97706">⟳</span>', ok: '<span style="color:#16a34a">✓</span>', error: '<span style="color:#dc2626">✗</span>' }[estado];
            li.innerHTML = `${ic} <b style="font-weight:600">${esc(archivos[i].name)}</b>${nota ? ` <span class="pc-muted">· ${esc(nota)}</span>` : ''}`;
        };
        q('[data-archivos]').onchange = (e) => {
            archivos = [...e.target.files].filter(f => /\.docx?$/i.test(f.name) || PascalWord.esWord(f));
            const grandes = archivos.filter(f => f.size > MAX_MB * 1048576);
            if (archivos.length > MAX_ARCHIVOS) { aviso(msg, `Máximo ${MAX_ARCHIVOS} documentos por lote.`); archivos = archivos.slice(0, MAX_ARCHIVOS); }
            else if (grandes.length) { aviso(msg, `${grandes.length} documento(s) pasan de ${MAX_MB} MB y no se incluirán.`); archivos = archivos.filter(f => f.size <= MAX_MB * 1048576); }
            else aviso(msg, '');
            q('[data-cuantos]').textContent = archivos.length ? `${archivos.length} documento(s) de Word.` : 'Ningún documento elegido.';
            q('[data-lista]').innerHTML = archivos.map((f, i) => `<li data-i="${i}" style="padding:6px 0;border-bottom:1px solid #f1f1f1"></li>`).join('');
            archivos.forEach((f, i) => fila(i, 'espera'));
            q('[data-convertir]').disabled = !archivos.length;
        };
        q('[data-convertir]').onclick = async () => {
            if (trabajando || !archivos.length) return;
            trabajando = true;
            const boton = q('[data-convertir]'); boton.disabled = true;
            const modo = (h.querySelector('input[name="wl-modo"]:checked') || {}).value || 'local';
            const unir = q('[data-unir]').checked;
            const res = new Array(archivos.length);
            let hechos = 0, fallos = 0, respaldo = 0;
            aviso(msg, '');
            // Con el convertidor exacto van 2 a la vez; en el navegador, de uno en uno
            const cola = archivos.map((f, i) => i), paralelo = modo === 'servidor' ? 2 : 1;
            const trabajador = async () => {
                while (cola.length) {
                    const i = cola.shift();
                    fila(i, 'trabajando', 'convirtiendo…');
                    try {
                        const r = await PascalWord.convertir(archivos[i], { modo });
                        const doc = await PDFLib.PDFDocument.load(r.bytes, { ignoreEncryption: true });
                        res[i] = { bytes: r.bytes, nombre: base(archivos[i].name) + '.pdf', paginas: doc.getPageCount() };
                        if (r.aviso) respaldo++;
                        const notas = [`${res[i].paginas} pág.`];
                        if (r.metodo === 'local' && modo === 'servidor') notas.push('convertido en el dispositivo');
                        if (r.fuentes && r.fuentes.length) notas.push('letra ' + r.fuentes.slice(0, 2).join(', ') + ' puede verse distinta');
                        fila(i, 'ok', notas.join(' · '));
                    } catch (e) {
                        fallos++;
                        fila(i, 'error', e.message || 'no se pudo convertir');
                    }
                    hechos++;
                    boton.textContent = `Convirtiendo… ${hechos} de ${archivos.length}`;
                }
            };
            try {
                await Promise.all(Array.from({ length: Math.min(paralelo, archivos.length) }, trabajador));
                const listos = res.filter(Boolean);
                if (!listos.length) throw new Error('No se pudo convertir ningún documento.');
                const fecha = new Date().toISOString().slice(0, 10);
                if (unir) {
                    const todo = await PDFLib.PDFDocument.create();
                    for (const r of listos) {
                        const d = await PDFLib.PDFDocument.load(r.bytes, { ignoreEncryption: true });
                        (await todo.copyPages(d, d.getPageIndices())).forEach(p => todo.addPage(p));
                    }
                    downloadBlob(new Blob([await todo.save()], { type: 'application/pdf' }), `Word_unidos_${fecha}.pdf`);
                } else if (listos.length === 1) {
                    downloadBlob(new Blob([listos[0].bytes], { type: 'application/pdf' }), listos[0].nombre);
                } else {
                    await cargarZip();
                    const zip = new JSZip(), usados = {};
                    listos.forEach(r => {
                        let n = r.nombre; // nombres repetidos: se numeran
                        if (usados[n]) n = n.replace(/\.pdf$/, ` (${++usados[n]}).pdf`); else usados[n] = 1;
                        zip.file(n, r.bytes);
                    });
                    downloadBlob(await zip.generateAsync({ type: 'blob' }), `Word_a_PDF_${fecha}.zip`);
                }
                aviso(msg, `Listo: ${listos.length} convertido(s)${fallos ? `, ${fallos} con error` : ''}${respaldo ? `. ${respaldo} se convirtieron en el dispositivo porque el convertidor exacto no respondió` : ''}. Revisa los PDF antes de firmarlos o enviarlos.`, !fallos);
            } catch (e) {
                aviso(msg, e.message || 'No se pudo completar la conversión.');
            } finally {
                trabajando = false;
                boton.disabled = false; boton.textContent = 'Convertir otra vez';
            }
        };
    }

    if (typeof SUITE_CATEGORIES !== 'undefined' && SUITE_CATEGORIES.export) {
        SUITE_CATEGORIES.export.tools.push({ label: 'Word a PDF en lote', icon: 'fa-file-word', action: () => abrir() });
    }
    window.PascalWordLote = { abrir };
})();
