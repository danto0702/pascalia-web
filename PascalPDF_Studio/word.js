// Word → PDF para PascalPDF y Pascal Sign.
// Dos caminos: «Conversión exacta» (LibreOffice en el servidor; el archivo se borra apenas se convierte)
// o «Solo en mi celular» (docx-preview en el navegador; puede variar el formato y el texto queda como imagen).
// Siempre se revisa la vista antes de firmar, y se avisa de las letras que pueden verse distintas.
(function () {
    'use strict';
    const LIBS = {
        jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
        docx: 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.7/dist/docx-preview.min.js',
        h2c: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    };
    const CLAVE = 'pascal-word-modo';
    // Letras que el convertidor reproduce con la misma medida (o que están instaladas en él)
    const SEGURAS = ['calibri', 'calibri light', 'cambria', 'cambria math', 'arial', 'times new roman', 'courier new', 'courier', 'liberation sans', 'liberation serif',
        'liberation mono', 'carlito', 'caladea', 'dejavu sans', 'dejavu serif', 'helvetica', 'symbol', 'wingdings', 'noto sans', 'noto serif', 'verdana', 'georgia', 'tahoma'];
    const cargadas = {};
    function cargar(url) {
        return cargadas[url] || (cargadas[url] = new Promise((ok, mal) => {
            const s = document.createElement('script');
            s.src = url; s.onload = ok; s.onerror = () => { delete cargadas[url]; mal(new Error('No se pudo cargar una librería. Revisa tu conexión.')); };
            document.head.appendChild(s);
        }));
    }
    const esWord = (f) => /\.(docx?|DOCX?)$/.test(f.name || '') || /word|officedocument\.wordprocessing/.test(f.type || '');
    const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* nada */ } };
    const servidorListo = () => !!(window.PASCAL_CONVERTIDOR && window.PascalCuenta && PascalCuenta.token && PascalCuenta.token());
    const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // Letras usadas en el .docx (documento, estilos, encabezados y tema)
    async function fuentes(file) {
        if (!/\.docx$/i.test(file.name || '')) return [];
        try {
            await cargar(LIBS.jszip);
            const zip = await JSZip.loadAsync(file);
            const nombres = new Set();
            for (const ruta of Object.keys(zip.files).filter(r => /^word\/(document|styles|header\d*|footer\d*|theme\/theme\d*)\.xml$/.test(r))) {
                const xml = await zip.file(ruta).async('string');
                for (const m of xml.matchAll(/w:(?:ascii|hAnsi)="([^"]+)"|<a:latin typeface="([^"]+)"/g)) { const n = (m[1] || m[2] || '').trim(); if (n && !n.startsWith('+')) nombres.add(n); }
            }
            return [...nombres].filter(n => !SEGURAS.includes(n.toLowerCase()));
        } catch (e) { return []; }
    }

    // Elegir cómo convertir (la primera vez; luego se recuerda y se puede cambiar)
    function elegir() {
        return new Promise((ok) => {
            const ui = window.PascalCuenta && PascalCuenta.ui;
            if (!ui) return ok('local');
            const h = ui.hoja(`<h2 class="pc-h">¿Cómo convertimos tu Word?</h2>
                <p class="pc-muted">Para firmar un Word primero lo pasamos a PDF.</p>
                <button class="pc-btn" data-m="servidor" style="width:100%;margin-top:8px;flex-direction:column;gap:2px">Conversión exacta<small style="font:500 12px Inter,sans-serif;opacity:.8">Respeta tablas, márgenes y letras. El archivo se envía cifrado a nuestro convertidor y se borra apenas se convierte.</small></button>
                <button class="pc-btn pc-sec" data-m="local" style="width:100%;margin-top:10px;flex-direction:column;gap:2px">Solo en mi celular<small style="font:500 12px Inter,sans-serif;opacity:.8">No sale de tu dispositivo, pero el formato puede variar y el texto queda como imagen.</small></button>
                <label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:13px;color:#5C5C5C"><input type="checkbox" data-recordar checked> Recordar mi elección</label>`);
            h.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
                if (h.querySelector('[data-recordar]').checked) guardar(CLAVE, b.dataset.m);
                ui.cerrar(); ok(b.dataset.m);
            });
            const x = h.querySelector('.pc-cerrar'); if (x) x.addEventListener('click', () => ok(null));
        });
    }

    async function enServidor(file) {
        const r = await fetch(window.PASCAL_CONVERTIDOR.replace(/\/$/, '') + '/convertir', {
            method: 'POST', headers: { Authorization: 'Bearer ' + PascalCuenta.token() }, body: file
        });
        if (!r.ok) { let m = 'No se pudo convertir el documento.'; try { m = (await r.json()).error || m; } catch (e) { /* nada */ } const err = new Error(m); err.status = r.status; throw err; }
        return new Uint8Array(await r.arrayBuffer());
    }

    // Conversión en el navegador: se dibuja con docx-preview y cada página pasa a imagen
    async function enNavegador(file) {
        await cargar(LIBS.jszip); await cargar(LIBS.docx); await cargar(LIBS.h2c);
        const caja = document.createElement('div');
        caja.style.cssText = 'position:fixed;left:-20000px;top:0;background:#fff;color:#000';
        document.body.appendChild(caja);
        try {
            await window.docx.renderAsync(file, caja, null, { inWrapper: false, breakPages: true, ignoreLastRenderedPageBreak: false, renderHeaders: true, renderFooters: true, useBase64URL: true });
            const secciones = [...caja.querySelectorAll('section.docx')];
            if (!secciones.length) throw new Error('El Word no tiene contenido que se pueda mostrar.');
            const pdf = await PDFLib.PDFDocument.create();
            for (const sec of secciones) {
                const cs = getComputedStyle(sec);
                const wpx = sec.offsetWidth, hpx = parseFloat(cs.minHeight) || wpx * 1.294, escala = 2;
                const lienzo = await html2canvas(sec, { scale: escala, backgroundColor: '#ffffff', logging: false, useCORS: true });
                const mT = Math.round((parseFloat(cs.paddingTop) || 72) * escala), mB = Math.round((parseFloat(cs.paddingBottom) || 72) * escala);
                const altoPag = Math.round(hpx * escala), util = altoPag - mT - mB;
                const cx = lienzo.getContext('2d'), finContenido = lienzo.height;
                const enBlanco = (y0, y1) => { const d = cx.getImageData(0, y0, lienzo.width, Math.max(1, y1 - y0)).data; for (let i = 0; i < d.length; i += 64) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) return false; return true; };
                let y = mT;
                while (y < finContenido - 4) {
                    let fin = Math.min(finContenido, y + util);
                    if (fin < finContenido) {
                        for (let f = fin; f > fin - util * 0.15; f -= 2) {
                            const fila = cx.getImageData(0, f, lienzo.width, 1).data;
                            let blanca = true;
                            for (let i = 0; i < fila.length; i += 16) if (fila[i] < 245 || fila[i + 1] < 245 || fila[i + 2] < 245) { blanca = false; break; }
                            if (blanca) { fin = f; break; }
                        }
                    }
                    if (enBlanco(y, fin)) break;
                    const trozo = document.createElement('canvas');
                    trozo.width = lienzo.width; trozo.height = altoPag;
                    const tx = trozo.getContext('2d');
                    tx.fillStyle = '#fff'; tx.fillRect(0, 0, trozo.width, trozo.height);
                    tx.drawImage(lienzo, 0, y, lienzo.width, fin - y, 0, mT, lienzo.width, fin - y);
                    const jpg = await pdf.embedJpg(await (await fetch(trozo.toDataURL('image/jpeg', 0.9))).arrayBuffer());
                    const page = pdf.addPage([wpx * 0.75, hpx * 0.75]);
                    page.drawImage(jpg, { x: 0, y: 0, width: wpx * 0.75, height: hpx * 0.75 });
                    y = fin;
                }
            }
            return await pdf.save();
        } finally { caja.remove(); }
    }

    // Convierte. opciones.modo fuerza 'servidor' o 'local' (la firma en masa no pregunta en cada archivo).
    // Devuelve { bytes, metodo: 'servidor'|'local', fuentes: [letras que pueden verse distintas], nombre }
    async function convertir(file, opciones = {}) {
        let modo = opciones.modo || (servidorListo() ? leer(CLAVE) : 'local');
        if (!modo) modo = await elegir();
        if (!modo) throw new Error('cancelado');
        const raras = await fuentes(file);
        const nombre = (file.name || 'Documento').replace(/\.docx?$/i, '') + '.pdf';
        if (modo === 'servidor' && servidorListo()) {
            try { return { bytes: await enServidor(file), metodo: 'servidor', fuentes: raras, nombre }; }
            catch (e) {
                if (e.status === 413 || e.status === 415) throw e;
                // Sin conexión con el convertidor: se usa el del navegador y se avisa
                return { bytes: await enNavegador(file), metodo: 'local', fuentes: raras, nombre, aviso: 'El convertidor exacto no respondió; se usó la conversión del celular.' };
            }
        }
        return { bytes: await enNavegador(file), metodo: 'local', fuentes: raras, nombre };
    }

    // Franja para revisar la conversión antes de firmar. alConfirmar se llama al tocar «Se ve bien».
    function franjaRevision(r, alConfirmar, opciones = {}) {
        document.querySelectorAll('.pw-franja').forEach(n => n.remove());
        if (!document.getElementById('pw-estilo')) {
            const st = document.createElement('style'); st.id = 'pw-estilo';
            st.textContent = `.pw-franja{position:fixed;left:12px;right:12px;bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:9500;max-width:560px;margin:0 auto;background:#1F1F1F;color:#fff;border-radius:18px;padding:14px 16px;box-shadow:0 18px 40px -16px rgba(0,0,0,.55);font:14px/1.45 Inter,system-ui,sans-serif;animation:pwSube .35s cubic-bezier(.16,1,.3,1) both}
            .pw-franja b{font:700 15px Montserrat,Inter,sans-serif;display:block;margin-bottom:2px}.pw-franja p{margin:0;color:#E9E8E9}
            .pw-franja .pw-fila{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.pw-franja button{border:0;border-radius:999px;padding:10px 16px;font:700 14px Montserrat,Inter,sans-serif;cursor:pointer;min-height:42px}
            .pw-ok{background:#FFC107;color:#1F1F1F}.pw-sec{background:#333;color:#fff}.pw-franja small{display:block;color:#FFD54F;margin-top:6px}
            @keyframes pwSube{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}`;
            document.head.appendChild(st);
        }
        const f = document.createElement('div');
        f.className = 'pw-franja'; f.setAttribute('role', 'status');
        const cambiar = r.metodo === 'local' && servidorListo();
        f.innerHTML = `<b>Revisa que se vea igual a tu Word</b>
            <p>${r.metodo === 'servidor' ? 'Lo convertimos con la conversión exacta.' : 'Lo convertimos en tu celular: revisa tablas, márgenes y saltos de página.'} Mira todas las páginas antes de firmar.</p>
            ${r.aviso ? `<small>${esc(r.aviso)}</small>` : ''}
            ${r.fuentes.length ? `<small>Tu documento usa la letra ${esc(r.fuentes.slice(0, 3).join(', '))}, que puede verse distinta. Si algo se corrió, guarda el Word como PDF desde Word o Google Docs y ábrelo aquí.</small>` : ''}
            <div class="pw-fila"><button class="pw-ok" data-ok>Se ve bien</button>${cambiar ? '<button class="pw-sec" data-exacta>Probar conversión exacta</button>' : ''}</div>`;
        document.body.appendChild(f);
        f.querySelector('[data-ok]').onclick = () => { f.remove(); alConfirmar && alConfirmar(); };
        const ex = f.querySelector('[data-exacta]');
        if (ex) ex.onclick = () => { f.remove(); opciones.reintentar && opciones.reintentar('servidor'); };
        return f;
    }

    window.PascalWord = { esWord, convertir, franjaRevision, fuentes, enNavegador, cambiarModo: () => { try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ } } };
})();
