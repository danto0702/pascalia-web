// Planes en PascalPDF: qué herramienta pide Pascal Sign Pro (nivel 1) y cuál PascalPDF Suite (nivel 2),
// y registro de cada firma en el historial de la cuenta (con la hora del servidor) antes de guardar.
(function () {
    'use strict';
    if (!window.PascalCuenta) return;

    // Herramientas incluidas en Pascal Sign Pro; todo lo demás del catálogo es PascalPDF Suite
    const PRO = new Set([
        'Firmar (dibujo, texto o imagen)', 'Pedir firma a otra persona', 'Casilla de firma para otra persona',
        'Firmar desde el celular (Pascal Sign)', 'Agregar texto', 'Fecha y hora', 'Mis firmas y evidencia',
        'Rellenar el formulario del PDF', 'Campo de texto', 'Casilla de verificación', 'Opción única', 'Lista desplegable',
        'Exportar respuestas (CSV)', 'Guardar PDF', 'Verificar un documento firmado'
    ]);
    const GRATIS = new Set(['Firmar desde el celular (Pascal Sign)']);

    Object.values(SUITE_CATEGORIES).forEach(cat => cat.tools.forEach(t => {
        if (GRATIS.has(t.label) || t.label === 'Guardar PDF') return; // Guardar PDF se controla abajo
        const nivel = PRO.has(t.label) ? 1 : 2;
        const original = t.action, nombre = t.label;
        t.action = async () => { if (await PascalCuenta.requiere(nivel, `«${nombre}»`)) original(); };
        if (nivel === 2) t.label += ' ★';
    }));

    // Editar el texto del PDF (botón de la barra y catálogo) es de la Suite
    const toggleOriginal = window.toggleTextEditMode;
    window.toggleTextEditMode = async function (force) {
        if (!textEditMode && force !== false && !(await PascalCuenta.requiere(2, 'Editar el texto del PDF'))) return;
        return toggleOriginal(force);
    };

    // Guardar el PDF pide plan activo y registra las firmas nuevas en el historial
    const exportarOriginal = window.exportAndDownloadPDF;
    window.exportAndDownloadPDF = async function (indices, filename) {
        if (!(await PascalCuenta.requiere(1, 'Guardar el PDF'))) return;
        const nuevas = documentSignatures().filter(({ obj }) => !obj.registroId);
        if (nuevas.length) {
            const src = pdfSources.find(s => pdfPages.some(p => p.srcId === s.id));
            const registros = await PascalCuenta.registrarFirmas(nuevas.map(({ obj }) => ({
                app: 'pascalpdf',
                documento_nombre: document.getElementById('doc-title-display').textContent || 'Documento.pdf',
                documento_tipo: 'Otro',
                documento_hash: src ? src.hash : null,
                firma_id: obj.signatureId,
                metodo: obj.method,
                paginas: pdfPages.length,
                firmante: obj.signer,
                objeto: obj.sello ? obj.sello.objeto : null,
                radicado: obj.sello ? obj.sello.radicado : null
            })));
            if (registros) registros.forEach((r, i) => {
                const o = nuevas[i].obj;
                o.registroId = r.id; o.registradoEn = r.firmado_en;
                if (o.sello && r.consecutivo) o.sello.consecutivo = r.consecutivo;
            });
        }
        // Toda firma lleva consecutivo; si no se pudo registrar, se usa el contador del dispositivo
        documentSignatures().forEach(({ obj }) => { if (obj.sello && !obj.sello.consecutivo) obj.sello.consecutivo = PascalSello.consecutivoLocal(obj.signer); });
        if (window.renderCurrentPage) renderCurrentPage();
        return exportarOriginal(indices, filename);
    };

    // Toda descarga (páginas, imágenes, ZIP, comprimidos, protegidos, TXT, CSV…) exige cuenta con plan activo.
    // La copia de respaldo de tus firmas (.pascalfirma) solo exige haber entrado.
    const descargarOriginal = window.downloadBlob;
    window.downloadBlob = async function (blob, filename) {
        const respaldo = /\.pascalfirma$/i.test(filename || '');
        if (!(await PascalCuenta.requiere(respaldo ? 0 : 1, 'Descargar archivos'))) return;
        return descargarOriginal(blob, filename);
    };

    // Imprimir también exige plan activo
    const imprimirOriginal = window.print.bind(window);
    window.print = async function () { if (await PascalCuenta.requiere(1, 'Imprimir el documento')) imprimirOriginal(); };

    // Botón de cuenta en la barra superior
    function montar() {
        const guardar = document.querySelector('header button[onclick^="exportAndDownloadPDF"]');
        if (!guardar || document.querySelector('[data-pascal-cuenta]')) return;
        const b = document.createElement('button');
        b.className = 'hdr-btn px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition border border-zinc-700';
        b.setAttribute('aria-label', 'Mi cuenta');
        b.innerHTML = '<i class="fa-solid fa-circle-user text-amber-400"></i><span class="hidden sm:inline" data-pascal-cuenta>Entrar</span>';
        b.onclick = () => PascalCuenta.abrir();
        guardar.parentElement.insertBefore(b, guardar);
        PascalCuenta.cargar();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
