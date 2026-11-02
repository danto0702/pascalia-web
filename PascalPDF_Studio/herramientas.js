// Herramientas de PascalPDF que trabajan solo en el navegador: el documento nunca se sube.
// Depende de los globales de index.html (pdfPages, pdfSources, buildPDFBytes, showToast, etc.).
(function () {
    'use strict';

    const CDN = {
        jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
        diff: 'https://cdn.jsdelivr.net/npm/diff@5.2.0/dist/diff.min.js',
        forge: 'https://cdn.jsdelivr.net/npm/node-forge@1.3.1/dist/forge.min.js',
        tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
        tesseractWorker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
        tesseractCore: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
        tesseractLang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/spa@1.0.0/4.0.0_best_int',
        qpdf: 'https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm@0.3.0/dist/qpdf.js',
        qpdfWasm: 'https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm@0.3.0/dist/qpdf.wasm'
    };

    // ------------------------------------------------------------------ utilidades
    const loaded = {};
    function loadScript(url) {
        if (!loaded[url]) {
            loaded[url] = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = url;
                s.onload = resolve;
                s.onerror = () => { delete loaded[url]; reject(new Error('No se pudo descargar un componente. Revisa tu conexión.')); };
                document.head.appendChild(s);
            });
        }
        return loaded[url];
    }

    const sha256Hex = async (bytes) =>
        [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');

    const baseName = () => (document.getElementById('doc-title-display').textContent || 'Documento')
        .replace(/\.pdf$/i, '').replace(/[^\w\-áéíóúÁÉÍÓÚñÑ ]+/g, '').trim() || 'Documento';

    const fmtBytes = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

    async function withBusy(msg, fn) {
        setBusy(msg);
        try {
            return await fn();
        } catch (e) {
            console.error(e);
            showToast(e && e.userMessage ? e.userMessage : 'No se pudo completar: ' + (e && e.message ? e.message : e), 'rose');
        } finally {
            setBusy(null);
        }
    }

    const userError = (msg) => Object.assign(new Error(msg), { userMessage: msg });

    function allIndices() { return pdfPages.map((_, i) => i); }

    // Bytes del documento tal como se ve (con ediciones), sin hoja de evidencia
    async function currentDocumentBytes() {
        if (!window.PDFLib) throw userError('No se pudo cargar pdf-lib. Revisa tu conexión.');
        return buildPDFBytes(allIndices());
    }

    async function openWithPdfjs(bytes, password) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        return pdfjsLib.getDocument({ data: bytes.slice ? bytes.slice() : bytes, password }).promise;
    }

    async function renderPdfPage(doc, n, scale) {
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        return { canvas, page };
    }

    const canvasBlob = (canvas, type, q) => new Promise(r => canvas.toBlob(r, type, q));

    // Texto de un PDF por página, agrupado en líneas
    async function extractPdfText(bytes) {
        const doc = await openWithPdfjs(bytes);
        const pages = [];
        for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n);
            const content = await page.getTextContent();
            const rows = [];
            content.items.forEach(it => {
                if (!it.str) return;
                const y = Math.round(it.transform[5]);
                let row = rows.find(r => Math.abs(r.y - y) <= 2);
                if (!row) rows.push(row = { y, parts: [] });
                row.parts.push({ x: it.transform[4], s: it.str });
            });
            rows.sort((a, b) => b.y - a.y);
            pages.push(rows.map(r => r.parts.sort((a, b) => a.x - b.x).map(p => p.s).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'));
        }
        return pages;
    }

    // ------------------------------------------------------------------ diálogo genérico
    function dialog({ title, body, actions = [], wide = false }) {
        const wrap = document.createElement('div');
        wrap.className = 'fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-open';
        wrap.innerHTML = `
            <div class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] flex flex-col shadow-2xl">
                <div class="px-5 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
                    <h3 class="font-bold text-white text-sm">${escapeHtml(title)}</h3>
                    <button data-close class="text-zinc-400 hover:text-white" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div data-body class="p-5 space-y-3 text-xs text-zinc-300 overflow-y-auto"></div>
                <div data-actions class="px-5 pb-5 flex justify-end gap-2 shrink-0"></div>
            </div>`;
        const close = () => wrap.remove();
        wrap.querySelector('[data-close]').onclick = close;
        wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
        const bodyEl = wrap.querySelector('[data-body]');
        if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
        const actionsEl = wrap.querySelector('[data-actions]');
        actions.forEach(a => {
            const b = document.createElement('button');
            b.className = a.primary
                ? 'px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold'
                : 'px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium';
            b.textContent = a.label;
            b.onclick = async () => { if ((await a.onClick?.(wrap)) !== false) close(); };
            actionsEl.appendChild(b);
        });
        if (!actions.length) actionsEl.remove();
        document.body.appendChild(wrap);
        return { el: wrap, body: bodyEl, close };
    }
    const field = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white';

    // ------------------------------------------------------------------ 1. Formularios existentes (AcroForm)
    const acroState = {};   // srcId -> { name: value }
    const acroDirty = {};   // srcId -> true si cambió algún valor

    async function detectAcroFields(newPages, srcId, bytes) {
        let doc;
        try { doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true }); } catch (e) { return 0; }
        const form = doc.getForm();
        const pages = doc.getPages();
        const state = acroState[srcId] = {};
        let count = 0;
        for (const f of form.getFields()) {
            const name = f.getName();
            let kind = null, value = null, options = null;
            try {
                if (f instanceof PDFLib.PDFTextField) { kind = 'text'; value = f.getText() || ''; }
                else if (f instanceof PDFLib.PDFCheckBox) { kind = 'check'; value = f.isChecked(); }
                else if (f instanceof PDFLib.PDFDropdown || f instanceof PDFLib.PDFOptionList) { kind = 'select'; options = f.getOptions(); value = f.getSelected()[0] || ''; }
                else if (f instanceof PDFLib.PDFRadioGroup) { kind = 'radio'; options = f.getOptions(); value = f.getSelected() || ''; }
            } catch (e) { kind = null; }
            if (!kind) continue;
            state[name] = value;
            const readOnly = f.isReadOnly();
            f.acroField.getWidgets().forEach((w, wi) => {
                const pg = form.findWidgetPage ? form.findWidgetPage(w) : null;
                const pi = pg ? pages.indexOf(pg) : -1;
                const target = newPages[pi];
                if (!target || pg.getRotation().angle % 360 !== 0) return;
                const box = pg.getCropBox();
                const r = w.getRectangle();
                const k = PAGE_W / box.width;
                target.acroFields = target.acroFields || [];
                target.acroFields.push({
                    srcId, name, kind, options, readOnly,
                    option: kind === 'radio' ? options[wi] : undefined,
                    x: (r.x - box.x) * k, y: (box.y + box.height - r.y - r.height) * k,
                    w: r.width * k, h: r.height * k
                });
                count++;
            });
        }
        return count;
    }

    function renderAcroFields(page, layer) {
        (page.acroFields || []).forEach(af => {
            const st = acroState[af.srcId];
            const el = document.createElement('div');
            el.className = 'acro-field';
            Object.assign(el.style, { position: 'absolute', left: af.x + 'px', top: af.y + 'px', width: af.w + 'px', height: af.h + 'px', zIndex: 5 });
            const fs = Math.max(8, Math.min(14, af.h * 0.62));
            const set = (v) => { st[af.name] = v; acroDirty[af.srcId] = true; };
            let input;
            if (af.kind === 'text') {
                input = document.createElement(af.h > 30 ? 'textarea' : 'input');
                if (input.tagName === 'INPUT') input.type = 'text';
                input.value = st[af.name] || '';
                input.oninput = () => set(input.value);
            } else if (af.kind === 'check' || af.kind === 'radio') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = af.kind === 'check' ? !!st[af.name] : st[af.name] === af.option;
                input.onchange = () => {
                    if (af.kind === 'check') set(input.checked);
                    else { set(input.checked ? af.option : ''); renderCurrentPage(); }
                };
            } else {
                input = document.createElement('select');
                input.innerHTML = ['<option value=""></option>', ...af.options.map(o => `<option ${o === st[af.name] ? 'selected' : ''}>${escapeHtml(o)}</option>`)].join('');
                input.onchange = () => set(input.value);
            }
            input.disabled = af.readOnly;
            input.title = af.name;
            Object.assign(input.style, { width: '100%', height: '100%', fontSize: fs + 'px', fontFamily: 'Helvetica, Arial, sans-serif', color: '#111' });
            input.className = 'acro-input';
            input.addEventListener('mousedown', e => e.stopPropagation());
            el.appendChild(input);
            layer.appendChild(el);
        });
    }

    // Antes de copiar las páginas: llenar el formulario original con los valores escritos
    async function prepareSourceDoc(doc, srcId) {
        const st = acroState[srcId];
        if (!st || !acroDirty[srcId]) return doc;
        const form = doc.getForm();
        Object.entries(st).forEach(([name, v]) => {
            try {
                const f = form.getField(name);
                if (f instanceof PDFLib.PDFTextField) f.setText(toWinAnsi(v || ''));
                else if (f instanceof PDFLib.PDFCheckBox) v ? f.check() : f.uncheck();
                else if (f instanceof PDFLib.PDFDropdown || f instanceof PDFLib.PDFOptionList) { if (v) f.select(v); else f.clear(); }
                else if (f instanceof PDFLib.PDFRadioGroup) { if (v) f.select(v); else f.clear(); }
            } catch (e) { console.warn('Campo', name, e.message); }
        });
        // Se actualiza la apariencia de cada campo; al copiar las páginas al documento final los valores
        // quedan fijos (el documento nuevo no lleva el formulario interactivo). No se usa flatten() de
        // pdf-lib porque deja referencias rotas que algunos lectores reportan como errores.
        try { form.updateFieldAppearances(); } catch (e) { console.warn('Apariencia de campos', e); }
        return doc;
    }

    function showFormInfo() {
        const n = pdfPages.reduce((a, p) => a + (p.acroFields || []).length, 0);
        showToast(n
            ? `Este PDF tiene ${n} campo(s) de formulario. Escribe directamente sobre ellos; al guardar quedan fijos en el documento.`
            : 'Este PDF no trae campos de formulario. Puedes agregar campos o textos con las herramientas de Formularios.', n ? 'emerald' : 'amber');
    }

    // ------------------------------------------------------------------ 2. Tapado real
    async function applyRealRedaction() {
        const targets = pdfPages.map((p, i) => ({ p, i })).filter(({ p }) => p.objects.some(o => o.type === 'redact'));
        if (!targets.length) return showToast('Primero marca las áreas que quieres tapar.', 'amber');
        if (!confirm('Las páginas con áreas marcadas se convertirán en imagen: lo tapado se elimina de verdad, pero el resto de esa página ya no se podrá seleccionar ni editar como texto. ¿Continuar?')) return;
        await withBusy('Eliminando la información tapada…', async () => {
            for (const { p, i } of targets) {
                p.objects.forEach(o => { if (o.type === 'redact') o.applied = true; });
                const keep = p.objects.filter(o => o.type === 'signature');
                const bytes = await buildPDFBytes([i], { skip: o => o.type === 'signature', noPageNumbers: true, noWatermark: true });
                const doc = await openWithPdfjs(bytes);
                const first = await doc.getPage(1);
                const base = first.getViewport({ scale: 1 });
                const { canvas } = await renderPdfPage(doc, 1, (PAGE_W * 2) / base.width);
                rasterizePage(p, canvas, base.width, base.height);
                p.objects = keep;
            }
            lastDrawnPageId = null;
            renderCurrentPage();
            showToast(`${targets.length} página(s) procesadas: lo tapado ya no existe en el archivo.`, 'emerald');
        });
    }

    function rasterizePage(p, canvas, pdfW, pdfH) {
        const thumb = document.createElement('canvas');
        thumb.width = 64;
        thumb.height = Math.round(64 * canvas.height / canvas.width);
        thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
        Object.assign(p, {
            raster: true, srcId: null, srcIndex: null, rotation: 0, crop: null,
            pdfW, pdfH, h: Math.round(PAGE_W * pdfH / pdfW),
            bgImage: canvas.toDataURL('image/jpeg', 0.9), thumb: thumb.toDataURL('image/jpeg', 0.7),
            textItems: [], acroFields: [], ocrWords: null, drawing: null, background: '#ffffff'
        });
    }

    // ------------------------------------------------------------------ 3. Limpiar metadatos, scripts y adjuntos
    let cleanOnExport = false;
    function toggleClean() {
        cleanOnExport = !cleanOnExport;
        showToast(cleanOnExport
            ? 'Al guardar se quitarán metadatos (autor, programa, fechas), acciones JavaScript, adjuntos y anotaciones de archivo.'
            : 'Limpieza al guardar desactivada.', cleanOnExport ? 'emerald' : 'indigo');
    }

    function cleanDocument(pdfDoc) {
        const { PDFName, PDFDict, PDFArray } = PDFLib;
        const info = pdfDoc.getInfoDict();
        ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate'].forEach(k => info.delete(PDFName.of(k)));
        const cat = pdfDoc.catalog;
        ['Metadata', 'OpenAction', 'AA', 'Names', 'PieceInfo'].forEach(k => cat.delete(PDFName.of(k)));
        pdfDoc.getPages().forEach(pg => {
            ['AA', 'Metadata', 'PieceInfo'].forEach(k => pg.node.delete(PDFName.of(k)));
            const annots = pg.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
            if (!annots) return;
            for (let i = annots.size() - 1; i >= 0; i--) {
                const a = annots.lookupMaybe(i, PDFDict);
                if (!a) continue;
                const sub = a.get(PDFName.of('Subtype'))?.toString();
                const action = a.lookupMaybe(PDFName.of('A'), PDFDict);
                const s = action?.get(PDFName.of('S'))?.toString();
                if (sub === '/FileAttachment' || sub === '/Sound' || sub === '/Movie' || sub === '/RichMedia' || s === '/JavaScript' || s === '/Launch') annots.remove(i);
                else a.delete(PDFName.of('AA'));
            }
        });
    }

    // ------------------------------------------------------------------ 4. Recortar
    let cropMode = false;
    function startCrop() {
        cropMode = true;
        renderCurrentPage();
        showToast('Arrastra sobre la página para marcar el área que quieres conservar.', 'indigo');
    }
    function removeCrop() {
        if (!pdfPages[currentPageIndex].crop) return showToast('Esta página no tiene recorte.', 'amber');
        pdfPages[currentPageIndex].crop = null;
        renderCurrentPage();
        showToast('Recorte quitado.', 'indigo');
    }
    function renderCrop(page, layer) {
        if (page.crop) {
            const c = document.createElement('div');
            Object.assign(c.style, {
                position: 'absolute', left: page.crop.x + 'px', top: page.crop.y + 'px', width: page.crop.w + 'px', height: page.crop.h + 'px',
                boxShadow: '0 0 0 4000px rgba(31,31,31,0.45)', outline: '2px dashed #FFB300', pointerEvents: 'none', zIndex: 40
            });
            layer.appendChild(c);
        }
        if (!cropMode) return;
        const cap = document.createElement('div');
        Object.assign(cap.style, { position: 'absolute', inset: '0', cursor: 'crosshair', zIndex: 60, background: 'rgba(255,193,7,0.06)' });
        const box = document.createElement('div');
        Object.assign(box.style, { position: 'absolute', outline: '2px solid #FFB300', background: 'rgba(255,193,7,0.12)', display: 'none' });
        cap.appendChild(box);
        let start = null;
        const pos = (e) => {
            const r = cap.getBoundingClientRect();
            const t = e.touches ? e.touches[0] : e;
            return { x: (t.clientX - r.left) * PAGE_W / r.width, y: (t.clientY - r.top) * pageHeight(page) / r.height };
        };
        const down = (e) => { e.preventDefault(); e.stopPropagation(); start = pos(e); };
        const move = (e) => {
            if (!start) return;
            const p = pos(e);
            Object.assign(box.style, { display: 'block', left: Math.min(p.x, start.x) + 'px', top: Math.min(p.y, start.y) + 'px', width: Math.abs(p.x - start.x) + 'px', height: Math.abs(p.y - start.y) + 'px' });
        };
        const up = (e) => {
            if (!start) return;
            const p = e.changedTouches ? pos({ touches: e.changedTouches }) : pos(e);
            const c = { x: Math.max(0, Math.min(p.x, start.x)), y: Math.max(0, Math.min(p.y, start.y)), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
            start = null;
            cropMode = false;
            if (c.w < 30 || c.h < 30) { renderCurrentPage(); return showToast('El área es muy pequeña. Intenta de nuevo.', 'amber'); }
            page.crop = c;
            renderCurrentPage();
            showToast('Página recortada. Al guardar solo se verá esa área.', 'emerald');
        };
        cap.addEventListener('mousedown', down);
        cap.addEventListener('mousemove', move);
        cap.addEventListener('mouseup', up);
        cap.addEventListener('touchstart', down, { passive: false });
        cap.addEventListener('touchmove', move, { passive: false });
        cap.addEventListener('touchend', up);
        layer.appendChild(cap);
    }

    function applyCrop(page, pData, pt) {
        if (!pData.crop) return;
        const c = pData.crop;
        const a = pt(c.x, c.y + c.h), b = pt(c.x + c.w, c.y);
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        page.setCropBox(x, y, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    }

    // ------------------------------------------------------------------ 5. Buscar en el documento
    let searchHits = [];
    let activeHit = -1;
    function searchDialog() {
        const body = document.createElement('div');
        body.innerHTML = `
            <div class="flex gap-2">
                <input data-q type="search" placeholder="Palabra o frase" class="${field}">
                <button data-go class="px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold">Buscar</button>
            </div>
            <div data-res class="space-y-1.5"></div>`;
        const d = dialog({ title: 'Buscar en el documento', body });
        const q = body.querySelector('[data-q]');
        const res = body.querySelector('[data-res]');
        const run = () => {
            const term = q.value.trim().toLowerCase();
            searchHits = [];
            if (term) {
                pdfPages.forEach((p, pi) => {
                    (p.textItems || []).forEach(ti => { if (!ti.used && ti.text.toLowerCase().includes(term)) searchHits.push({ pi, text: ti.text, rect: { x: ti.x, y: ti.y, w: ti.w, h: ti.h } }); });
                    p.objects.forEach(o => { if (o.text && o.text.toLowerCase().includes(term)) searchHits.push({ pi, text: o.text, objId: o.id }); });
                });
            }
            res.innerHTML = term ? `<p class="text-zinc-400">${searchHits.length} resultado(s)</p>` : '';
            searchHits.forEach((h, idx) => {
                const b = document.createElement('button');
                b.className = 'w-full text-left p-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-600 flex justify-between gap-2';
                b.innerHTML = `<span class="truncate">${escapeHtml(h.text.slice(0, 120))}</span><span class="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">Pág ${h.pi + 1}</span>`;
                b.onclick = () => {
                    activeHit = idx;
                    goToPage(h.pi);
                    if (h.objId) selectObject(h.objId);
                    d.close();
                };
                res.appendChild(b);
            });
            renderCurrentPage();
        };
        body.querySelector('[data-go]').onclick = run;
        q.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
        setTimeout(() => q.focus(), 50);
    }
    function renderSearchHits(page, layer) {
        const pi = pdfPages.indexOf(page);
        searchHits.forEach((h, idx) => {
            if (h.pi !== pi || !h.rect) return;
            const m = document.createElement('div');
            Object.assign(m.style, {
                position: 'absolute', left: (h.rect.x - 2) + 'px', top: (h.rect.y - 2) + 'px', width: (h.rect.w + 4) + 'px', height: (h.rect.h + 4) + 'px',
                background: idx === activeHit ? 'rgba(255,179,0,0.45)' : 'rgba(255,213,79,0.35)', borderRadius: '3px', pointerEvents: 'none', zIndex: 4
            });
            layer.appendChild(m);
        });
    }
    function clearSearch() { searchHits = []; activeHit = -1; }

    // ------------------------------------------------------------------ 6. PDF a imágenes (ZIP)
    async function exportImagesZip(type) {
        await withBusy('Convirtiendo páginas en imágenes…', async () => {
            await loadScript(CDN.jszip);
            const doc = await openWithPdfjs(await currentDocumentBytes());
            const zip = new JSZip();
            const ext = type === 'image/png' ? 'png' : 'jpg';
            for (let n = 1; n <= doc.numPages; n++) {
                setBusy(`Convirtiendo página ${n} de ${doc.numPages}…`);
                const first = await doc.getPage(n);
                const base = first.getViewport({ scale: 1 });
                const { canvas } = await renderPdfPage(doc, n, 1600 / Math.max(base.width, 1));
                zip.file(`${baseName()}_pagina_${String(n).padStart(2, '0')}.${ext}`, await canvasBlob(canvas, type, 0.9));
            }
            downloadBlob(await zip.generateAsync({ type: 'blob' }), `${baseName()}_imagenes.zip`);
            showToast(`${doc.numPages} página(s) exportadas como ${ext.toUpperCase()} en un ZIP.`, 'emerald');
        });
    }

    // ------------------------------------------------------------------ 7. Imágenes a PDF
    async function imagesToPdf() {
        const files = await pickFile('image/*', true);
        if (!files.length) return;
        await withBusy('Convirtiendo imágenes…', async () => {
            const pristine = !pdfSources.length && pdfPages.length === 1 && pdfPages[0].id === 'page-1';
            const added = [];
            for (const file of files) {
                if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
                    showToast(`"${file.name}" es HEIC (iPhone). Cámbialo a JPG: en el iPhone, Ajustes → Cámara → Formatos → "Más compatible".`, 'amber');
                    continue;
                }
                const src = await readFileAsDataURL(file);
                const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
                const maxSide = 2400;
                const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.naturalWidth * k);
                canvas.height = Math.round(img.naturalHeight * k);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pdfW = 595.28;
                const p = { id: 'page-img-' + Date.now() + '-' + added.length, objects: [] };
                rasterizePage(p, canvas, pdfW, pdfW * canvas.height / canvas.width);
                added.push(p);
            }
            if (!added.length) return;
            if (pristine) {
                pdfPages = added;
                bookmarks = [];
                document.getElementById('doc-title-display').textContent = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') + '.pdf' : 'Imagenes.pdf';
                currentPageIndex = 0;
            } else {
                pdfPages.push(...added);
            }
            lastDrawnPageId = null;
            goToPage(pristine ? 0 : pdfPages.length - added.length);
            showToast(`${added.length} imagen(es) convertidas en páginas. Guarda el PDF cuando quieras.`, 'emerald');
        });
    }

    // ------------------------------------------------------------------ 8. PDF a texto
    async function exportText() {
        await withBusy('Extrayendo el texto…', async () => {
            const pages = await extractPdfText(await currentDocumentBytes());
            const total = pages.join('').trim();
            if (!total) return showToast('El documento no tiene texto (¿es escaneado?). Usa primero «Reconocer texto (OCR)».', 'amber');
            const txt = pages.map((t, i) => `--- Página ${i + 1} ---\n${t}`).join('\n\n');
            downloadBlob(new Blob(['﻿' + txt], { type: 'text/plain;charset=utf-8' }), `${baseName()}.txt`);
            showToast('Texto exportado.', 'emerald');
        });
    }

    // ------------------------------------------------------------------ 9. Marcadores dentro del PDF
    function writeOutline(pdfDoc, list) {
        const { PDFName, PDFHexString, PDFNull } = PDFLib;
        const marks = bookmarks.map(b => ({ title: b.title, out: list.indexOf(b.page) })).filter(b => b.out >= 0);
        if (!marks.length) return;
        const ctx = pdfDoc.context;
        const pages = pdfDoc.getPages();
        const outlineRef = ctx.nextRef();
        const refs = marks.map(() => ctx.nextRef());
        marks.forEach((m, i) => {
            const d = { Title: PDFHexString.fromText(m.title), Parent: outlineRef, Dest: [pages[m.out].ref, 'XYZ', PDFNull, PDFNull, PDFNull] };
            if (i > 0) d.Prev = refs[i - 1];
            if (i < refs.length - 1) d.Next = refs[i + 1];
            ctx.assign(refs[i], ctx.obj(d));
        });
        ctx.assign(outlineRef, ctx.obj({ Type: 'Outlines', First: refs[0], Last: refs[refs.length - 1], Count: refs.length }));
        pdfDoc.catalog.set(PDFName.of('Outlines'), outlineRef);
        pdfDoc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
    }

    // ------------------------------------------------------------------ 10. Procesar varios PDF (lotes)
    function batchDialog() {
        const sigOpts = mySignatures.map(s => `<option value="${s.id}">${escapeHtml(s.signer)} · ${s.kind === 'text' ? 'escrita' : s.kind === 'drawn' ? 'dibujada' : 'imagen'}</option>`).join('');
        const body = `
            <label class="block border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl p-4 text-center cursor-pointer">
                <span data-fname class="text-zinc-200">Elegir los PDF (puedes elegir varios)</span>
                <input data-files type="file" accept="application/pdf" multiple class="hidden">
            </label>
            <div class="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-2.5">
                <label class="flex items-center gap-2"><input data-sign type="checkbox" class="w-4 h-4 accent-amber-400" ${mySignatures.length ? '' : 'disabled'}> Firmar con</label>
                ${mySignatures.length ? `<select data-sig class="${field}">${sigOpts}</select>
                <select data-where class="${field}"><option value="last">En la última página</option><option value="first">En la primera página</option><option value="all">En todas las páginas</option></select>
                <label class="flex items-center gap-2"><input data-date type="checkbox" checked class="w-4 h-4 accent-amber-400"> Mostrar fecha y hora debajo</label>
                <label class="flex items-center gap-2"><input data-evidence type="checkbox" checked class="w-4 h-4 accent-amber-400"> Agregar hoja de evidencia</label>`
                : '<p class="text-zinc-500">Para firmar en lote, primero crea una firma con «Firmar».</p>'}
            </div>
            <div class="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-2.5">
                <label class="flex items-center gap-2"><input data-wm type="checkbox" class="w-4 h-4 accent-amber-400"> Marca de agua</label>
                <input data-wmtext type="text" placeholder="Ej. COPIA" class="${field}">
                <label class="flex items-center gap-2"><input data-num type="checkbox" class="w-4 h-4 accent-amber-400"> Numerar páginas</label>
                <label class="flex items-center gap-2"><input data-clean type="checkbox" class="w-4 h-4 accent-amber-400"> Quitar metadatos y scripts</label>
            </div>
            <p class="text-zinc-500">Todo se procesa en tu dispositivo y se descarga en un ZIP.</p>`;
        const d = dialog({
            title: 'Procesar varios PDF', body, actions: [
                { label: 'Cancelar' },
                { label: 'Procesar', primary: true, onClick: (el) => runBatch(el) }
            ]
        });
        const inp = d.el.querySelector('[data-files]');
        inp.onchange = () => { d.el.querySelector('[data-fname]').textContent = inp.files.length ? `${inp.files.length} archivo(s) elegidos` : 'Elegir los PDF'; };
    }

    async function runBatch(el) {
        const q = (s) => el.querySelector(s);
        const files = [...q('[data-files]').files];
        if (!files.length) { showToast('Elige al menos un PDF.', 'amber'); return false; }
        const opts = {
            sign: q('[data-sign]')?.checked ? mySignatures.find(s => s.id === q('[data-sig]').value) : null,
            where: q('[data-where]')?.value, date: q('[data-date]')?.checked, evidence: q('[data-evidence]')?.checked,
            wm: q('[data-wm]').checked ? (q('[data-wmtext]').value.trim() || 'COPIA') : '', num: q('[data-num]').checked, clean: q('[data-clean]').checked
        };
        if (!opts.sign && !opts.wm && !opts.num && !opts.clean) { showToast('Elige al menos una acción.', 'amber'); return false; }

        await withBusy('Procesando…', async () => {
            await loadScript(CDN.jszip);
            const zip = new JSZip();
            const saved = { pdfPages, pdfSources, bookmarks, showPageNumbering, cleanOnExport, title: document.getElementById('doc-title-display').textContent };
            const wmEl = document.getElementById('watermark-text-el');
            const wmSaved = { text: wmEl.textContent, hidden: wmEl.classList.contains('hidden') };
            const evToggle = document.getElementById('evidence-toggle');
            const evSaved = evToggle.checked;
            let ok = 0;
            try {
                for (const [fi, file] of files.entries()) {
                    setBusy(`Procesando ${fi + 1} de ${files.length}: ${file.name}`);
                    try {
                        const bytes = new Uint8Array(await file.arrayBuffer());
                        const lib = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
                        const srcId = 'batch-' + fi;
                        const pages = lib.getPages().map((pg, i) => {
                            const box = pg.getCropBox();
                            const rot = pg.getRotation().angle % 180 !== 0;
                            const w = rot ? box.height : box.width, h = rot ? box.width : box.height;
                            return { id: `b${fi}-${i}`, rotation: 0, srcId, srcIndex: i, h: Math.round(PAGE_W * h / w), objects: [] };
                        });
                        if (opts.sign) {
                            const targets = opts.where === 'all' ? pages : [opts.where === 'first' ? pages[0] : pages[pages.length - 1]];
                            targets.forEach(p => p.objects.push(makeSignatureObject(opts.sign, p, opts.date)));
                        }
                        pdfPages = pages;
                        pdfSources = [{ id: srcId, name: file.name, bytes, hash: await sha256Hex(bytes) }];
                        bookmarks = [];
                        showPageNumbering = opts.num;
                        cleanOnExport = opts.clean;
                        document.getElementById('doc-title-display').textContent = file.name;
                        wmEl.textContent = opts.wm;
                        wmEl.classList.toggle('hidden', !opts.wm);
                        evToggle.checked = !!opts.evidence;
                        const out = await buildPDFBytes(null);
                        zip.file(file.name.replace(/\.pdf$/i, '') + (opts.sign ? '_firmado' : '_procesado') + '.pdf', out);
                        ok++;
                    } catch (e) {
                        console.error(file.name, e);
                        showToast(`No se pudo procesar "${file.name}" (¿protegido con contraseña?).`, 'rose');
                    }
                }
            } finally {
                ({ pdfPages, pdfSources, bookmarks, showPageNumbering, cleanOnExport } = saved);
                document.getElementById('doc-title-display').textContent = saved.title;
                wmEl.textContent = wmSaved.text;
                wmEl.classList.toggle('hidden', wmSaved.hidden);
                evToggle.checked = evSaved;
            }
            if (ok) {
                downloadBlob(await zip.generateAsync({ type: 'blob' }), `PascalPDF_lote_${new Date().toISOString().slice(0, 10)}.zip`);
                showToast(`${ok} de ${files.length} PDF procesados y descargados en un ZIP.`, 'emerald');
            }
        });
    }

    // ------------------------------------------------------------------ 11. Comparar dos versiones
    function compareDialog() {
        const body = `
            <p class="text-zinc-400">Compara el texto de dos PDF y resalta lo que cambió. No compara el diseño.</p>
            <div class="space-y-1.5"><span class="text-[11px] text-zinc-400">Versión anterior</span>
                <select data-a class="${field}"><option value="current">El documento abierto</option><option value="file">Otro archivo…</option></select>
                <input data-afile type="file" accept="application/pdf" class="hidden ${field}"></div>
            <div class="space-y-1.5"><span class="text-[11px] text-zinc-400">Versión nueva</span>
                <input data-bfile type="file" accept="application/pdf" class="${field}"></div>`;
        const d = dialog({ title: 'Comparar dos versiones', body, actions: [{ label: 'Cancelar' }, { label: 'Comparar', primary: true, onClick: (el) => runCompare(el) }] });
        const a = d.el.querySelector('[data-a]');
        a.onchange = () => d.el.querySelector('[data-afile]').classList.toggle('hidden', a.value !== 'file');
    }

    async function runCompare(el) {
        const aMode = el.querySelector('[data-a]').value;
        const aFile = el.querySelector('[data-afile]').files[0];
        const bFile = el.querySelector('[data-bfile]').files[0];
        if (!bFile || (aMode === 'file' && !aFile)) { showToast('Elige los dos documentos.', 'amber'); return false; }
        let result = null;
        await withBusy('Comparando…', async () => {
            await loadScript(CDN.diff);
            const aBytes = aMode === 'current' ? await currentDocumentBytes() : new Uint8Array(await aFile.arrayBuffer());
            const aText = (await extractPdfText(aBytes)).join('\n\n');
            const bText = (await extractPdfText(new Uint8Array(await bFile.arrayBuffer()))).join('\n\n');
            if (!aText.trim() || !bText.trim()) throw userError('Uno de los documentos no tiene texto (¿es escaneado?). Usa primero OCR.');
            result = { parts: Diff.diffWordsWithSpace(aText, bText), aName: aMode === 'current' ? document.getElementById('doc-title-display').textContent : aFile.name, bName: bFile.name };
        });
        if (!result) return false;
        const added = result.parts.filter(p => p.added).reduce((n, p) => n + p.value.trim().split(/\s+/).filter(Boolean).length, 0);
        const removed = result.parts.filter(p => p.removed).reduce((n, p) => n + p.value.trim().split(/\s+/).filter(Boolean).length, 0);
        const html = result.parts.map(p => {
            const t = escapeHtml(p.value);
            if (p.added) return `<ins style="background:#d9f99d;color:#14532d;text-decoration:none;border-radius:3px;padding:0 2px">${t}</ins>`;
            if (p.removed) return `<del style="background:#fecaca;color:#7f1d1d;border-radius:3px;padding:0 2px">${t}</del>`;
            return t;
        }).join('');
        const report = `<!doctype html><meta charset="utf-8"><title>Comparación</title><body style="font:14px/1.6 system-ui;max-width:860px;margin:32px auto;padding:0 16px;color:#1f1f1f"><h1 style="font-size:20px">Comparación de documentos</h1><p>Anterior: <b>${escapeHtml(result.aName)}</b><br>Nueva: <b>${escapeHtml(result.bName)}</b><br>${added} palabra(s) agregadas · ${removed} eliminadas · generado con PascalPDF</p><div style="white-space:pre-wrap;border:1px solid #e9e8e9;border-radius:12px;padding:16px">${html}</div></body>`;
        const body = document.createElement('div');
        body.innerHTML = `
            <p><span class="text-lime-300 font-semibold">${added}</span> palabra(s) agregadas · <span class="text-rose-300 font-semibold">${removed}</span> eliminadas</p>
            <div class="bg-white text-zinc-900 rounded-xl p-4 whitespace-pre-wrap leading-relaxed text-[13px]">${html}</div>`;
        dialog({
            title: 'Resultado de la comparación', body, wide: true,
            actions: [{ label: 'Cerrar' }, { label: 'Descargar informe', primary: true, onClick: () => { downloadBlob(new Blob([report], { type: 'text/html;charset=utf-8' }), 'comparacion.html'); return false; } }]
        });
    }

    // ------------------------------------------------------------------ 12. OCR
    async function runOCR() {
        const targets = pdfPages.map((p, i) => ({ p, i })).filter(({ p }) => p.bgImage && !(p.textItems || []).some(t => !t.ocr) && !p.ocrWords);
        if (!targets.length) {
            return showToast(pdfPages.some(p => p.bgImage) ? 'Las páginas ya tienen texto; no hace falta OCR.' : 'Abre primero un PDF escaneado o convierte imágenes a PDF.', 'amber');
        }
        await withBusy('Preparando el reconocimiento de texto (la primera vez descarga unos 10 MB)…', async () => {
            await loadScript(CDN.tesseract);
            const worker = await Tesseract.createWorker('spa', 1, {
                workerPath: CDN.tesseractWorker, corePath: CDN.tesseractCore, langPath: CDN.tesseractLang,
                logger: m => { if (m.status === 'recognizing text') setBusy(`Reconociendo texto… ${Math.round(m.progress * 100)} %`); }
            });
            try {
                for (const [n, { p, i }] of targets.entries()) {
                    setBusy(`Reconociendo texto en la página ${i + 1} (${n + 1} de ${targets.length})…`);
                    const img = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = p.bgImage; });
                    const { data } = await worker.recognize(p.bgImage);
                    const f = PAGE_W / img.naturalWidth;
                    const words = [];
                    const items = [];
                    (data.lines || []).forEach(line => {
                        const text = line.text.replace(/\s+/g, ' ').trim();
                        if (!text || line.confidence < 30) return;
                        const b = line.bbox;
                        items.push({ x: b.x0 * f, y: b.y0 * f, w: (b.x1 - b.x0) * f, h: (b.y1 - b.y0) * f, size: (b.y1 - b.y0) * f * 0.85, text, bold: false, family: 'Helvetica, Arial, sans-serif', used: false, ocr: true });
                        line.words.forEach(w => {
                            const t = w.text.trim();
                            if (t) words.push({ text: t, x: w.bbox.x0 * f, y: w.bbox.y0 * f, w: (w.bbox.x1 - w.bbox.x0) * f, h: (w.bbox.y1 - w.bbox.y0) * f });
                        });
                    });
                    p.ocrWords = words;
                    p.textItems = items;
                }
            } finally {
                await worker.terminate();
            }
            renderCurrentPage();
            showToast(`Texto reconocido en ${targets.length} página(s). Ahora puedes buscar, copiar y editar ese texto, y el PDF guardado será buscable. Revisa: el OCR puede equivocarse.`, 'emerald');
        });
    }

    // Capa de texto invisible (para buscar y copiar) en las páginas con OCR
    function drawOcrLayer(page, pData, ctx) {
        if (!pData.ocrWords || !pData.ocrWords.length) return;
        const font = ctx.fonts.regular;
        pData.ocrWords.forEach(w => {
            const t = toWinAnsi(w.text);
            if (!t) return;
            const unit = font.widthOfTextAtSize(t, 1);
            if (!unit) return;
            const size = Math.max(2, w.w / unit);
            const p = ctx.pt(w.x, w.y + w.h * 0.82);
            page.drawText(t, { x: p.x, y: p.y, size: size * ctx.k, font, opacity: 0, rotate: ctx.rot });
        });
    }

    // ------------------------------------------------------------------ 13. Contraseña (qpdf)
    async function qpdf(input, args) {
        await loadScript(CDN.qpdf);
        const factory = window.QPDFFactory || (window.QPDFFactory = window.Module);
        if (typeof factory !== 'function') throw userError('No se pudo cargar el componente de cifrado.');
        const mod = await factory({ locateFile: () => CDN.qpdfWasm, noInitialRun: true, print: () => {}, printErr: () => {} });
        mod.FS.writeFile('/in.pdf', input);
        let code;
        try { code = mod.callMain(args); } catch (e) { code = typeof e.status === 'number' ? e.status : (() => { throw e; })(); }
        if (code !== 0 && code !== 3) return { code, out: null };
        return { code, out: mod.FS.readFile('/out.pdf') };
    }

    function passwordDialog() {
        const body = `
            <p class="text-zinc-400">El PDF se cifra con AES de 256 bits en tu dispositivo. Sin la contraseña no se puede abrir. PascalIA no la conoce y no puede recuperarla.</p>
            <input data-p1 type="password" autocomplete="new-password" placeholder="Contraseña (mínimo 6 caracteres)" class="${field}">
            <input data-p2 type="password" autocomplete="new-password" placeholder="Repite la contraseña" class="${field}">
            <div class="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-2">
                <label class="flex items-center gap-2"><input data-print type="checkbox" checked class="w-4 h-4 accent-amber-400"> Permitir imprimir</label>
                <label class="flex items-center gap-2"><input data-copy type="checkbox" checked class="w-4 h-4 accent-amber-400"> Permitir copiar texto</label>
                <label class="flex items-center gap-2"><input data-modify type="checkbox" class="w-4 h-4 accent-amber-400"> Permitir modificar</label>
            </div>
            <p class="text-zinc-500">Los permisos los respetan la mayoría de lectores, pero no son una protección absoluta; la contraseña de apertura sí lo es.</p>`;
        dialog({
            title: 'Proteger con contraseña', body, actions: [{ label: 'Cancelar' }, {
                label: 'Guardar PDF protegido', primary: true, onClick: async (el) => {
                    const p1 = el.querySelector('[data-p1]').value, p2 = el.querySelector('[data-p2]').value;
                    if (p1.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres.', 'amber'); return false; }
                    if (p1 !== p2) { showToast('Las contraseñas no coinciden.', 'amber'); return false; }
                    const perms = [
                        '--print=' + (el.querySelector('[data-print]').checked ? 'full' : 'none'),
                        '--extract=' + (el.querySelector('[data-copy]').checked ? 'y' : 'n'),
                        '--modify=' + (el.querySelector('[data-modify]').checked ? 'all' : 'none')
                    ];
                    const owner = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
                    await withBusy('Cifrando el PDF…', async () => {
                        const bytes = await buildPDFBytes(null);
                        const r = await qpdf(bytes, ['--encrypt', p1, owner, '256', ...perms, '--', '/in.pdf', '/out.pdf']);
                        if (!r.out) throw userError('No se pudo cifrar el PDF.');
                        downloadBlob(new Blob([r.out], { type: 'application/pdf' }), `${baseName()}_protegido.pdf`);
                        showToast('PDF protegido descargado. Guarda la contraseña: no se puede recuperar.', 'emerald');
                    });
                }
            }]
        });
    }

    // Al abrir un PDF con contraseña: pedirla y quitar el cifrado en el dispositivo
    async function unlockPDF(bytes) {
        for (let attempt = 0; attempt < 3; attempt++) {
            const pw = prompt(attempt ? 'Contraseña incorrecta. Intenta de nuevo:' : 'Este PDF está protegido. Escribe la contraseña para abrirlo:');
            if (pw === null) throw userError('Apertura cancelada.');
            setBusy('Quitando la protección…');
            const r = await qpdf(bytes, ['--password=' + pw, '--decrypt', '/in.pdf', '/out.pdf']);
            if (r.out) {
                showToast('PDF desbloqueado. Si lo guardas, quedará sin contraseña (puedes volver a protegerlo).', 'indigo');
                return r.out;
            }
        }
        throw userError('No se pudo abrir: la contraseña no es correcta.');
    }

    // ------------------------------------------------------------------ 14. Comprimir
    async function compressBytes(bytes) {
        const { PDFDocument, PDFName, PDFNumber, PDFRawStream } = PDFLib;
        const doc = await PDFDocument.load(bytes);
        const ctx = doc.context;
        let changed = 0;
        for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
            if (!(obj instanceof PDFRawStream)) continue;
            const dict = obj.dict;
            if (dict.get(PDFName.of('Subtype'))?.toString() !== '/Image') continue;
            if (dict.get(PDFName.of('Filter'))?.toString() !== '/DCTDecode') continue;
            const cs = dict.get(PDFName.of('ColorSpace'))?.toString();
            if (cs !== '/DeviceRGB' && cs !== '/DeviceGray') continue;
            if (dict.get(PDFName.of('SMask')) || dict.get(PDFName.of('Mask'))) continue;
            const data = obj.contents;
            if (data.length < 60000) continue;
            let bmp;
            try { bmp = await createImageBitmap(new Blob([data], { type: 'image/jpeg' })); } catch (e) { continue; }
            const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(bmp.width * k);
            canvas.height = Math.round(bmp.height * k);
            canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
            const blob = await canvasBlob(canvas, 'image/jpeg', 0.62);
            const nb = new Uint8Array(await blob.arrayBuffer());
            if (nb.length >= data.length * 0.9) continue;
            const nd = dict.clone(ctx);
            nd.set(PDFName.of('Width'), PDFNumber.of(canvas.width));
            nd.set(PDFName.of('Height'), PDFNumber.of(canvas.height));
            nd.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
            nd.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
            nd.set(PDFName.of('Length'), PDFNumber.of(nb.length));
            nd.delete(PDFName.of('DecodeParms'));
            nd.delete(PDFName.of('Decode'));
            ctx.assign(ref, PDFRawStream.of(nd, nb));
            changed++;
        }
        const out = await doc.save({ useObjectStreams: true });
        return { out, changed };
    }

    async function compressAndSave() {
        await withBusy('Comprimiendo…', async () => {
            const original = await buildPDFBytes(null);
            const { out, changed } = await compressBytes(original);
            const best = out.length < original.length ? out : original;
            downloadBlob(new Blob([best], { type: 'application/pdf' }), `${baseName()}_comprimido.pdf`);
            const srcSize = pdfSources.reduce((a, s) => a + s.bytes.length, 0);
            showToast(`PDF comprimido: ${fmtBytes(best.length)}${srcSize ? ` (el original pesaba ${fmtBytes(srcSize)})` : ''}. ${changed ? `${changed} imagen(es) reducidas.` : 'No había imágenes grandes que reducir.'}`, 'emerald');
        });
    }

    // ------------------------------------------------------------------ 15. Ver firmas digitales de un PDF recibido
    const OID_HASH = { '2.16.840.1.101.3.4.2.1': 'SHA-256', '2.16.840.1.101.3.4.2.2': 'SHA-384', '2.16.840.1.101.3.4.2.3': 'SHA-512', '1.3.14.3.2.26': 'SHA-1' };
    const FORGE_MD = { 'SHA-256': 'sha256', 'SHA-384': 'sha384', 'SHA-512': 'sha512', 'SHA-1': 'sha1' };

    async function inspectSignatures(bytes) {
        await loadScript(CDN.forge);
        const latin = new TextDecoder('latin1').decode(bytes);
        const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
        const found = [];
        let m;
        while ((m = re.exec(latin))) {
            const [a, b, c, d] = m.slice(1).map(Number);
            const sig = { range: [a, b, c, d], coversAll: c + d === bytes.length };
            try {
                const hex = latin.slice(a + b, c).replace(/[<>\s]/g, '');
                const der = forge.util.hexToBytes(hex);
                const asn1 = forge.asn1.fromDer(der, { parseAllBytes: false });
                const p7 = forge.pkcs7.messageFromAsn1(asn1);
                const raw = p7.rawCapture;
                const cert = p7.certificates[0];
                const cn = (n) => (n.getField('CN') || n.getField('O') || {}).value || '(sin nombre)';
                sig.signer = cert ? cn(cert.subject) : '(sin certificado)';
                sig.issuer = cert ? cn(cert.issuer) : '';
                sig.selfSigned = cert ? cert.isIssuer(cert) : false;
                sig.validFrom = cert?.validity.notBefore;
                sig.validTo = cert?.validity.notAfter;
                const alg = OID_HASH[forge.asn1.derToOid(raw.digestAlgorithm)] || null;
                sig.alg = alg;
                const attrs = raw.authenticatedAttributes || [];
                let digest = null;
                attrs.forEach(at => {
                    const oid = forge.asn1.derToOid(at.value[0].value);
                    const val = at.value[1].value[0];
                    if (oid === '1.2.840.113549.1.9.4') digest = forge.util.bytesToHex(val.value);
                    if (oid === '1.2.840.113549.1.9.5') { try { sig.time = val.type === forge.asn1.Type.UTCTIME ? forge.asn1.utcTimeToDate(val.value) : forge.asn1.generalizedTimeToDate(val.value); } catch (e) { /* sin hora */ } }
                });
                if (alg && digest) {
                    const covered = new Uint8Array(b + d);
                    covered.set(bytes.subarray(a, a + b), 0);
                    covered.set(bytes.subarray(c, c + d), b);
                    const h = [...new Uint8Array(await crypto.subtle.digest(alg, covered))].map(x => x.toString(16).padStart(2, '0')).join('');
                    sig.integrity = h === digest;
                }
                // Firma criptográfica sobre los atributos firmados (solo RSA)
                if (cert && alg && attrs.length && cert.publicKey && cert.publicKey.n) {
                    try {
                        const set = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attrs);
                        const md = forge.md[FORGE_MD[alg]].create();
                        md.update(forge.asn1.toDer(set).getBytes());
                        sig.signatureValid = cert.publicKey.verify(md.digest().getBytes(), raw.signature);
                    } catch (e) { sig.signatureValid = false; }
                } else {
                    sig.signatureValid = null;
                }
            } catch (e) {
                console.warn(e);
                sig.error = true;
            }
            found.push(sig);
        }
        return found;
    }

    function viewSignaturesDialog() {
        pickFile('application/pdf', false).then(async ([file]) => {
            if (!file) return;
            let sigs = null;
            await withBusy('Revisando las firmas del PDF…', async () => { sigs = await inspectSignatures(new Uint8Array(await file.arrayBuffer())); });
            if (!sigs) return;
            const fmt = (d) => d ? new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
            const ok = (v, yes, no, unk) => v === true ? `<span class="text-emerald-300">✓ ${yes}</span>` : v === false ? `<span class="text-rose-300">✗ ${no}</span>` : `<span class="text-zinc-400">${unk}</span>`;
            const rows = sigs.map((s, i) => s.error
                ? `<div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800">Firma ${i + 1}: no se pudo leer.</div>`
                : `<div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <div class="text-sm font-semibold text-white">${escapeHtml(s.signer)}</div>
                    <div>Emitido por: ${escapeHtml(s.issuer)}${s.selfSigned ? ' (autofirmado)' : ''}</div>
                    <div>Firmó: ${fmt(s.time)} · Certificado vigente del ${fmt(s.validFrom)} al ${fmt(s.validTo)}</div>
                    <div>${ok(s.integrity, 'El contenido firmado no ha cambiado', 'El contenido firmado fue alterado', 'No se pudo comprobar el contenido')}</div>
                    <div>${ok(s.signatureValid, 'La firma criptográfica corresponde al certificado', 'La firma criptográfica no corresponde', 'Algoritmo no comprobable en el navegador')}</div>
                    <div>${s.coversAll ? 'Cubre todo el archivo.' : '<span class="text-amber-300">Después de esta firma el archivo tuvo cambios (otra firma o una edición).</span>'}</div>
                </div>`).join('');
            dialog({
                title: `Firmas digitales en ${file.name}`, wide: true,
                body: (sigs.length ? rows : '<p>Este PDF no tiene firmas digitales (certificados). Puede tener firmas electrónicas como imagen, que no se verifican así.</p>')
                    + '<p class="text-zinc-500 pt-2">PascalPDF comprueba la integridad y la firma con el certificado incluido. No verifica la cadena de confianza ni la revocación ante la entidad certificadora; para eso usa el validador de la entidad que emitió el certificado.</p>'
            });
        });
    }

    // ------------------------------------------------------------------ 16. Verificar un documento firmado con PascalPDF
    function verifyDialog() {
        const body = `
            <p class="text-zinc-400">Comprueba un PDF firmado con PascalPDF: lee su hoja de evidencia y, si tienes el archivo original, confirma que es el mismo que se firmó. Nada se sube.</p>
            <div class="space-y-1.5"><span class="text-[11px] text-zinc-400">PDF firmado (con hoja de evidencia)</span><input data-signed type="file" accept="application/pdf" class="${field}"></div>
            <div class="space-y-1.5"><span class="text-[11px] text-zinc-400">Archivo original (opcional)</span><input data-orig type="file" accept="application/pdf" class="${field}"></div>`;
        dialog({ title: 'Verificar documento firmado', body, actions: [{ label: 'Cancelar' }, { label: 'Verificar', primary: true, onClick: (el) => runVerify(el) }] });
    }

    async function runVerify(el) {
        const signed = el.querySelector('[data-signed]').files[0];
        const orig = el.querySelector('[data-orig]').files[0];
        if (!signed) { showToast('Elige el PDF firmado.', 'amber'); return false; }
        let html = null;
        await withBusy('Verificando…', async () => {
            const pages = await extractPdfText(new Uint8Array(await signed.arrayBuffer()));
            const ev = pages.find(t => t.includes('Hoja de evidencia de firma electr'));
            if (!ev) throw userError('Este PDF no tiene una hoja de evidencia de PascalPDF.');
            const hashes = [...ev.matchAll(/([0-9a-f]{32})\s*\n?\s*([0-9a-f]{32})/g)].map(m => m[1] + m[2]);
            const ids = [...ev.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)].map(m => m[0]);
            const doc = (ev.match(/Documento\s+(.+)/) || [])[1] || '—';
            const when = (ev.match(/Generada el\s+(.+)/) || [])[1] || '—';
            let check = '<p class="text-zinc-400">Sin archivo original: solo se muestra lo que dice la hoja.</p>';
            if (orig) {
                const h = await sha256Hex(new Uint8Array(await orig.arrayBuffer()));
                check = hashes.includes(h)
                    ? `<p class="text-emerald-300 text-sm font-semibold">✓ El archivo original coincide con la huella registrada.</p>`
                    : `<p class="text-rose-300 text-sm font-semibold">✗ El archivo original NO coincide: no es el mismo que se firmó, o fue modificado.</p>`;
                check += `<p class="font-mono text-[10px] text-zinc-500 break-all">Huella calculada: ${h}</p>`;
            }
            html = `
                ${check}
                <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <div>Documento: <b class="text-white">${escapeHtml(doc)}</b></div>
                    <div>Hoja generada: ${escapeHtml(when)}</div>
                    <div>Firmas registradas: ${ids.length}</div>
                    ${hashes.map(h => `<div class="font-mono text-[10px] text-zinc-400 break-all">Huella del original: ${h}</div>`).join('') || '<div>Documento creado en PascalPDF, sin archivo original.</div>'}
                </div>
                <p class="text-zinc-500">La hoja prueba qué archivo se firmó y con qué identificadores de firma. Las fechas vienen del dispositivo de quien firmó.</p>`;
        });
        if (!html) return false;
        dialog({ title: 'Resultado de la verificación', body: html });
    }

    // ------------------------------------------------------------------ firma reutilizable (lotes)
    function makeSignatureObject(sig, page, showDate) {
        const when = new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
        const obj = {
            id: 'sig-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            type: 'signature', signatureId: sig.id, signer: sig.signer,
            method: sig.kind === 'text' ? 'escrita' : (sig.kind === 'drawn' ? 'dibujada' : 'imagen'),
            x: 340, y: Math.max(40, pageHeight(page) - 170),
            text: sig.kind === 'text' ? sig.text : sig.signer,
            subtext: showDate ? `Firmado electrónicamente por ${sig.signer} · ${when}` : `Firmado electrónicamente por ${sig.signer}`,
            fontFamily: "'Caveat', cursive", fontSize: 30, color: '#1d4ed8', signedAt: new Date().toISOString()
        };
        if (sig.kind !== 'text') {
            const k = Math.min(220 / sig.w, 80 / sig.h, 1);
            Object.assign(obj, { src: sig.src, w: Math.round(sig.w * k), h: Math.round(sig.h * k) });
        }
        return obj;
    }

    // ------------------------------------------------------------------ ganchos para index.html
    window.PascalTools = {
        // ciclo de vida
        afterImport: async (newPages, srcId, bytes) => {
            const n = await detectAcroFields(newPages, srcId, bytes);
            if (n) setTimeout(() => showToast(`Este PDF tiene ${n} campo(s) de formulario: escribe directamente sobre ellos.`, 'emerald'), 400);
        },
        decoratePage: (page, layer) => { renderSearchHits(page, layer); renderAcroFields(page, layer); renderCrop(page, layer); },
        prepareSourceDoc, drawOcrLayer, applyCrop,
        finishDocument: (pdfDoc, list, full) => { if (full) writeOutline(pdfDoc, list); if (cleanOnExport) cleanDocument(pdfDoc); },
        unlockPDF, clearSearch, makeSignatureObject,
        // acciones del catálogo
        showFormInfo, applyRealRedaction, toggleClean, startCrop, removeCrop, searchDialog,
        exportImagesZip, imagesToPdf, exportText, batchDialog, compareDialog, runOCR,
        passwordDialog, compressAndSave, viewSignaturesDialog, verifyDialog,
        // para pruebas
        _inspectSignatures: inspectSignatures, _compressBytes: compressBytes
    };
})();
