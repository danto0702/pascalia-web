// Delegación de firma (PascalPDF y Pascal Sign): el titular autoriza a otra cuenta a usar una de sus firmas
// durante un periodo, abierta o solo para ciertos objetos, y puede suspenderla o revocarla cuando quiera.
// Cada uso queda en el historial del titular, con su consecutivo y el nombre de quien la usó.
(function () {
    'use strict';
    if (!window.PascalCuenta) return;
    const { api } = PascalCuenta;
    const { hoja, cerrar, aviso, esc, toast, conBoton } = PascalCuenta.ui;
    const fechaHora = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
    const local = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16); };

    // Imagen PNG de una firma guardada (las escritas se dibujan con su tipografía)
    async function firmaPNG(sig) {
        if (sig.kind === 'text') {
            try { await document.fonts.load("600 72px Caveat"); } catch (e) { /* tipografía de respaldo */ }
            const c = document.createElement('canvas'), cx = c.getContext('2d');
            cx.font = "600 72px Caveat, cursive";
            const w = Math.ceil(cx.measureText(sig.text).width) + 24;
            c.width = Math.min(1600, w); c.height = 110;
            cx.font = "600 72px Caveat, cursive"; cx.fillStyle = '#1d4ed8'; cx.textBaseline = 'middle';
            cx.fillText(sig.text, 12, 58);
            return c.toDataURL('image/png');
        }
        if (/^data:image\/png/.test(sig.src)) return sig.src;
        const img = new Image(); img.src = sig.src; await img.decode();
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        return c.toDataURL('image/png');
    }

    function estadoDe(d) {
        const ahora = Date.now();
        if (d.estado === 'revocada') return ['Revocada', 'pc-vencido'];
        if (d.estado === 'suspendida') return ['Suspendida', 'pc-vencido'];
        if (new Date(d.hasta).getTime() <= ahora) return ['Vencida', 'pc-vencido'];
        if (new Date(d.desde).getTime() > ahora) return ['Programada', ''];
        return ['Vigente', ''];
    }

    // ------------------------------------------------------------------ titular: crear y administrar
    async function gestionar() {
        if (!(await PascalCuenta.requiere(1, 'Delegar tu firma'))) return;
        const firmas = await ganchos.firmas();
        const h = hoja(`
            <h2>Delegar mi firma</h2>
            <p class="pc-muted">La persona usará tu firma desde su propia cuenta de PascalPDF. Cada documento queda en tu historial con su consecutivo y el nombre de quien la usó. Puedes suspender o revocar el permiso en cualquier momento.</p>
            ${firmas.length ? `
            <label class="pc-muted" for="dg-firma">Firma que delegas</label>
            <select class="pc-campo" id="dg-firma">${firmas.map((f, i) => `<option value="${i}">${esc(f.signer)} · ${f.kind === 'text' ? 'escrita' : f.kind === 'drawn' ? 'dibujada' : 'imagen'}</option>`).join('')}</select>
            <label class="pc-muted" for="dg-correo">Correo de la persona autorizada</label>
            <input class="pc-campo" id="dg-correo" type="email" placeholder="correo@ejemplo.com" autocomplete="off">
            <div class="pc-fila" style="margin-top:4px"><div><label class="pc-muted" for="dg-desde">Desde</label><input class="pc-campo" id="dg-desde" type="datetime-local"></div>
                <div><label class="pc-muted" for="dg-hasta">Hasta</label><input class="pc-campo" id="dg-hasta" type="datetime-local"></div></div>
            <fieldset style="border:0;padding:0;margin:8px 0 0"><legend class="pc-muted">¿Para qué documentos?</legend>
                <label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="radio" name="dg-modo" value="abierta" checked> Cualquier objeto</label>
                <label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="radio" name="dg-modo" value="restringida"> Solo para estos objetos</label></fieldset>
            <textarea class="pc-campo" id="dg-objetos" rows="3" placeholder="Un objeto por línea, por ejemplo:&#10;Certificado de cumplimiento&#10;Informe de actividades" hidden></textarea>
            <div class="pc-fila"><button class="pc-btn" data-crear>Delegar la firma</button></div>`
            : '<p class="pc-msg pc-err">Primero guarda una firma en este dispositivo (Firmar → crea tu firma con «Guardar esta firma»).</p>'}
            <div data-msg></div>
            <div class="pc-sec-t">Firmas que has delegado</div>
            <div data-lista><p class="pc-muted">Cargando…</p></div>`);
        const q = (s) => h.querySelector(s);
        if (firmas.length) {
            q('#dg-desde').value = local(new Date());
            q('#dg-hasta').value = local(new Date(Date.now() + 30 * 86400000));
            h.querySelectorAll('[name=dg-modo]').forEach(r => r.onchange = () => { q('#dg-objetos').hidden = h.querySelector('[name=dg-modo]:checked').value !== 'restringida'; });
            const b = q('[data-crear]');
            b.onclick = () => conBoton(b, async () => {
                aviso(q('[data-msg]'), '');
                const f = firmas[+q('#dg-firma').value];
                const restringida = h.querySelector('[name=dg-modo]:checked').value === 'restringida';
                const objetos = restringida ? q('#dg-objetos').value.split('\n').map(x => x.trim()).filter(Boolean) : [];
                if (restringida && !objetos.length) return aviso(q('[data-msg]'), 'Escribe al menos un objeto o elige «Cualquier objeto».');
                const correo = q('#dg-correo').value.trim().toLowerCase();
                if (!/^\S+@\S+\.\S+$/.test(correo)) return aviso(q('[data-msg]'), 'Revisa el correo de la persona autorizada.');
                const desde = new Date(q('#dg-desde').value), hasta = new Date(q('#dg-hasta').value);
                if (isNaN(desde) || isNaN(hasta) || hasta <= desde) return aviso(q('[data-msg]'), 'Revisa las fechas.');
                if (!confirm(`¿Autorizar a ${correo} a usar la firma de ${f.signer} del ${fechaHora(desde)} al ${fechaHora(hasta)}${objetos.length ? ' solo para: ' + objetos.join(', ') : ' para cualquier documento'}?`)) return;
                try {
                    await api('delegar_crear', { delegado_correo: correo, firma: { id: f.id, nombre: f.signer, png: await firmaPNG(f) }, objetos, desde: desde.toISOString(), hasta: hasta.toISOString() });
                    aviso(q('[data-msg]'), `Listo. Le enviamos un correo a ${correo}.`, true);
                    q('#dg-correo').value = ''; q('#dg-objetos').value = '';
                    listar();
                } catch (e) { aviso(q('[data-msg]'), e.message); }
            });
        }
        async function listar() {
            let r;
            try { r = await api('delegar_listar'); } catch (e) { q('[data-lista]').innerHTML = `<p class="pc-msg pc-err">${esc(e.message)}</p>`; return; }
            const l = q('[data-lista]');
            if (!r.otorgadas.length) { l.innerHTML = '<p class="pc-muted">Todavía no has delegado tu firma.</p>'; return; }
            l.innerHTML = r.otorgadas.map(d => {
                const [txt, cls] = estadoDe(d);
                return `<div style="border:1px solid #E9E9E9;border-radius:16px;padding:12px 14px;margin:8px 0">
                    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b style="font-size:14px;word-break:break-all">${esc(d.delegado_correo)}</b><span class="pc-badge ${cls}">${txt}</span></div>
                    <div class="pc-muted" style="font-size:13px;margin-top:4px">Firma de ${esc(d.firma_nombre)} · ${fechaHora(d.desde)} → ${fechaHora(d.hasta)}<br>${d.objetos.length ? 'Solo: ' + d.objetos.map(esc).join(', ') : 'Cualquier objeto'} · ${d.usos} ${d.usos === 1 ? 'uso' : 'usos'}</div>
                    ${d.estado === 'revocada' ? '' : `<div class="pc-fila" style="margin-top:10px">${d.estado === 'activa' ? `<button class="pc-btn pc-sec" data-est="suspendida" data-id="${d.id}">Suspender</button>` : `<button class="pc-btn pc-sec" data-est="activa" data-id="${d.id}">Reactivar</button>`}<button class="pc-btn pc-peligro" data-est="revocada" data-id="${d.id}">Revocar</button></div>`}
                </div>`;
            }).join('');
            l.querySelectorAll('[data-est]').forEach(b => b.onclick = () => conBoton(b, async () => {
                if (b.dataset.est === 'revocada' && !confirm('¿Revocar esta delegación? Se borra la imagen de tu firma de nuestro servidor y no se puede reactivar.')) return;
                try { await api('delegar_estado', { id: b.dataset.id, estado: b.dataset.est }); toast(b.dataset.est === 'activa' ? 'Delegación reactivada.' : b.dataset.est === 'suspendida' ? 'Delegación suspendida: ya no se puede usar.' : 'Delegación revocada.'); listar(); }
                catch (e) { aviso(q('[data-msg]'), e.message); }
            }));
        }
        listar();
    }

    // ------------------------------------------------------------------ delegado: usar una firma delegada
    async function vigentes() {
        const r = await api('delegar_listar');
        return r.recibidas.filter(d => d.vigente);
    }

    // Trae la firma (solo si la delegación está vigente) y pide el objeto si está restringida
    async function obtener(d, objetoInicial) {
        const r = await api('delegar_firma', { id: d.id });
        const img = new Image(); img.src = r.firma.png; await img.decode();
        return {
            delegacionId: d.id, objetos: r.objetos, titular: d.titular_nombre || d.titular_correo,
            sig: { id: r.firma.id, signer: r.firma.nombre, kind: 'image', src: r.firma.png, w: img.naturalWidth, h: img.naturalHeight, delegada: true },
            objeto: objetoInicial
        };
    }

    async function recibidas() {
        if (!(await PascalCuenta.requiere(1, 'Usar una firma delegada'))) return;
        const h = hoja(`<h2>Firmas que me delegaron</h2><p class="pc-muted">Úsalas solo en los documentos autorizados. Cada uso queda registrado en el historial del titular con tu nombre.</p><div data-lista><p class="pc-muted">Cargando…</p></div><div data-msg></div>`);
        const q = (s) => h.querySelector(s);
        let r;
        try { r = await api('delegar_listar'); } catch (e) { return aviso(q('[data-msg]'), e.message); }
        if (!r.recibidas.length) { q('[data-lista]').innerHTML = '<p class="pc-muted">Nadie te ha delegado su firma todavía. La persona titular debe hacerlo desde «Mi cuenta → Delegar mi firma» con tu correo.</p>'; return; }
        q('[data-lista]').innerHTML = r.recibidas.map((d, i) => {
            const [txt, cls] = estadoDe(d);
            return `<div style="border:1px solid #E9E9E9;border-radius:16px;padding:12px 14px;margin:8px 0">
                <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b style="font-size:14px">${esc(d.firma_nombre)}</b><span class="pc-badge ${cls}">${txt}</span></div>
                <div class="pc-muted" style="font-size:13px;margin-top:4px">De ${esc(d.titular_nombre || d.titular_correo)} · hasta ${fechaHora(d.hasta)}<br>${d.objetos.length ? 'Solo: ' + d.objetos.map(esc).join(', ') : 'Cualquier objeto'}</div>
                ${d.vigente ? `${d.objetos.length ? `<select class="pc-campo" data-obj="${i}">${d.objetos.map(o => `<option>${esc(o)}</option>`).join('')}</select>` : ''}
                <div class="pc-fila" style="margin-top:8px"><button class="pc-btn" data-usar="${i}">Firmar este documento</button></div>` : ''}
            </div>`;
        }).join('');
        h.querySelectorAll('[data-usar]').forEach(b => b.onclick = () => conBoton(b, async () => {
            const d = r.recibidas[+b.dataset.usar];
            if (!ganchos.hayDocumento()) return aviso(q('[data-msg]'), 'Primero abre el PDF que vas a firmar.');
            const sel = h.querySelector(`[data-obj="${b.dataset.usar}"]`);
            try {
                const x = await obtener(d, sel ? sel.value : null);
                cerrar();
                const c = PascalCuenta.cuenta;
                x.delegado = c ? (c.nombre || c.correo) : 'delegado';
                ganchos.estampar(x);
            } catch (e) { aviso(q('[data-msg]'), e.message); }
        }));
    }

    // Ganchos de cada aplicación: firmas guardadas, si hay documento abierto y cómo poner la firma.
    // Por defecto, los de PascalPDF; Pascal Sign los reemplaza con PascalDelegar.configurar().
    const ganchos = {
        firmas: async () => (typeof mySignatures !== 'undefined' ? mySignatures : []),
        hayDocumento: () => typeof pdfPages !== 'undefined' && pdfPages.length > 0,
        estampar: (x) => estamparPascalPDF(x)
    };
    function configurar(g) { Object.assign(ganchos, g); }

    // Pone la firma delegada en la página actual de PascalPDF
    function estamparPascalPDF(x) {
        const campo = document.getElementById('sello-objeto');
        const previo = campo ? campo.value : '';
        if (campo && x.objeto) campo.value = x.objeto;
        stampSignature(x.sig, false);
        if (campo) campo.value = previo;
        const page = pdfPages[currentPageIndex];
        const obj = page.objects.filter(o => o.type === 'signature').at(-1);
        obj.delegacionId = x.delegacionId;
        obj.method = 'imagen';
        if (obj.sello) {
            if (x.objeto) obj.sello.objeto = x.objeto;
            obj.sello.delegado = x.delegado;
        }
        if (window.renderCurrentPage) renderCurrentPage();
        toast(`Firma de ${x.sig.signer} agregada por delegación. Arrástrala a donde la necesites.`);
    }

    window.PascalDelegar = { gestionar, recibidas, vigentes, obtener, firmaPNG, configurar };

    // Herramientas en el catálogo (antes de que acceso.js asigne los planes)
    if (typeof SUITE_CATEGORIES !== 'undefined' && SUITE_CATEGORIES.sign) {
        SUITE_CATEGORIES.sign.tools.push(
            { label: 'Delegar mi firma', icon: 'fa-user-check', action: () => gestionar() },
            { label: 'Firmas que me delegaron', icon: 'fa-hand-holding-hand', action: () => recibidas() }
        );
    }
})();
