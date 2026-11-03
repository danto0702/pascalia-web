// Pedir la firma de otra persona. El documento se cifra en este navegador y la clave viaja solo
// en el enlace que comparte el remitente: el servidor guarda el archivo cifrado y los datos del registro.
(function () {
    'use strict';
    const API = window.PASCALPDF_API;
    if (!API) return; // servicio sin activar: la opción no aparece

    const STORE_KEY = 'pascalpdf-solicitudes';
    const TIPOS = ['Contrato', 'Cuenta de cobro', 'Informe', 'Acta', 'Autorización', 'Certificado', 'Otro'];
    const field = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white';

    const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

    async function api(accion, datos) {
        const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, token: localStorage.getItem('pascalpdf-sesion'), ...datos }) });
        let j = {};
        try { j = await r.json(); } catch (e) { /* respuesta vacía */ }
        if (!r.ok || !j.ok) throw Object.assign(new Error(j.error || 'No se pudo conectar con el servicio.'), { userMessage: j.error || 'No se pudo conectar con el servicio. Revisa tu conexión.' });
        return j;
    }

    function guardadas() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; }
    }
    function guardar(list) {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 50))); } catch (e) { /* sin almacenamiento */ }
    }
    const enlaceFirma = (s) => `${location.origin}/PascalPDF_Studio/firmar/#s=${s.id}.${s.key}`;
    const enlaceSeguimiento = (s) => `${location.origin}/PascalPDF_Studio/firmar/#t=${s.id}.${s.key}.${s.token}`;

    // ---------- casillas de firma para la otra persona
    function agregarCasilla() {
        const page = pdfPages[currentPageIndex];
        const obj = { id: 'req-' + Date.now(), type: 'sig-request', x: 60, y: Math.max(60, pageHeight(page) - 190), w: 230, h: 80, text: 'Firma de la otra persona' };
        page.objects.push(obj);
        selectObject(obj.id);
        showToast('Casilla agregada. Arrástrala a donde debe firmar la otra persona.', 'indigo');
    }

    function camposDelDocumento() {
        const campos = [];
        pdfPages.forEach((p, i) => p.objects.forEach(o => {
            if (o.type !== 'sig-request') return;
            const H = pageHeight(p);
            campos.push({ pagina: i, x: o.x / PAGE_W, y: o.y / H, w: (o.w || 230) / PAGE_W, h: (o.h || 80) / H });
        }));
        return campos;
    }

    // ---------- diálogo de solicitud
    async function abrir() {
        // Con cuentas activas, pedir firmas exige iniciar sesión y un plan (el servidor descuenta el cupo)
        const conCuenta = !!(window.PascalCuenta && PascalCuenta.activa);
        if (conCuenta && !(await PascalCuenta.requiere(1, 'Pedir firmas a otras personas'))) return;
        const miCuenta = conCuenta ? PascalCuenta.cuenta : null;
        let campos = camposDelDocumento();
        if (!campos.length) {
            agregarCasilla();
            campos = camposDelDocumento();
        }
        let nombreRemitente = '';
        try { nombreRemitente = localStorage.getItem('pascalpdf-signer') || ''; } catch (e) { /* nada */ }
        const wrap = document.createElement('div');
        wrap.className = 'fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-open';
        wrap.innerHTML = `
            <div class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl">
                <div class="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                    <h3 class="font-bold text-white text-sm">Pedir firma a otra persona</h3>
                    <button data-close class="text-zinc-400 hover:text-white" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-5 space-y-3 text-xs text-zinc-300 overflow-y-auto">
                    <div data-paso1 class="space-y-3">
                        <p class="text-zinc-400">El documento se cifra en tu dispositivo. Recibirás un enlace para enviárselo a la persona por WhatsApp o correo; ella confirma su correo con un código antes de ver el documento. PascalIA no puede leerlo.</p>
                        <p class="text-zinc-400">Casillas de firma marcadas: <b class="text-white">${campos.length}</b> (puedes moverlas en la página antes de continuar).</p>
                        <input data-rn class="${field}" placeholder="Tu nombre" value="${escapeHtml(nombreRemitente)}">
                        <input data-rc class="${field}" type="email" autocomplete="email" placeholder="Tu correo (te enviamos un código)" ${miCuenta ? `value="${escapeHtml(miCuenta.correo)}" readonly hidden` : ''}>
                        ${miCuenta ? `<p class="text-zinc-400">Solicitudes de firma este mes: <b class="text-white">${miCuenta.solicitudes.usadas} de ${miCuenta.solicitudes.cupo}</b>${miCuenta.solicitudes.extra ? ` · ${miCuenta.solicitudes.extra} adicionales` : ''}.</p>` : ''}
                        <input data-fn class="${field}" placeholder="Nombre de quien debe firmar">
                        <input data-fc class="${field}" type="email" placeholder="Correo de quien debe firmar">
                        <select data-tipo class="${field}">${TIPOS.map(t => `<option>${t}</option>`).join('')}</select>
                        <textarea data-msg class="${field}" rows="2" maxlength="500" placeholder="Mensaje para quien firma (opcional)"></textarea>
                        <label class="flex items-start gap-2"><input data-decl type="checkbox" class="mt-0.5 w-4 h-4 accent-amber-400"><span>Declaro que tengo una razón legítima para pedir esta firma y para compartir el correo de esa persona, y acepto los <a href="/PascalPDF_Studio/terminos/" target="_blank" rel="noopener" class="underline">términos</a> y la <a href="/PascalPDF_Studio/politica/" target="_blank" rel="noopener" class="underline">política de datos</a> de PascalPDF.</span></label>
                    </div>
                    <div data-paso2 class="space-y-3 hidden">
                        <p>Te enviamos un código a <b data-rcm class="text-white"></b>.</p>
                        <input data-codigo class="${field} tracking-[0.4em] text-center text-lg" inputmode="numeric" maxlength="6" placeholder="000000">
                    </div>
                    <div data-paso3 class="space-y-3 hidden"></div>
                </div>
                <div class="px-5 pb-5 flex justify-end gap-2">
                    <button data-cancel class="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium">Cancelar</button>
                    <button data-next class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold">Enviarme el código</button>
                </div>
            </div>`;
        document.body.appendChild(wrap);
        const q = (s) => wrap.querySelector(s);
        const close = () => wrap.remove();
        if (miCuenta) q('[data-next]').textContent = 'Crear el enlace';
        q('[data-close]').onclick = close;
        q('[data-cancel]').onclick = close;
        let paso = 1;
        q('[data-next]').onclick = async () => {
            const btn = q('[data-next]');
            const datos = {
                remitente_nombre: q('[data-rn]').value.trim(), correo: q('[data-rc]').value.trim(),
                firmante_nombre: q('[data-fn]').value.trim(), firmante_correo: q('[data-fc]').value.trim(),
                documento_tipo: q('[data-tipo]').value, mensaje: q('[data-msg]').value.trim()
            };
            btn.disabled = true;
            try {
                if (paso === 1) {
                    if (!datos.remitente_nombre || !datos.correo || !datos.firmante_nombre || !datos.firmante_correo) return showToast('Completa todos los datos.', 'amber');
                    if (!q('[data-decl]').checked) return showToast('Marca la declaración para continuar.', 'amber');
                    if (miCuenta) {
                        // Con sesión no hace falta el código al correo
                        const s = await crear(datos, null);
                        if (!s) return;
                        q('[data-paso1]').classList.add('hidden');
                        mostrarEnlaces(q('[data-paso3]'), s);
                        q('[data-paso3]').classList.remove('hidden');
                        q('[data-cancel]').classList.add('hidden');
                        btn.textContent = 'Listo';
                        paso = 3;
                        if (window.PascalCuenta) PascalCuenta.cargar();
                        return;
                    }
                    await api('codigo_remitente', { correo: datos.correo });
                    q('[data-paso1]').classList.add('hidden');
                    q('[data-paso2]').classList.remove('hidden');
                    q('[data-rcm]').textContent = datos.correo;
                    btn.textContent = 'Crear el enlace';
                    paso = 2;
                    setTimeout(() => q('[data-codigo]').focus(), 50);
                } else if (paso === 2) {
                    const codigo = q('[data-codigo]').value.trim();
                    if (!/^\d{6}$/.test(codigo)) return showToast('Escribe los 6 dígitos del código.', 'amber');
                    const s = await crear(datos, codigo);
                    if (!s) return;
                    q('[data-paso2]').classList.add('hidden');
                    mostrarEnlaces(q('[data-paso3]'), s);
                    q('[data-paso3]').classList.remove('hidden');
                    q('[data-cancel]').classList.add('hidden');
                    btn.textContent = 'Listo';
                    paso = 3;
                } else {
                    close();
                }
            } catch (e) {
                showToast(e.userMessage || e.message, 'rose');
            } finally {
                btn.disabled = false;
            }
        };
    }

    async function crear(datos, codigo) {
        setBusy('Cifrando y subiendo el documento…');
        try {
            const campos = camposDelDocumento();
            const bytes = await buildPDFBytes(pdfPages.map((_, i) => i));
            const documento_hash = hex(await crypto.subtle.digest('SHA-256', bytes));
            const clave = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, bytes));
            const paquete = new Uint8Array(12 + cifrado.length);
            paquete.set(iv, 0);
            paquete.set(cifrado, 12);
            const documento_nombre = document.getElementById('doc-title-display').textContent || 'Documento.pdf';
            const r = await api('crear', { ...datos, codigo, documento_nombre, documento_hash, campos });
            const up = await fetch(r.subida, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' }, body: paquete });
            if (!up.ok) throw Object.assign(new Error('subida'), { userMessage: 'No se pudo subir el documento cifrado. Intenta de nuevo.' });
            const s = {
                id: r.id, token: r.token_remitente, key: b64url(await crypto.subtle.exportKey('raw', clave)),
                documento: documento_nombre, firmante: datos.firmante_nombre, creada: new Date().toISOString(), vence: r.vence_en
            };
            guardar([s, ...guardadas()]);
            renderLista();
            return s;
        } finally {
            setBusy(null);
        }
    }

    function mostrarEnlaces(el, s) {
        const firma = enlaceFirma(s), seg = enlaceSeguimiento(s);
        const msg = `Hola, ${s.firmante}. Te envío «${s.documento}» para que lo firmes en PascalPDF: ${firma}`;
        el.innerHTML = `
            <p class="text-emerald-300 font-semibold text-sm">Solicitud creada.</p>
            <div class="space-y-1.5"><span class="text-[11px] text-zinc-400">1. Envía este enlace a ${escapeHtml(s.firmante)}</span>
                <div class="flex gap-2"><input readonly value="${escapeHtml(firma)}" class="${field} text-[11px]"><button data-copy="${escapeHtml(firma)}" class="px-3 rounded-xl bg-zinc-800 border border-zinc-700">Copiar</button></div>
                <div class="grid grid-cols-2 gap-2">
                    <a target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}" class="py-2 text-center rounded-xl bg-zinc-800 border border-zinc-700"><i class="fa-brands fa-whatsapp mr-1 text-emerald-400"></i> WhatsApp</a>
                    <a href="mailto:?subject=${encodeURIComponent('Firma: ' + s.documento)}&body=${encodeURIComponent(msg)}" class="py-2 text-center rounded-xl bg-zinc-800 border border-zinc-700"><i class="fa-solid fa-envelope mr-1 text-indigo-400"></i> Correo</a>
                </div></div>
            <div class="space-y-1.5"><span class="text-[11px] text-zinc-400">2. Tu enlace de seguimiento (no lo compartas)</span>
                <div class="flex gap-2"><input readonly value="${escapeHtml(seg)}" class="${field} text-[11px]"><button data-copy="${escapeHtml(seg)}" class="px-3 rounded-xl bg-zinc-800 border border-zinc-700">Copiar</button></div></div>
            <p class="text-zinc-400">Te avisaremos por correo cuando firme. El documento cifrado se borra del servidor el ${new Date(s.vence).toLocaleDateString('es-CO')}. La solicitud también queda en Firmas → Mis solicitudes de este navegador.</p>`;
        el.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
            try { await navigator.clipboard.writeText(b.dataset.copy); showToast('Enlace copiado.', 'emerald'); } catch (e) { showToast('Selecciona el enlace y cópialo.', 'amber'); }
        });
    }

    // ---------- lista "Mis solicitudes" en la pestaña Firmas
    function renderLista() {
        const box = document.getElementById('mis-solicitudes-list');
        if (!box) return;
        const list = guardadas();
        box.innerHTML = list.length ? '' : '<p class="text-[11px] text-zinc-500">Aún no has pedido firmas desde este navegador.</p>';
        list.forEach(s => {
            const a = document.createElement('a');
            a.href = enlaceSeguimiento(s);
            a.target = '_blank';
            a.rel = 'noopener';
            a.className = 'block p-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-600';
            a.innerHTML = `<span class="block text-white font-medium truncate">${escapeHtml(s.documento)}</span><span class="text-[10px] text-zinc-500">Para ${escapeHtml(s.firmante)} · ${new Date(s.creada).toLocaleDateString('es-CO')} · ver estado</span>`;
            box.appendChild(a);
        });
    }

    function montarPanel() {
        const panel = document.getElementById('right-content-certs');
        if (!panel || document.getElementById('mis-solicitudes-list')) return;
        const sec = document.createElement('div');
        sec.className = 'space-y-2';
        sec.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-white">Firmas de otras personas</span>
                <button data-pedir class="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-medium">Pedir firma</button>
            </div>
            <div id="mis-solicitudes-list" class="space-y-1.5 text-xs"></div>`;
        sec.querySelector('[data-pedir]').onclick = abrir;
        panel.insertBefore(sec, panel.children[2] || null);
        renderLista();
    }

    // ---------- registrar en el catálogo
    SUITE_CATEGORIES.sign.tools.splice(1, 0,
        { label: 'Pedir firma a otra persona', icon: 'fa-paper-plane', action: () => abrir() },
        { label: 'Casilla de firma para otra persona', icon: 'fa-square-plus', action: () => agregarCasilla() });
    window.PascalFirmaTerceros = { abrir, agregarCasilla };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montarPanel); else montarPanel();
})();
