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
        'Exportar respuestas (CSV)', 'Guardar PDF', 'Verificar un documento firmado', 'Delegar mi firma', 'Firmas que me delegaron'
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
        // Con firmas en el documento, siempre se pregunta si va la hoja de evidencia
        if (!Array.isArray(indices) && documentSignatures().length && !(await preguntarEvidencia())) return;
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
                radicado: obj.sello ? obj.sello.radicado : null,
                delegacion_id: obj.delegacionId || null
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

    // Ventana al guardar: activar o desactivar la hoja de evidencia de firma electrónica
    function preguntarEvidencia() {
        const { hoja, cerrar } = PascalCuenta.ui;
        const t = document.getElementById('evidence-toggle');
        return new Promise((resolve) => {
            const n = documentSignatures().length;
            const h = hoja(`
                <h2>Guardar el PDF firmado</h2>
                <p class="pc-muted">El documento tiene ${n === 1 ? '1 firma' : n + ' firmas'}.</p>
                <label style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:16px;box-shadow:inset 0 0 0 1px #E9E9E9;cursor:pointer">
                    <input type="checkbox" data-evidencia ${!t || t.checked ? 'checked' : ''} style="width:20px;height:20px;margin-top:2px;accent-color:#FFB300">
                    <span><b>Agregar hoja de evidencia de firma electrónica</b><br><span class="pc-muted">Una página final con quién firmó, cuándo, el consecutivo y la huella SHA-256 del documento original, para comprobar después que no cambió.</span></span>
                </label>
                <div class="pc-fila"><button class="pc-btn pc-sec" data-no>Cancelar</button><button class="pc-btn" data-si>Guardar PDF</button></div>`);
            const fin = (ok) => {
                if (ok && t) {
                    t.checked = h.querySelector('[data-evidencia]').checked;
                    const m = document.getElementById('evidence-toggle-modal');
                    if (m) m.checked = t.checked;
                }
                cerrar();
                resolve(ok);
            };
            h.querySelector('[data-si]').onclick = () => fin(true);
            h.querySelector('[data-no]').onclick = () => fin(false);
            h.parentElement.querySelector('.pc-cerrar').addEventListener('click', () => resolve(false));
        });
    }

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

    // Tutorial de la primera vez (y desde «Mi cuenta → Ver el tutorial»)
    const porTexto = (t) => () => [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(t) && b.getBoundingClientRect().width > 0) || null;
    const PASOS = [
        { titulo: 'Bienvenido a PascalPDF', texto: 'Te mostramos en un minuto lo esencial: abrir, firmar, editar y guardar tus PDF. Todo se procesa en tu dispositivo.' },
        { el: 'label[for="pdf-upload-input"]', titulo: 'Abre tu PDF', texto: 'Empieza aquí. También puedes arrastrar el archivo a la página.' },
        { el: ['#mobile-bottom-dock button[onclick="openSignatureModal()"]', porTexto('Firmar (dibujo')], titulo: 'Firma con la tecnología de Pascal Sign', texto: 'Dibuja tu firma, escríbela, súbela o tómale una foto. Con Pascal Sign tienes el control de todas tus firmas: guardadas cifradas en tu dispositivo, con consecutivo e historial, delegables cuando quieras y listas también en tu celular con la app Pascal Sign.' },
        { titulo: 'Datos de la firma', texto: 'Debajo de la firma van tu nombre, la fecha, el objeto, el radicado (opcional) y un consecutivo automático, por ejemplo DTB-0001-2026. Puedes agregar la hoja de evidencia.' },
        { el: ['#floating-pagination-bar [data-deshacer]'], titulo: 'Deshacer y rehacer', texto: '¿Te equivocaste? Deshaz o rehaz cualquier cambio desde aquí. En el computador también con Ctrl+Z y Ctrl+Y.' },
        { el: '#btn-edit-text-mode', titulo: 'Edita el texto', texto: 'Corrige el texto del propio PDF: toca una línea y escribe. Está en el plan Suite ★.' },
        { el: porTexto('Pedir firma a otra persona'), titulo: 'Pide firmas', texto: 'Envía el documento a otra persona para que lo firme desde su celular o computador, con su propia cuenta.' },
        { el: ['#mobile-bottom-dock button[onclick="openModal(\'modal-all-features\')"]', '#btn-mode-full'], titulo: 'Todas las herramientas', texto: 'Firma en masa de PDF y Word, delegar tu firma, OCR, comparar, proteger, comprimir y más.' },
        { el: () => { const s = document.querySelector('[data-pascal-cuenta]'); return s ? s.closest('button') : null; }, titulo: 'Tu cuenta', texto: 'Tu plan, el historial de documentos firmados (PDF, CSV o TXT), la delegación de firma y los códigos de regalo.' },
        { el: 'header button[onclick^="exportAndDownloadPDF"]', titulo: 'Guarda', texto: 'Descarga el PDF firmado. Antes te preguntamos si agregas la hoja de evidencia. ¡Listo para empezar!' }
    ];
    window.PascalTutorialApp = (forzar) => window.PascalTutorial && PascalTutorial.iniciar('pascalpdf-tutorial-v1', PASOS, { forzar });
    document.addEventListener('pascal:lista', () => setTimeout(() => window.PascalTutorialApp(false), 700));

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
