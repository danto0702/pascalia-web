// Cuenta de PascalPDF y Pascal Sign: entrar con código al correo, plan y prueba, pagos con Wompi,
// códigos promocionales e historial de documentos firmados (exportable en PDF, CSV y TXT).
// Usa la función pascalpdf-firma (window.PASCALPDF_API, en config.js). Sin esa dirección no restringe nada.
(function () {
    'use strict';
    const API = window.PASCALPDF_API;
    const LLAVE = 'pascalpdf-sesion';
    const PAGO = 'pascalpdf-pago-pendiente';
    const NOMBRES_PLAN = { prueba: 'Prueba gratis', pro: 'Pascal Sign Pro', suite: 'PascalPDF Suite' };
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pesos = (n) => '$' + Number(n).toLocaleString('es-CO');
    const fecha = (iso, hora) => iso ? new Date(iso).toLocaleString('es-CO', hora ? { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' } : { dateStyle: 'long', timeZone: 'America/Bogota' }) : '—';

    let cuenta = null;
    const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
    const token = () => leer(LLAVE);

    async function api(accion, datos = {}) {
        const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, token: token(), ...datos }) });
        let j = {};
        try { j = await r.json(); } catch (e) { /* vacío */ }
        if (r.status === 401) { guardar(LLAVE, null); guardar('pascalpdf-cuenta', null); cuenta = null; pintarBoton(); }
        if (!r.ok || !j.ok) throw Object.assign(new Error(j.error || 'No se pudo conectar con el servicio. Revisa tu conexión.'), { status: r.status });
        return j;
    }

    // ------------------------------------------------------------------ estilos propios (sirven en ambas apps)
    const css = `
    .pc-velo{position:fixed;inset:0;background:rgba(31,31,31,.5);z-index:9998;display:flex;align-items:flex-end;justify-content:center;animation:pc-a .2s ease-out both}
    @media(min-width:640px){.pc-velo{align-items:center;padding:16px}}
    .pc-hoja{background:#fff;color:#1F1F1F;width:100%;max-width:520px;max-height:92vh;overflow:auto;border-radius:24px 24px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom,0px));font:15px/1.55 Inter,system-ui,sans-serif;animation:pc-s .3s cubic-bezier(.16,1,.3,1) both;text-align:left}
    @media(min-width:640px){.pc-hoja{border-radius:24px}}
    .pc-hoja h2{font:800 21px/1.2 Montserrat,Inter,sans-serif;margin:0 0 4px;letter-spacing:-.01em}
    .pc-hoja p{margin:0 0 12px}.pc-muted{color:#5C5C5C;font-size:14px}
    .pc-campo{width:100%;box-sizing:border-box;font:16px Inter,sans-serif;padding:12px 14px;border-radius:14px;border:1px solid #E9E9E9;background:#fff;color:#1F1F1F;margin:6px 0}
    .pc-campo:focus{outline:2px solid #FFC107;border-color:transparent}
    .pc-codigo{letter-spacing:.45em;text-align:center;font-size:22px;font-weight:600}
    .pc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:12px 22px;border-radius:999px;border:0;font:700 15px Montserrat,Inter,sans-serif;cursor:pointer;background:#FFC107;color:#1F1F1F;transition:background-color .16s,transform .16s}
    .pc-btn:hover{background:#FFB300}.pc-btn:active{transform:scale(.97)}.pc-btn:disabled{opacity:.5;cursor:progress}
    .pc-btn.pc-sec{background:#fff;box-shadow:inset 0 0 0 1px #E9E9E9}.pc-btn.pc-sec:hover{background:#FFF8E1}
    .pc-btn.pc-peligro{background:#fff;color:#991B1B;box-shadow:inset 0 0 0 1px #FECACA}
    .pc-fila{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.pc-fila>*{flex:1 1 140px}
    .pc-planes{display:grid;gap:10px;margin:12px 0}
    .pc-plan{border-radius:18px;padding:14px 16px;box-shadow:inset 0 0 0 1px #E9E9E9;cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:2px 12px;align-items:center;background:#fff;text-align:left;font:inherit;color:inherit;width:100%}
    .pc-plan[aria-pressed=true]{box-shadow:inset 0 0 0 2px #FFB300;background:#FFF8E1}
    .pc-plan b{font:700 15px Montserrat,sans-serif}.pc-plan .pc-precio{font:800 17px Montserrat,sans-serif;font-variant-numeric:tabular-nums}
    .pc-plan small{color:#5C5C5C;font-size:13px;grid-column:1/-1}
    .pc-badge{display:inline-block;padding:3px 12px;border-radius:999px;font:600 13px Inter,sans-serif;background:#FFF8E1;color:#8A6100}
    .pc-badge.pc-vencido{background:#FEE2E2;color:#991B1B}
    .pc-datos{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:14px;margin:12px 0}.pc-datos dt{color:#5C5C5C}.pc-datos dd{margin:0;font-weight:500;font-variant-numeric:tabular-nums}
    .pc-total{display:flex;justify-content:space-between;font-size:14px;color:#5C5C5C;margin-top:6px}.pc-total b{color:#1F1F1F;font:800 18px Montserrat,sans-serif}
    .pc-msg{padding:10px 14px;border-radius:14px;font-size:14px;margin-top:10px}.pc-msg.pc-err{background:#FEE2E2;color:#991B1B}.pc-msg.pc-ok{background:#DCFCE7;color:#166534}
    .pc-sec-t{font:700 14px Montserrat,sans-serif;margin:18px 0 6px}
    .pc-cerrar{float:right;border:0;background:none;font-size:24px;line-height:1;cursor:pointer;color:#5C5C5C;margin:-6px -6px 0 0;padding:6px}
    .pc-boton-cuenta{display:inline-flex;align-items:center;gap:6px;cursor:pointer}
    @keyframes pc-a{from{opacity:0}}@keyframes pc-s{from{transform:translateY(20px);opacity:0}}
    @media(prefers-reduced-motion:reduce){.pc-velo,.pc-hoja{animation:none}}`;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    function hoja(html) {
        cerrar();
        const v = document.createElement('div');
        v.className = 'pc-velo';
        v.innerHTML = `<div class="pc-hoja" role="dialog" aria-modal="true"><button class="pc-cerrar" aria-label="Cerrar">×</button>${html}</div>`;
        v.addEventListener('mousedown', (e) => { if (e.target === v) cerrar(); });
        v.querySelector('.pc-cerrar').onclick = cerrar;
        document.body.appendChild(v);
        return v.querySelector('.pc-hoja');
    }
    function cerrar() { document.querySelectorAll('.pc-velo').forEach(v => v.remove()); }
    function aviso(el, msg, ok) { el.innerHTML = msg ? `<div class="pc-msg ${ok ? 'pc-ok' : 'pc-err'}">${esc(msg)}</div>` : ''; }
    async function conBoton(b, fn) { const t = b.textContent; b.disabled = true; try { return await fn(); } finally { b.disabled = false; b.textContent = t; } }

    // ------------------------------------------------------------------ entrar
    function entrar(motivo) {
        return new Promise((resolve) => {
            const h = hoja(`
                <h2>Entra a tu cuenta</h2>
                <p class="pc-muted">${esc(motivo || 'Te enviamos un código a tu correo. Si es tu primera vez, empiezas con 7 días gratis de todas las herramientas.')}</p>
                <div data-p1><input class="pc-campo" type="email" autocomplete="email" placeholder="Tu correo" data-correo>
                    <input class="pc-campo" type="text" autocomplete="name" placeholder="Tu nombre (opcional)" data-nombre></div>
                <div data-p2 hidden><p>Escribe el código que enviamos a <b data-c></b>.</p>
                    <input class="pc-campo pc-codigo" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" data-codigo></div>
                <div class="pc-fila"><button class="pc-btn" data-ir>Enviarme el código</button></div>
                <div data-msg></div>
                <p class="pc-muted" style="margin-top:14px;font-size:12px">Al entrar aceptas los <a href="/PascalPDF_Studio/terminos/" target="_blank" rel="noopener">términos</a> y la <a href="/PascalPDF_Studio/politica/" target="_blank" rel="noopener">política de datos</a> de PascalPDF.</p>`);
            const q = (s) => h.querySelector(s);
            let paso = 1;
            h.parentElement.querySelector('.pc-cerrar').addEventListener('click', () => resolve(null));
            q('[data-correo]').value = leer('pascalpdf-correo') || '';
            const ir = q('[data-ir]');
            ir.onclick = () => conBoton(ir, async () => {
                const correo = q('[data-correo]').value.trim();
                try {
                    if (paso === 1) {
                        if (!/^\S+@\S+\.\S+$/.test(correo)) return aviso(q('[data-msg]'), 'Revisa tu correo.');
                        await api('entrar_codigo', { correo });
                        guardar('pascalpdf-correo', correo);
                        q('[data-p1]').hidden = true; q('[data-p2]').hidden = false; q('[data-c]').textContent = correo;
                        paso = 2;
                        aviso(q('[data-msg]'), 'Revisa tu correo (también la carpeta de spam).', true);
                        setTimeout(() => { ir.textContent = 'Entrar'; q('[data-codigo]').focus(); });
                    } else {
                        const codigo = q('[data-codigo]').value.trim();
                        if (!/^\d{6}$/.test(codigo)) return aviso(q('[data-msg]'), 'Escribe los 6 dígitos.');
                        const r = await api('entrar', { correo, codigo, nombre: q('[data-nombre]').value.trim() });
                        guardar(LLAVE, r.token);
                        cuenta = r.cuenta;
                        pintarBoton();
                        cerrar();
                        toast(r.nuevo ? '¡Bienvenido! Tienes 7 días gratis de todas las herramientas.' : 'Entraste a tu cuenta.');
                        resolve(cuenta);
                    }
                } catch (e) { aviso(q('[data-msg]'), e.message); }
            });
        });
    }

    async function cargar() {
        if (!API || !token()) return (cuenta = null);
        try {
            cuenta = (await api('cuenta')).cuenta;
            guardar('pascalpdf-cuenta', JSON.stringify(cuenta));
        } catch (e) {
            // Sin conexión: se usa el último estado conocido mientras el plan esté vigente
            if (e.status === undefined || e.status === 0) {
                try { const c = JSON.parse(leer('pascalpdf-cuenta')); if (c && new Date(c.vence_en) > new Date()) cuenta = c; } catch (err) { /* nada */ }
            }
        }
        pintarBoton();
        return cuenta;
    }

    // ------------------------------------------------------------------ permisos: nivel 1 = Pro, 2 = Suite
    async function requiere(nivel, motivo) {
        if (!API) return true;
        if (!cuenta) await cargar();
        if (!cuenta) { if (!(await entrar(motivo))) return false; }
        if (cuenta.nivel >= nivel) return true;
        planes(nivel, cuenta.activo
            ? `${motivo || 'Esta herramienta'} hace parte de PascalPDF Suite.`
            : `Tu ${cuenta.prueba ? 'prueba gratis' : 'plan'} venció el ${fecha(cuenta.vence_en)}. Elige un plan para seguir.`);
        return false;
    }

    // ------------------------------------------------------------------ planes y pago
    function planes(nivelMin, motivo) {
        const P = (cuenta && cuenta.productos) || {};
        const lista = [
            ['pro_mes', 'Pascal Sign Pro', 'Firmar sin límite con datos y consecutivo, 15 solicitudes de firma al mes, historial exportable.', 'mes'],
            ['pro_anual', 'Pascal Sign Pro · anual', 'Lo mismo, 2 meses gratis.', 'año'],
            ['suite_mes', 'PascalPDF Suite', 'Todo Pro, editar texto, OCR, comparar, contraseñas, comprimir, convertir, lotes y 50 solicitudes al mes.', 'mes'],
            ['suite_anual', 'PascalPDF Suite · anual', 'Lo mismo, 2 meses gratis.', 'año'],
            ['paquete10', '10 solicitudes de firma', 'Adicionales a las del plan. No vencen.', 'una vez']
        ].filter(([id]) => P[id] && !(nivelMin === 2 && id.startsWith('pro')));
        const h = hoja(`
            <h2>Elige tu plan</h2>
            ${motivo ? `<p class="pc-muted">${esc(motivo)}</p>` : ''}
            <div class="pc-planes">${lista.map(([id, n, d, per], i) => `<button class="pc-plan" data-p="${id}" aria-pressed="${i === 0}"><b>${n}</b><span class="pc-precio">${pesos(P[id].precio)}<span class="pc-muted" style="font-size:12px;font-weight:500"> / ${per}</span></span><small>${d}</small></button>`).join('')}</div>
            <input class="pc-campo" placeholder="Código promocional (opcional)" data-codigo style="text-transform:uppercase">
            <div class="pc-total"><span data-detalle>Total</span><b data-total></b></div>
            <div class="pc-fila"><button class="pc-btn" data-pagar>Pagar con Wompi</button></div>
            <div data-msg></div>
            <p class="pc-muted" style="font-size:12px;margin-top:12px">Precios en pesos colombianos; PascalIA no es responsable de IVA. El plan no se renueva solo: te avisamos antes de que venza. Puedes pagar con tarjeta, PSE, Nequi o Bancolombia. Al pagar aceptas los <a href="/PascalPDF_Studio/terminos/#precios-planes-y-pagos" target="_blank" rel="noopener">términos</a>.</p>`);
        const q = (s) => h.querySelector(s);
        let elegido = lista[0] && lista[0][0];
        let tiempo = null;
        const cotizar = async () => {
            if (!elegido) return;
            const codigo = q('[data-codigo]').value.trim();
            q('[data-total]').textContent = pesos(P[elegido].precio);
            q('[data-detalle]').textContent = 'Total';
            aviso(q('[data-msg]'), '');
            if (!codigo) return;
            try {
                const c = await api('cotizar', { producto: elegido, codigo });
                q('[data-total]').textContent = pesos(c.monto);
                q('[data-detalle]').textContent = `Descuento ${pesos(c.descuento)} aplicado`;
            } catch (e) { aviso(q('[data-msg]'), e.message); }
        };
        h.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
            elegido = b.dataset.p;
            h.querySelectorAll('[data-p]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
            cotizar();
        });
        q('[data-codigo]').oninput = () => { clearTimeout(tiempo); tiempo = setTimeout(cotizar, 500); };
        cotizar();
        const pagar = q('[data-pagar]');
        pagar.onclick = () => conBoton(pagar, async () => {
            try {
                const retorno = location.origin + location.pathname;
                const r = await api('pagar', { producto: elegido, codigo: q('[data-codigo]').value.trim(), retorno });
                if (r.gratis) { cuenta = r.cuenta; pintarBoton(); cerrar(); return toast('¡Listo! Tu plan quedó activo.'); }
                guardar(PAGO, r.referencia);
                location.href = r.url;
            } catch (e) { aviso(q('[data-msg]'), e.message); }
        });
    }

    // Al volver de Wompi: confirmar el pago con la transacción que trae la dirección (?id=...)
    async function revisarRetornoPago() {
        const params = new URLSearchParams(location.search);
        const id = params.get('id');
        if (!API || !id || !leer(PAGO)) return;
        history.replaceState(null, '', location.pathname + location.hash);
        try {
            const r = await api('confirmar_pago', { transaccion: id });
            cuenta = r.cuenta;
            pintarBoton();
            if (r.estado === 'APPROVED') { guardar(PAGO, null); toast(`¡Pago aprobado! ${NOMBRES_PLAN[cuenta.plan]} activo hasta el ${fecha(cuenta.vence_en)}.`); }
            else if (r.estado === 'PENDING') toast('Tu pago está en proceso. Cuando Wompi lo apruebe, entra a «Mi cuenta» y verás el plan activo.');
            else { guardar(PAGO, null); toast('El pago no fue aprobado. No se hizo ningún cobro; puedes intentarlo de nuevo.', true); }
        } catch (e) { toast(e.message, true); }
    }

    // ------------------------------------------------------------------ mi cuenta
    async function abrir() {
        if (!API) return toast('Las cuentas todavía no están activas.', true);
        if (!cuenta) await cargar();
        if (!cuenta) { if (!(await entrar())) return; }
        const c = cuenta;
        const s = c.solicitudes;
        const h = hoja(`
            <h2>Mi cuenta</h2>
            <p class="pc-muted">${esc(c.correo)}</p>
            <span class="pc-badge ${c.activo ? '' : 'pc-vencido'}">${NOMBRES_PLAN[c.plan]}${c.activo ? '' : ' · vencido'}</span>
            <dl class="pc-datos">
                <dt>${c.activo ? 'Activo hasta' : 'Venció el'}</dt><dd>${fecha(c.vence_en)}</dd>
                <dt>Firmas este mes</dt><dd>${c.firmas_mes}</dd>
                <dt>Solicitudes de firma</dt><dd>${s.usadas} de ${s.cupo} este mes${s.extra ? ` · ${s.extra} adicionales` : ''}</dd>
            </dl>
            <div class="pc-fila"><button class="pc-btn" data-planes>${c.activo ? 'Renovar o cambiar de plan' : 'Elegir un plan'}</button></div>
            <div class="pc-sec-t">Historial de documentos firmados</div>
            <p class="pc-muted">Fecha y hora (del servidor), documento, objeto, radicado, consecutivo, firmante y huella de cada firma.</p>
            <div class="pc-fila"><button class="pc-btn pc-sec" data-exp="pdf">PDF</button><button class="pc-btn pc-sec" data-exp="csv">CSV (Excel)</button><button class="pc-btn pc-sec" data-exp="txt">TXT</button></div>
            <div data-msg></div>
            <div class="pc-fila" style="margin-top:22px"><button class="pc-btn pc-sec" data-salir>Salir</button><button class="pc-btn pc-peligro" data-borrar>Borrar mi cuenta</button></div>`);
        const q = (sel) => h.querySelector(sel);
        q('[data-planes]').onclick = () => planes(1);
        h.querySelectorAll('[data-exp]').forEach(b => b.onclick = () => conBoton(b, async () => {
            try { await exportar(b.dataset.exp); aviso(q('[data-msg]'), 'Historial descargado.', true); } catch (e) { aviso(q('[data-msg]'), e.message); }
        }));
        q('[data-salir]').onclick = async () => { try { await api('salir'); } catch (e) { /* igual sale */ } guardar(LLAVE, null); cuenta = null; pintarBoton(); cerrar(); toast('Saliste de tu cuenta.'); };
        q('[data-borrar]').onclick = async () => {
            const conf = prompt('Se borrarán tu cuenta y tu historial de firmas (descárgalo antes). Los pagos se conservan como soporte contable. Escribe BORRAR para confirmar:');
            if (conf !== 'BORRAR') return;
            try { await api('borrar_cuenta', { confirmacion: 'BORRAR' }); guardar(LLAVE, null); cuenta = null; pintarBoton(); cerrar(); toast('Tu cuenta fue borrada.'); } catch (e) { aviso(q('[data-msg]'), e.message); }
        };
    }

    // ------------------------------------------------------------------ historial exportable
    const COLS = [['firmado_en', 'Fecha y hora (Colombia)'], ['documento_nombre', 'Documento'], ['objeto', 'Objeto'], ['radicado', 'Radicado'], ['consecutivo', 'Consecutivo'], ['firmante', 'Firmante'], ['documento_tipo', 'Tipo'], ['metodo', 'Método'], ['paginas', 'Páginas'], ['app', 'Aplicación'], ['firma_id', 'ID de la firma'], ['id', 'ID del registro'], ['documento_hash', 'Huella SHA-256 del documento']];
    const valor = (e, k) => k === 'firmado_en' ? new Date(e[k]).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'medium' }) : k === 'app' ? (e[k] === 'pascalsign' ? 'Pascal Sign' : 'PascalPDF') : (e[k] ?? '');

    async function exportar(formato) {
        const { eventos } = await api('historial');
        if (!eventos.length) throw new Error('Todavía no tienes documentos firmados registrados.');
        const nombre = `historial-firmas-${new Date().toISOString().slice(0, 10)}`;
        if (formato === 'csv') {
            const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
            const filas = [COLS.map(c => q(c[1])).join(';'), ...eventos.map(e => COLS.map(([k]) => q(valor(e, k))).join(';'))];
            return descargar(new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), nombre + '.csv');
        }
        if (formato === 'txt') {
            const t = [`Historial de documentos firmados · ${cuenta.correo}`, `Generado el ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · PascalIA (pascalia.lat)`, '']
                .concat(eventos.map((e, i) => [`${i + 1}. ${valor(e, 'documento_nombre')}`, ...COLS.filter(([k]) => k !== 'documento_nombre' && e[k] != null && e[k] !== '').map(([k, n]) => `   ${n}: ${valor(e, k)}`)].join('\n')));
            return descargar(new Blob(['﻿' + t.join('\n\n')], { type: 'text/plain;charset=utf-8' }), nombre + '.txt');
        }
        return descargar(new Blob([await historialPDF(eventos)], { type: 'application/pdf' }), nombre + '.pdf');
    }

    const winAnsi = (t) => String(t ?? '').replace(/[—–]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x20-\x7E\xA0-\xFF]/g, '');

    async function historialPDF(eventos) {
        if (!window.PDFLib) throw new Error('No se pudo cargar el generador de PDF.');
        const { PDFDocument, StandardFonts, rgb } = PDFLib;
        const doc = await PDFDocument.create();
        const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold), fm = await doc.embedFont(StandardFonts.Courier);
        const W = 792, H = 612, M = 36;
        const cols = [['Fecha y hora', 92], ['Documento', 130], ['Objeto', 110], ['Radicado', 90], ['Consecutivo', 80], ['Firmante', 100], ['Método', 52], ['Huella (inicio)', 66]];
        let page, y, n = 0;
        const recortar = (t, font, size, w) => { t = winAnsi(t); while (t && font.widthOfTextAtSize(t, size) > w - 4) t = t.slice(0, -2) + '…'.replace('…', '.'); return t; };
        const nueva = () => {
            page = doc.addPage([W, H]);
            n++;
            page.drawRectangle({ x: M, y: H - M - 4, width: W - 2 * M, height: 4, color: rgb(1, 0.76, 0.03) });
            page.drawText(winAnsi('Historial de documentos firmados'), { x: M, y: H - M - 26, size: 16, font: fb, color: rgb(0.12, 0.12, 0.12) });
            page.drawText(winAnsi(`${cuenta.correo} · generado el ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · ${eventos.length} firmas · PascalIA (pascalia.lat)`), { x: M, y: H - M - 42, size: 8.5, font: f, color: rgb(0.36, 0.36, 0.36) });
            y = H - M - 66;
            let x = M;
            cols.forEach(([t, w]) => { page.drawText(winAnsi(t), { x, y, size: 8, font: fb, color: rgb(0.36, 0.36, 0.36) }); x += w; });
            y -= 6;
            page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.85, 0.85, 0.85) });
            y -= 13;
            page.drawText(`Página ${n}`, { x: W - M - 40, y: 20, size: 8, font: f, color: rgb(0.5, 0.5, 0.5) });
        };
        nueva();
        eventos.forEach((e, i) => {
            if (y < 40) nueva();
            if (i % 2 === 1) page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 15, color: rgb(1, 0.973, 0.882) });
            const vals = [valor(e, 'firmado_en'), e.documento_nombre, e.objeto, e.radicado, e.consecutivo, e.firmante, e.metodo, e.documento_hash ? e.documento_hash.slice(0, 12) : ''];
            let x = M;
            vals.forEach((v, j) => {
                const font = j === 7 ? fm : f;
                page.drawText(recortar(v || '—', font, 8, cols[j][1]), { x, y, size: 8, font, color: rgb(0.12, 0.12, 0.12) });
                x += cols[j][1];
            });
            y -= 15;
        });
        page.drawText(winAnsi('El detalle completo (huella completa e identificadores) está en la exportación CSV o TXT.'), { x: M, y: Math.max(28, y - 10), size: 7.5, font: f, color: rgb(0.45, 0.45, 0.45) });
        return doc.save();
    }

    function descargar(blob, nombre) {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    // ------------------------------------------------------------------ registrar firmas (hora del servidor)
    async function registrarFirmas(eventos) {
        if (!API || !eventos.length) return null;
        if (!cuenta) await cargar();
        if (!cuenta) return null;
        try { return (await api('registrar_firmas', { eventos })).registros; } catch (e) { toast('No se pudo registrar la firma en tu historial: ' + e.message, true); return null; }
    }

    // ------------------------------------------------------------------ botón "Mi cuenta" y avisos
    function pintarBoton() {
        document.querySelectorAll('[data-pascal-cuenta]').forEach(el => {
            el.textContent = cuenta ? (cuenta.activo ? NOMBRES_PLAN[cuenta.plan] : 'Plan vencido') : 'Entrar';
            el.title = cuenta ? `Mi cuenta · ${cuenta.correo}` : 'Entrar a tu cuenta';
        });
    }
    function toast(msg, error) {
        if (window.showToast) return window.showToast(msg, error ? 'rose' : 'emerald');
        const t = document.createElement('div');
        t.setAttribute('role', 'status');
        t.style.cssText = `position:fixed;left:16px;right:16px;top:calc(12px + env(safe-area-inset-top,0px));margin:0 auto;max-width:480px;background:${error ? '#991B1B' : '#1F1F1F'};color:#fff;padding:12px 16px;border-radius:16px;font:14px Inter,sans-serif;z-index:9999`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 4200);
    }

    window.PascalCuenta = { api, entrar, abrir, requiere, planes, cargar, registrarFirmas, exportar, get cuenta() { return cuenta; }, activa: !!API };
    if (API) {
        const iniciar = () => { pintarBoton(); cargar().then(revisarRetornoPago); };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
    }
})();
