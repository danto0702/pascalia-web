// Deshacer y rehacer en PascalPDF. Guarda una foto liviana del documento (páginas, orden, rotación
// y objetos: firmas, textos, sellos, campos) después de cada cambio; las imágenes de fondo de las
// páginas no se copian, se reutilizan. Atajos: Ctrl+Z deshace, Ctrl+Y o Ctrl+Shift+Z rehace.
(function () {
    'use strict';
    if (typeof pdfPages === 'undefined') return;
    const MAX = 60;
    const PESADOS = ['bgImage', 'thumb'];
    let pila = [], rehacer = [], ultimo = null, restaurando = false, temporizador = null;

    // Foto del estado: texto JSON sin los campos pesados + mapa de esos campos por página
    function foto() {
        const pesados = {};
        const json = JSON.stringify(pdfPages, function (k, v) {
            if (PESADOS.includes(k)) { (pesados[this.id] = pesados[this.id] || {})[k] = v; return undefined; }
            return v;
        });
        return { json, pesados, pagina: currentPageIndex };
    }

    function restaurar(f) {
        restaurando = true;
        const paginas = JSON.parse(f.json);
        paginas.forEach(p => Object.assign(p, f.pesados[p.id] || {}));
        pdfPages = paginas;
        currentPageIndex = Math.min(Math.max(0, f.pagina), pdfPages.length - 1);
        try { if (window.selectObject) selectObject(null); } catch (e) { /* sin selección */ }
        try { renderCurrentPage(); } catch (e) { console.warn(e); }
        try { if (window.renderThumbnails) renderThumbnails(); } catch (e) { /* opcional */ }
        try { if (window.renderDocSignatures) renderDocSignatures(); } catch (e) { /* opcional */ }
        try { if (window.renderObjectsLayerList) renderObjectsLayerList(); } catch (e) { /* opcional */ }
        ultimo = foto();
        restaurando = false;
        pintar();
    }

    // Revisa si el documento cambió desde la última foto; si cambió, guarda la anterior para deshacer
    function revisar() {
        if (restaurando) return;
        const f = foto();
        if (!ultimo) { ultimo = f; return; }
        if (f.json === ultimo.json) return;
        pila.push(ultimo);
        if (pila.length > MAX) pila.shift();
        rehacer = [];
        ultimo = f;
        pintar();
    }
    const programar = () => { clearTimeout(temporizador); temporizador = setTimeout(revisar, 350); };

    function deshacer() {
        revisar();
        if (!pila.length) return aviso('No hay nada que deshacer.');
        rehacer.push(ultimo);
        restaurar(pila.pop());
    }
    function rehacerCambio() {
        revisar();
        if (!rehacer.length) return aviso('No hay nada que rehacer.');
        pila.push(ultimo);
        restaurar(rehacer.pop());
    }
    const aviso = (t) => { if (window.showToast) showToast(t, 'emerald'); };

    function pintar() {
        document.querySelectorAll('[data-deshacer]').forEach(b => { b.disabled = !pila.length; b.style.opacity = pila.length ? '' : '.4'; });
        document.querySelectorAll('[data-rehacer]').forEach(b => { b.disabled = !rehacer.length; b.style.opacity = rehacer.length ? '' : '.4'; });
    }

    // Cualquier interacción puede cambiar el documento: se revisa poco después
    ['pointerup', 'keyup', 'change', 'input', 'drop'].forEach(ev => document.addEventListener(ev, programar, true));
    // Cambios hechos por código (abrir PDF, firmar desde una ventana, herramientas) se detectan igual
    setInterval(() => { if (!document.hidden) revisar(); }, 1500);

    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return; // deshacer nativo del campo
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); deshacer(); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); rehacerCambio(); }
    });

    window.PascalDeshacer = { deshacer, rehacer: rehacerCambio, revisar };
    ultimo = foto();
    pintar();
})();
