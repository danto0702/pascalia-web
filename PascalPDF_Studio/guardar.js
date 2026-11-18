// Guardar sobre el mismo archivo: en Chrome y Edge de computador se abre el PDF con acceso de escritura
// (File System Access API) y «Guardar PDF» lo reemplaza. Donde el navegador no lo permite (celulares,
// Safari, Firefox) se descarga con el mismo nombre del archivo original.
(function () {
    'use strict';
    if (typeof window.exportAndDownloadPDF !== 'function' || typeof window.importPDFFile !== 'function') return;
    const puede = typeof window.showOpenFilePicker === 'function';
    let actual = { handle: null, nombre: null };
    let pendiente = null; // manejador obtenido al abrir o soltar el archivo, antes de cargarlo

    const TIPOS = [{ description: 'PDF o Word', accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], 'application/msword': ['.doc'] } }];

    // «Abrir PDF» con acceso para guardar encima (solo donde el navegador lo permite)
    if (puede) {
        document.addEventListener('click', async (e) => {
            const l = e.target.closest('label[for="pdf-upload-input"]');
            if (!l) return;
            e.preventDefault();
            let h;
            try { [h] = await window.showOpenFilePicker({ types: TIPOS, multiple: false }); }
            catch (err) { return; } // cancelado
            const f = await h.getFile();
            pendiente = /\.pdf$/i.test(f.name) ? h : null;
            await importPDFFile(f, false);
        }, true);
        // Arrastrar y soltar: también se guarda el acceso al archivo
        const vp = document.getElementById('pdf-viewport');
        if (vp) vp.addEventListener('drop', (e) => {
            const it = [...(e.dataTransfer.items || [])].find(i => i.kind === 'file' && i.getAsFileSystemHandle);
            if (!it) return;
            const p = it.getAsFileSystemHandle();
            p.then(h => { if (h && h.kind === 'file' && /\.pdf$/i.test(h.name)) { if (actual.nombre === h.name) actual.handle = h; else pendiente = h; } }).catch(() => {});
        }, true);
    }

    // Al cargar un documento nuevo se recuerda su archivo de origen
    const importar0 = window.importPDFFile;
    window.importPDFFile = async function (file, append) {
        if (!append && file) {
            const h = pendiente && pendiente.name === file.name ? pendiente : null;
            actual = { handle: h, nombre: file.name };
        }
        pendiente = null;
        return importar0.apply(this, arguments);
    };

    const nombreDoc = () => {
        const t = (document.getElementById('doc-title-display') || {}).textContent || 'Documento.pdf';
        return /\.pdf$/i.test(t) ? t : t.replace(/\.[^.]+$/, '') + '.pdf';
    };

    async function escribir(h, bytes) {
        if (h.queryPermission && (await h.queryPermission({ mode: 'readwrite' })) !== 'granted') {
            if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') throw Object.assign(new Error('sin permiso'), { permiso: true });
        }
        const w = await h.createWritable();
        await w.write(new Blob([bytes], { type: 'application/pdf' }));
        await w.close();
    }

    const exportar0 = window.exportAndDownloadPDF;
    window.exportAndDownloadPDF = async function (indices, filename) {
        // Exportar páginas sueltas o con otro nombre sigue siendo una descarga aparte
        if (Array.isArray(indices) || filename) return exportar0.apply(this, arguments);
        if (!window.PDFLib) return exportar0.apply(this, arguments);
        setBusy(actual.handle ? 'Guardando en tu archivo…' : 'Generando tu PDF…');
        try {
            const bytes = await buildPDFBytes(null);
            if (actual.handle) {
                try {
                    await escribir(actual.handle, bytes);
                    showToast(`Guardado en «${actual.handle.name}».`, 'emerald');
                    return;
                } catch (e) {
                    showToast(e.permiso ? 'No diste permiso para guardar en el archivo: se descargó una copia.' : 'No se pudo guardar en el archivo original: se descargó una copia.', 'amber');
                }
            }
            downloadBlob(new Blob([bytes], { type: 'application/pdf' }), nombreDoc());
            if (!actual.handle) showToast(puede ? 'PDF descargado. Para guardar encima del original, ábrelo con «Abrir PDF».' : 'PDF descargado con el mismo nombre. Este navegador no permite reemplazar el archivo original.', 'emerald');
        } catch (e) {
            console.error(e);
            showToast('Error al generar el PDF: ' + (e && e.message ? e.message : e), 'rose');
        } finally {
            setBusy(null);
        }
    };

    // El permiso de escritura debe pedirse en el mismo toque de «Guardar» (antes de las ventanas del plan y la evidencia)
    const pedirPermiso = () => {
        const h = actual.handle;
        if (h && h.requestPermission) h.queryPermission({ mode: 'readwrite' }).then(st => { if (st !== 'granted') return h.requestPermission({ mode: 'readwrite' }); }).catch(() => {});
    };
    document.addEventListener('click', (e) => {
        const b = e.target.closest('button, [role="menuitem"], .tool-item, a, div');
        if (b && /Guardar PDF/.test(b.getAttribute('aria-label') || b.textContent || '') && (b.textContent || '').length < 60) pedirPermiso();
    }, true);

    // Ctrl+S / Cmd+S guarda
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); pedirPermiso(); window.exportAndDownloadPDF(); }
    });

    window.PascalGuardar = { get archivo() { return actual.handle ? actual.handle.name : null; } };
})();
