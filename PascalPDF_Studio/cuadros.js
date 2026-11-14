// Cuadros de texto en PascalPDF: copiar, pegar y duplicar; cambiar el ancho arrastrando el borde
// derecho y el tamaño del cuadro con su texto arrastrando la esquina. Funciona con mouse y con el dedo.
// Atajos: Ctrl+C copia, Ctrl+V pega, Ctrl+D duplica (cuando no estás escribiendo en un campo).
(function () {
    'use strict';
    if (typeof pdfPages === 'undefined') return;
    const TIPOS = ['text', 'stamp', 'sticky'];
    let portapapeles = null;

    const css = `
    .cx-barra{position:absolute;left:0;bottom:calc(100% + 8px);display:flex;gap:2px;background:#1F1F1F;border-radius:12px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.3);z-index:40;white-space:nowrap;font:600 12px Inter,sans-serif;transform-origin:left bottom}
    .cx-barra button{border:0;background:none;color:#fff;border-radius:8px;min-width:34px;height:32px;padding:0 8px;cursor:pointer;display:flex;align-items:center;gap:5px;font:inherit}
    .cx-barra button:hover,.cx-barra button:focus-visible{background:#3a3a3a;outline:none}
    .cx-barra .cx-sep{width:1px;background:#444;margin:4px 2px}
    .cx-asa{position:absolute;z-index:41;background:#FFC107;border:2px solid #1F1F1F;touch-action:none}
    .cx-asa.ancho{top:50%;right:-9px;width:12px;height:28px;margin-top:-14px;border-radius:6px;cursor:ew-resize}
    .cx-asa.escala{right:-11px;bottom:-11px;width:20px;height:20px;border-radius:99px;cursor:nwse-resize}
    body.mobile-touch-mode .cx-asa.ancho{width:18px;height:40px;margin-top:-20px;right:-12px}
    body.mobile-touch-mode .cx-asa.escala{width:28px;height:28px;right:-15px;bottom:-15px}
    body.mobile-touch-mode .cx-barra button{min-width:40px;height:38px}`;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    const pagina = () => pdfPages[currentPageIndex];
    const seleccionado = () => pagina().objects.find(o => o.id === selectedObjectId);
    const nuevoId = (t) => t.slice(0, 3) + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const aviso = (t, c) => { if (window.showToast) showToast(t, c || 'emerald'); };

    function copiar(obj) {
        obj = obj || seleccionado();
        if (!obj || !TIPOS.includes(obj.type)) return false;
        portapapeles = JSON.parse(JSON.stringify(obj));
        try { if (navigator.clipboard && obj.text) navigator.clipboard.writeText(obj.text).catch(() => {}); } catch (e) { /* solo copia interna */ }
        aviso('Cuadro copiado. Pégalo en esta u otra página.');
        return true;
    }
    function pegar() {
        if (!portapapeles) return aviso('Primero copia un cuadro de texto.', 'amber');
        const o = JSON.parse(JSON.stringify(portapapeles));
        o.id = nuevoId(o.type);
        // Si se pega en la misma página, queda un poco desplazado para que se vea la copia
        const enMisma = pagina().objects.some(x => x.x === o.x && x.y === o.y);
        if (enMisma) { o.x += 16; o.y += 16; }
        o.x = Math.min(PAGE_W - 40, o.x);
        o.y = Math.min(pageHeight(pagina()) - 30, o.y);
        portapapeles = JSON.parse(JSON.stringify(o)); // pegar de nuevo sigue desplazando
        pagina().objects.push(o);
        selectObject(o.id);
    }
    function duplicar() {
        const obj = seleccionado();
        if (!obj || !TIPOS.includes(obj.type)) return;
        portapapeles = JSON.parse(JSON.stringify(obj));
        pegar();
    }
    function letra(delta) {
        const obj = seleccionado();
        if (!obj) return;
        obj.fontSize = Math.max(6, Math.min(120, Math.round((obj.fontSize || 14) + delta)));
        renderCurrentPage();
    }

    // Arrastre de un asa con pointer events (mouse, lápiz y dedo)
    function arrastrar(e, mover) {
        e.stopPropagation();
        e.preventDefault();
        const x0 = e.clientX, y0 = e.clientY;
        const asa = e.currentTarget;
        try { asa.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
        const mv = (ev) => { ev.preventDefault(); mover((ev.clientX - x0) / currentZoom, (ev.clientY - y0) / currentZoom); };
        const fin = () => {
            asa.removeEventListener('pointermove', mv);
            asa.removeEventListener('pointerup', fin);
            asa.removeEventListener('pointercancel', fin);
            renderCurrentPage();
        };
        asa.addEventListener('pointermove', mv);
        asa.addEventListener('pointerup', fin);
        asa.addEventListener('pointercancel', fin);
    }
    // Evita que tocar un control inicie el arrastre del cuadro completo
    const aislar = (el) => ['mousedown', 'touchstart', 'dblclick'].forEach(ev => el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));

    function decorar() {
        const obj = seleccionado();
        if (!obj || !TIPOS.includes(obj.type)) return;
        const el = document.querySelector(`#page-interactive-layer [data-id="${obj.id}"]`);
        if (!el || el.isContentEditable || el.querySelector('.cx-barra')) return;

        // Barra de acciones
        const barra = document.createElement('div');
        barra.className = 'cx-barra';
        barra.setAttribute('role', 'toolbar');
        barra.setAttribute('aria-label', 'Acciones del cuadro de texto');
        barra.innerHTML = `
            <button data-a="copiar" title="Copiar (Ctrl+C)" aria-label="Copiar"><i class="fa-regular fa-copy"></i></button>
            <button data-a="pegar" title="Pegar (Ctrl+V)" aria-label="Pegar"${portapapeles ? '' : ' style="opacity:.45"'}><i class="fa-solid fa-paste"></i></button>
            <button data-a="duplicar" title="Duplicar (Ctrl+D)" aria-label="Duplicar"><i class="fa-solid fa-clone"></i></button>
            <span class="cx-sep"></span>
            <button data-a="menos" title="Letra más pequeña" aria-label="Letra más pequeña">A−</button>
            <button data-a="mas" title="Letra más grande" aria-label="Letra más grande">A+</button>
            <span class="cx-sep"></span>
            <button data-a="editar" title="Editar el texto" aria-label="Editar el texto"><i class="fa-solid fa-pen"></i></button>
            <button data-a="borrar" title="Eliminar" aria-label="Eliminar"><i class="fa-solid fa-trash-can" style="color:#fda4af"></i></button>`;
        // La barra no crece con el zoom: se compensa para que siempre se vea del mismo tamaño
        barra.style.transform = `scale(${1 / (currentZoom || 1)})`;
        aislar(barra);
        barra.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            e.stopPropagation();
            ({ copiar: () => { copiar(); renderCurrentPage(); }, pegar, duplicar, menos: () => letra(-1), mas: () => letra(1),
               editar: () => window.startInlineEdit && startInlineEdit(obj.id), borrar: () => window.deleteSelectedObject && deleteSelectedObject() })[b.dataset.a]();
        });
        el.appendChild(barra);

        // Asa del borde derecho: ancho del cuadro (el texto se reacomoda)
        const ancho = document.createElement('div');
        ancho.className = 'cx-asa ancho';
        ancho.title = 'Arrastra para cambiar el ancho';
        aislar(ancho);
        ancho.addEventListener('pointerdown', (e) => {
            const w0 = obj.width || el.offsetWidth;
            obj.width = w0;
            arrastrar(e, (dx) => {
                obj.width = Math.round(Math.max(60, Math.min(PAGE_W - obj.x, w0 + dx)));
                el.style.width = obj.width + 'px';
            });
        });
        el.appendChild(ancho);

        // Asa de la esquina: cambia el tamaño del cuadro y del texto en proporción
        const escala = document.createElement('div');
        escala.className = 'cx-asa escala';
        escala.title = 'Arrastra para agrandar o achicar el cuadro y el texto';
        aislar(escala);
        escala.addEventListener('pointerdown', (e) => {
            const w0 = obj.width || el.offsetWidth, f0 = obj.fontSize || 14;
            arrastrar(e, (dx, dy) => {
                const k = Math.max(0.3, Math.min(6, (w0 + (dx + dy) / 2) / w0));
                obj.fontSize = Math.max(6, Math.min(120, Math.round(f0 * k)));
                obj.width = Math.round(Math.max(60, Math.min(PAGE_W - obj.x, w0 * k)));
                el.style.fontSize = obj.fontSize + 'px';
                el.style.width = obj.width + 'px';
            });
        });
        el.appendChild(escala);
    }

    // Se vuelve a decorar cada vez que se dibuja la página
    const dibujarOriginal = window.renderCurrentPage;
    window.renderCurrentPage = function () {
        const r = dibujarOriginal.apply(this, arguments);
        try { decorar(); } catch (e) { console.warn(e); }
        return r;
    };

    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        const k = e.key.toLowerCase();
        if (k === 'c' && seleccionado() && copiar()) { e.preventDefault(); renderCurrentPage(); }
        else if (k === 'v' && portapapeles) { e.preventDefault(); pegar(); }
        else if (k === 'd' && seleccionado()) { e.preventDefault(); duplicar(); }
    });

    window.PascalCuadros = { copiar, pegar, duplicar };
})();
