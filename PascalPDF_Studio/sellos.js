// Sellos configurables de PascalPDF: texto, color, inclinación, fuente, borde, ícono (✓✓, ✓, ✗, ★…),
// tamaño y fecha opcional. Se dibujan en un canvas para que se vean igual en pantalla y en el PDF.
// "Mis sellos" se guardan en este dispositivo.
(function () {
    'use strict';
    if (typeof window.renderCurrentPage !== 'function') return;
    const CLAVE = 'pascalpdf-mis-sellos';
    const FUENTES = {
        sans: { n: 'Moderna', f: 'Montserrat, Inter, Arial, sans-serif' },
        serif: { n: 'Clásica', f: 'Georgia, "Times New Roman", serif' },
        mono: { n: 'Máquina', f: '"Courier New", Courier, monospace' }
    };
    const ICONOS = { '': 'Sin ícono', '✓✓': '✓✓', '✓': '✓', '✗': '✗', '★': '★', '!': '!', '●': '●' };
    const BORDES = { recto: 'Recto', redondo: 'Redondeado', doble: 'Doble', ninguno: 'Sin borde' };
    const COLORES = ['#059669', '#dc2626', '#d97706', '#4f46e5', '#2563eb', '#7c3aed', '#1F1F1F', '#6b7280'];
    const MODELOS = [
        { text: 'APROBADO', color: '#059669', icono: '✓✓' },
        { text: 'NO APROBADO', color: '#dc2626', icono: '✗' },
        { text: 'RECIBIDO', color: '#4f46e5', icono: '✓' },
        { text: 'REVISADO', color: '#2563eb', icono: '✓' },
        { text: 'PAGADO', color: '#059669', icono: '✓✓' },
        { text: 'ANULADO', color: '#dc2626', icono: '✗' },
        { text: 'CONFIDENCIAL', color: '#dc2626', icono: '!' },
        { text: 'BORRADOR', color: '#d97706', icono: '' },
        { text: 'COPIA', color: '#6b7280', icono: '' },
        { text: 'URGENTE', color: '#dc2626', icono: '!' }
    ];
    // Valores por defecto (los sellos viejos conservan su aspecto: inclinados y con ✓✓)
    const norma = (o) => ({
        text: o.text || 'SELLO', color: o.color || '#059669',
        rot: o.rot == null ? -8 : +o.rot, icono: o.icono == null ? '✓✓' : o.icono,
        fuente: o.fuente || 'sans', borde: o.borde || 'redondo', fontSize: o.fontSize || 12,
        fecha: !!o.fecha, fechaTxt: o.fechaTxt || '', mayus: o.mayus !== false, relleno: !!o.relleno
    });

    // Dibuja el sello. "s" = píxeles del canvas por punto. Devuelve { canvas, w, h } (w, h en puntos).
    function dibujar(obj, s) {
        const o = norma(obj);
        const fs = o.fontSize, fam = FUENTES[o.fuente] ? FUENTES[o.fuente].f : FUENTES.sans.f;
        const txt = o.mayus ? o.text.toUpperCase() : o.text;
        const lineas = txt.split('\n');
        const fecha = o.fecha ? (o.fechaTxt || new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()) : '';
        const m = document.createElement('canvas').getContext('2d');
        const esp = fs * 0.12; // espaciado entre letras
        const ancho = (t, f) => { m.font = f; return [...t].reduce((a, c) => a + m.measureText(c).width, 0) + esp * Math.max(0, [...t].length - 1); };
        const fP = `800 ${fs}px ${fam}`, fF = `600 ${fs * 0.6}px ${fam}`;
        const icW = o.icono ? (o.icono === '✓✓' ? fs * 1.35 : fs * 0.95) + fs * 0.35 : 0;
        const tw = Math.max(...lineas.map(l => ancho(l, fP)) , 0);
        const fw = fecha ? ancho(fecha, fF) : 0;
        const padX = fs * 0.75, padY = fs * 0.42, lh = fs * 1.15;
        const bw = padX * 2 + Math.max(icW + tw, fw);
        const bh = padY * 2 + lineas.length * lh + (fecha ? fs * 0.8 : 0);
        const a = o.rot * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
        const W = bw * c + bh * sn, H = bw * sn + bh * c;
        const cv = document.createElement('canvas');
        cv.width = Math.ceil(W * s) + 2; cv.height = Math.ceil(H * s) + 2;
        const g = cv.getContext('2d');
        g.scale(s, s);
        g.translate(W / 2 + 1 / s, H / 2 + 1 / s);
        g.rotate(a);
        g.translate(-bw / 2, -bh / 2);
        g.strokeStyle = g.fillStyle = o.color;
        const lw = Math.max(1.2, fs * 0.15), r = o.borde === 'redondo' ? fs * 0.35 : 0;
        const caja = (x, y, w, h, rr) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, rr); else g.rect(x, y, w, h); };
        if (o.relleno) { g.globalAlpha = 0.1; caja(0, 0, bw, bh, r); g.fill(); g.globalAlpha = 1; }
        if (o.borde !== 'ninguno') {
            g.lineWidth = lw;
            caja(lw / 2, lw / 2, bw - lw, bh - lw, r); g.stroke();
            if (o.borde === 'doble') { g.lineWidth = lw * 0.55; const d = lw * 2.2; caja(d, d, bw - 2 * d, bh - 2 * d, 0); g.stroke(); }
        }
        const letras = (t, x, y, f) => { g.font = f; for (const ch of t) { g.fillText(ch, x, y); x += g.measureText(ch).width + esp; } };
        g.textBaseline = 'middle';
        const yIcon = padY + lh / 2 + (lineas.length - 1) * lh / 2;
        if (o.icono) {
            const x0 = padX, u = fs;
            g.lineWidth = u * 0.17; g.lineCap = 'round'; g.lineJoin = 'round';
            const check = (x) => { g.beginPath(); g.moveTo(x, yIcon); g.lineTo(x + u * 0.3, yIcon + u * 0.3); g.lineTo(x + u * 0.8, yIcon - u * 0.35); g.stroke(); };
            if (o.icono === '✓') check(x0);
            else if (o.icono === '✓✓') { check(x0); check(x0 + u * 0.48); }
            else if (o.icono === '✗') { g.beginPath(); g.moveTo(x0 + u * .1, yIcon - u * .32); g.lineTo(x0 + u * .74, yIcon + u * .32); g.moveTo(x0 + u * .74, yIcon - u * .32); g.lineTo(x0 + u * .1, yIcon + u * .32); g.stroke(); }
            else if (o.icono === '●') { g.beginPath(); g.arc(x0 + u * .42, yIcon, u * .3, 0, 7); g.fill(); }
            else { g.font = `800 ${fs * 1.05}px ${o.icono === '★' ? 'Arial, sans-serif' : fam}`; g.fillText(o.icono, x0 + (o.icono === '!' ? u * .3 : 0), yIcon); }
        }
        lineas.forEach((l, i) => {
            const libre = bw - 2 * padX - icW;
            letras(l, padX + icW + (libre - ancho(l, fP)) / 2, padY + lh * i + lh / 2, fP);
        });
        if (fecha) letras(fecha, (bw - fw) / 2, padY + lineas.length * lh + fs * 0.35, fF);
        return { canvas: cv, w: cv.width / s, h: cv.height / s };
    }

    // ---- Vista en pantalla: el sello se muestra como imagen (se envuelve antes que cuadros.js) ----
    const render0 = window.renderCurrentPage;
    window.renderCurrentPage = function () {
        const r = render0.apply(this, arguments);
        try {
            const page = pdfPages[currentPageIndex];
            document.querySelectorAll('#page-interactive-layer [data-id]').forEach(el => {
                const obj = page.objects.find(o => o.id === el.dataset.id);
                if (!obj || obj.type !== 'stamp') return;
                const d = dibujar(obj, 3 * (window.devicePixelRatio || 1) / 1.5);
                el.className = el.className.replace(/\b(border-2|font-black|tracking-widest|uppercase|px-3|py-1|rounded|text-xs)\b/g, '');
                Object.assign(el.style, { transform: 'none', border: '0', padding: '0', width: d.w + 'px', height: d.h + 'px', fontSize: '' });
                el.innerHTML = '';
                const img = new Image();
                img.src = d.canvas.toDataURL();
                img.alt = 'Sello ' + obj.text;
                img.draggable = false;
                img.style.cssText = `width:${d.w}px;height:${d.h}px;display:block;pointer-events:none`;
                el.appendChild(img);
                el.title = 'Sello: toca dos veces para editarlo';
            });
        } catch (e) { /* la vista sigue aunque falle un sello */ }
        return r;
    };

    // Para el PDF: PNG en alta resolución
    window.PascalSellos = {
        png(obj) { const d = dibujar(obj, 5); return { src: d.canvas.toDataURL('image/png'), w: d.w, h: d.h }; },
        dibujar
    };

    // ---- Editor ----
    const misSellos = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || []; } catch (e) { return []; } };
    const guardarMis = (l) => { try { localStorage.setItem(CLAVE, JSON.stringify(l.slice(0, 30))); } catch (e) { /* sin almacenamiento */ } };
    const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const st = document.createElement('style');
    st.textContent = `
    .sl-velo{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;display:flex;align-items:flex-end;justify-content:center}
    @media(min-width:640px){.sl-velo{align-items:center}}
    .sl-hoja{background:#18181b;color:#f4f4f5;width:min(560px,100vw);max-height:92vh;overflow:auto;border-radius:20px 20px 0 0;padding:16px;font:14px Inter,system-ui,sans-serif}
    @media(min-width:640px){.sl-hoja{border-radius:20px}}
    .sl-hoja h3{font:800 17px Montserrat,Inter,sans-serif;margin:0 0 10px}
    .sl-vista{background:#fff;border-radius:12px;min-height:110px;display:flex;align-items:center;justify-content:center;padding:12px;margin-bottom:12px}
    .sl-vista img{max-width:100%;max-height:110px}
    .sl-fila{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;align-items:center}
    .sl-lbl{display:block;font-size:12px;font-weight:600;color:#a1a1aa;margin:8px 0 4px}
    .sl-hoja input[type=text],.sl-hoja textarea,.sl-hoja select{width:100%;background:#09090b;border:1px solid #3f3f46;border-radius:10px;color:#fff;padding:9px 10px;font:inherit}
    .sl-chip{border:1px solid #3f3f46;background:#09090b;color:#f4f4f5;border-radius:999px;padding:7px 12px;font-weight:700;cursor:pointer;min-height:38px}
    .sl-chip[aria-pressed=true]{border-color:#FFC107;background:#3a2f05}
    .sl-color{width:34px;height:34px;border-radius:999px;border:2px solid #27272a;cursor:pointer}
    .sl-color[aria-pressed=true]{outline:3px solid #FFC107;outline-offset:1px}
    .sl-modelos{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:6px}
    .sl-modelos button{flex:0 0 auto;background:#fff;border:0;border-radius:10px;padding:6px;cursor:pointer;position:relative}
    .sl-modelos img{height:34px;display:block}
    .sl-modelos .x{position:absolute;top:-6px;right:-6px;background:#dc2626;color:#fff;border-radius:99px;width:20px;height:20px;font-size:12px;line-height:20px}
    .sl-acciones{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
    .sl-btn{border:0;border-radius:999px;padding:11px 18px;font:700 14px Montserrat,Inter,sans-serif;cursor:pointer;background:#FFC107;color:#1F1F1F}
    .sl-btn.sec{background:#27272a;color:#f4f4f5}
    .sl-hoja input[type=range]{width:100%;accent-color:#FFC107}
    .sl-hoja :focus-visible{outline:3px solid #FFC107;outline-offset:2px}`;
    document.head.appendChild(st);

    function editor(obj, alGuardar) {
        let o = norma(obj || MODELOS[0]);
        if (!obj) o.rot = 0;
        const velo = document.createElement('div');
        velo.className = 'sl-velo';
        velo.innerHTML = `<div class="sl-hoja" role="dialog" aria-modal="true" aria-labelledby="sl-t">
            <h3 id="sl-t">${obj ? 'Editar sello' : 'Nuevo sello'}</h3>
            <div class="sl-vista"><img data-vista alt="Vista previa del sello"></div>
            <span class="sl-lbl">Modelos</span><div class="sl-modelos" data-modelos></div>
            <div data-mis-c><span class="sl-lbl">Mis sellos</span><div class="sl-modelos" data-mis></div></div>
            <label class="sl-lbl" for="sl-texto">Texto (usa Enter para dos renglones)</label>
            <textarea id="sl-texto" rows="2" maxlength="80"></textarea>
            <div class="sl-fila" style="margin-top:6px"><label><input type="checkbox" id="sl-mayus"> Todo en mayúsculas</label>
              <label style="margin-left:12px"><input type="checkbox" id="sl-fecha"> Agregar fecha</label></div>
            <input type="text" id="sl-fechatxt" placeholder="Fecha (vacío = hoy)" style="display:none;margin-bottom:6px">
            <span class="sl-lbl">Color</span><div class="sl-fila" data-colores></div>
            <span class="sl-lbl">Ícono</span><div class="sl-fila" data-iconos></div>
            <label class="sl-lbl" for="sl-rot">Inclinación: <b data-rot-v></b></label>
            <div class="sl-fila"><input type="range" id="sl-rot" min="-45" max="45" step="1" style="flex:1"><button class="sl-chip" data-recto>Sin inclinación</button></div>
            <span class="sl-lbl">Letra</span><div class="sl-fila" data-fuentes></div>
            <span class="sl-lbl">Borde</span><div class="sl-fila" data-bordes></div>
            <div class="sl-fila"><label><input type="checkbox" id="sl-relleno"> Fondo suave del mismo color</label></div>
            <label class="sl-lbl" for="sl-tam">Tamaño: <b data-tam-v></b></label><input type="range" id="sl-tam" min="7" max="48" step="1">
            <div class="sl-acciones"><button class="sl-btn sec" data-cancelar>Cancelar</button>
              <button class="sl-btn sec" data-guardar-mio><i class="fa-regular fa-bookmark"></i> Guardar en Mis sellos</button>
              <button class="sl-btn" data-ok>${obj ? 'Aplicar' : 'Poner sello'}</button></div></div>`;
        document.body.appendChild(velo);
        const $ = (q) => velo.querySelector(q);
        const mini = (m) => { const d = dibujar({ ...m, fontSize: 12 }, 2); return d.canvas.toDataURL(); };
        const chips = (cont, mapa, campo) => {
            $(cont).innerHTML = Object.entries(mapa).map(([k, v]) => `<button class="sl-chip" data-k="${esc(k)}">${esc(typeof v === 'string' ? v : v.n)}</button>`).join('');
            $(cont).onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) { o[campo] = b.dataset.k; pintar(); } };
        };
        chips('[data-iconos]', ICONOS, 'icono');
        chips('[data-fuentes]', FUENTES, 'fuente');
        chips('[data-bordes]', BORDES, 'borde');
        $('[data-colores]').innerHTML = COLORES.map(c => `<button class="sl-color" style="background:${c}" data-c="${c}" aria-label="Color ${c}"></button>`).join('')
            + '<input type="color" data-otro aria-label="Otro color" style="width:40px;height:34px;border:0;background:none">';
        $('[data-colores]').onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) { o.color = b.dataset.c; pintar(); } };
        $('[data-otro]').oninput = (e) => { o.color = e.target.value; pintar(); };
        const listaModelos = () => {
            $('[data-modelos]').innerHTML = MODELOS.map((m, i) => `<button data-m="${i}" aria-label="${esc(m.text)}"><img src="${mini({ ...m, rot: 0 })}" alt=""></button>`).join('');
            const mis = misSellos();
            $('[data-mis-c]').style.display = mis.length ? '' : 'none';
            $('[data-mis]').innerHTML = mis.map((m, i) => `<button data-mi="${i}" aria-label="${esc(m.text)}"><img src="${mini(m)}" alt=""><span class="x" data-borrar="${i}" title="Quitar de Mis sellos">×</span></button>`).join('');
        };
        $('[data-modelos]').onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) { o = { ...o, ...MODELOS[b.dataset.m] }; pintar(); } };
        $('[data-mis]').onclick = (e) => {
            const x = e.target.closest('[data-borrar]');
            if (x) { e.stopPropagation(); const l = misSellos(); l.splice(+x.dataset.borrar, 1); guardarMis(l); listaModelos(); return; }
            const b = e.target.closest('[data-mi]'); if (b) { o = norma(misSellos()[b.dataset.mi]); pintar(); }
        };
        function pintar() {
            $('[data-vista]').src = dibujar(o, 3).canvas.toDataURL();
            if ($('#sl-texto').value !== o.text) $('#sl-texto').value = o.text;
            $('#sl-mayus').checked = o.mayus; $('#sl-fecha').checked = o.fecha; $('#sl-relleno').checked = o.relleno;
            $('#sl-fechatxt').style.display = o.fecha ? '' : 'none'; $('#sl-fechatxt').value = o.fechaTxt;
            $('#sl-rot').value = o.rot; $('[data-rot-v]').textContent = o.rot + '°';
            $('#sl-tam').value = o.fontSize; $('[data-tam-v]').textContent = o.fontSize;
            velo.querySelectorAll('[data-iconos] [data-k]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === o.icono));
            velo.querySelectorAll('[data-fuentes] [data-k]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === o.fuente));
            velo.querySelectorAll('[data-bordes] [data-k]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === o.borde));
            velo.querySelectorAll('[data-c]').forEach(b => b.setAttribute('aria-pressed', b.dataset.c.toLowerCase() === o.color.toLowerCase()));
        }
        $('#sl-texto').oninput = (e) => { o.text = e.target.value || ' '; pintar(); };
        $('#sl-mayus').onchange = (e) => { o.mayus = e.target.checked; pintar(); };
        $('#sl-fecha').onchange = (e) => { o.fecha = e.target.checked; pintar(); };
        $('#sl-relleno').onchange = (e) => { o.relleno = e.target.checked; pintar(); };
        $('#sl-fechatxt').oninput = (e) => { o.fechaTxt = e.target.value; $('[data-vista]').src = dibujar(o, 3).canvas.toDataURL(); };
        $('#sl-rot').oninput = (e) => { o.rot = +e.target.value; pintar(); };
        $('[data-recto]').onclick = () => { o.rot = 0; pintar(); };
        $('#sl-tam').oninput = (e) => { o.fontSize = +e.target.value; pintar(); };
        const cerrar = () => { velo.remove(); document.removeEventListener('keydown', tecla, true); };
        const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(); } };
        document.addEventListener('keydown', tecla, true);
        velo.addEventListener('click', (e) => { if (e.target === velo) cerrar(); });
        velo.addEventListener('keydown', (e) => e.stopPropagation());
        $('[data-cancelar]').onclick = cerrar;
        $('[data-guardar-mio]').onclick = () => {
            const l = misSellos().filter(m => JSON.stringify(m) !== JSON.stringify(o));
            l.unshift({ ...o }); guardarMis(l); listaModelos();
            if (window.showToast) showToast('Sello guardado en «Mis sellos».', 'emerald');
        };
        $('[data-ok]').onclick = () => { if (!o.text.trim()) return; cerrar(); alGuardar(o); };
        listaModelos(); pintar();
        setTimeout(() => $('#sl-texto').focus(), 50);
    }

    // «Sello» abre el editor en vez de poner uno al azar
    window.addPredefinedStamp = function () {
        editor(null, (o) => {
            const n = pdfPages[currentPageIndex].objects.filter(x => x.type === 'stamp').length;
            const obj = { id: 'stmp-' + Date.now(), type: 'stamp', x: 260 + (n % 4) * 20, y: 280 + (n % 6) * 60, ...o };
            pdfPages[currentPageIndex].objects.push(obj);
            renderCurrentPage();
            if (window.selectObject) try { selectObject(obj.id); } catch (e) { /* nada */ }
        });
    };
    // Doble toque o «Editar» sobre un sello: abre el editor
    const editar0 = window.startInlineEdit;
    window.startInlineEdit = function (id) {
        const obj = pdfPages[currentPageIndex].objects.find(o => o.id === id);
        if (obj && obj.type === 'stamp') {
            return editor(obj, (o) => { Object.assign(obj, o); renderCurrentPage(); if (window.selectObject) try { selectObject(obj.id); } catch (e) { /* nada */ } });
        }
        return editar0.apply(this, arguments);
    };
})();
