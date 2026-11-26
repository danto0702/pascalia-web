// Firma en masa: un lote de PDF o Word se firma con la misma firma y el mismo objeto.
// Cada documento recibe su propio consecutivo (asignado por el servidor) y su registro en el historial.
// Los PDF se procesan en el navegador; los Word pueden pasar por el convertidor exacto (se borran al convertirse).
(function () {
    'use strict';
    if (!window.PascalCuenta || !window.PascalSello) return;
    const { api } = PascalCuenta;
    const { hoja, aviso, esc, toast, conBoton } = PascalCuenta.ui;
    const MAX_ARCHIVOS = 200, MAX_MB = 30;
    const LIBS = {
        jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
        docx: 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.7/dist/docx-preview.min.js',
        h2c: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    };
    const cargadas = {};
    function cargar(url) {
        return cargadas[url] || (cargadas[url] = new Promise((ok, mal) => {
            const s = document.createElement('script');
            s.src = url; s.onload = ok; s.onerror = () => { delete cargadas[url]; mal(new Error('No se pudo cargar una librería. Revisa tu conexión.')); };
            document.head.appendChild(s);
        }));
    }
    const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    const huella = async (bytes) => hex(await crypto.subtle.digest('SHA-256', bytes));
    const winAnsi = (t) => String(t).normalize('NFC').replace(/[^\x20-\x7E\xA0-\xFF—–‘’“”…•€]/g, '?');
    const base = (n) => n.replace(/\.(pdf|docx)$/i, '').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Documento';

    // ------------------------------------------------------------------ Word → PDF (word.js)
    // En el lote no se pregunta en cada archivo: se usa la elección guardada o, si hay convertidor, la conversión exacta.
    async function wordAPdf(file) {
        let modo = null; try { modo = localStorage.getItem('pascal-word-modo'); } catch (e) { /* nada */ }
        if (!modo) modo = window.PASCAL_CONVERTIDOR ? 'servidor' : 'local';
        return (await PascalWord.convertir(file, { modo, sinRespaldo: modo === 'servidor' })).bytes;
    }

    // ------------------------------------------------------------------ estampar firma + datos en un PDF
    // ubicaciones: lista de PascalUbicar.localizar (página, tipo y coordenadas)
    async function estampar(bytes, firma, datos, ubicaciones, evidencia) {
        const { PDFDocument, StandardFonts, rgb } = PDFLib;
        let pdf;
        try { pdf = await PDFDocument.load(bytes); }
        catch (e) { throw new Error(/encrypt/i.test(e.message) ? 'está protegido con contraseña' : 'no es un PDF válido'); }
        const fuente = await pdf.embedFont(StandardFonts.Helvetica);
        const img = await pdf.embedPng(firma.png);
        const paginas = pdf.getPages();
        for (const u of ubicaciones) {
            const page = paginas[Math.min(u.pagina, paginas.length - 1)];
            PascalUbicar.estamparEn(page, u, img, fuente, datos, winAnsi);
        }
        if (evidencia) {
            const p = pdf.addPage([612, 792]);
            const negra = await pdf.embedFont(StandardFonts.HelveticaBold);
            const gris = rgb(0.35, 0.35, 0.4), tinta = rgb(0.12, 0.12, 0.12);
            let y = 740;
            const linea = (t, f = fuente, s = 10, c = tinta) => { p.drawText(winAnsi(t).slice(0, 110), { x: 56, y, size: s, font: f, color: c }); y -= s + 8; };
            linea('Hoja de evidencia de firma electrónica', negra, 16); y -= 6;
            linea('Firmado electrónicamente por ' + datos.nombre.toUpperCase());
            if (datos.delegado) linea('Usada por delegación: ' + datos.delegado);
            linea('Objeto: ' + (datos.objeto || '—'));
            if (datos.radicado) linea('Radicado: ' + datos.radicado);
            linea('Consecutivo: ' + datos.consecutivo);
            linea('Registrada el ' + new Date(evidencia.firmado_en).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'medium', timeZone: 'America/Bogota' }) + ' (hora del servidor, Colombia)');
            linea('Registro: ' + evidencia.id, fuente, 9, gris);
            linea('Huella SHA-256 del documento original:', fuente, 9, gris);
            linea(evidencia.hash, fuente, 8, gris);
            y -= 10;
            linea('Firma electrónica (Ley 527 de 1999 y Decreto 2364 de 2012) hecha con PascalPDF, en lote.', fuente, 8, gris);
            linea('No es firma digital certificada. Verifica que tu trámite la acepte.', fuente, 8, gris);
        }
        return pdf.save();
    }

    // ------------------------------------------------------------------ pantalla
    async function abrir() {
        if (!(await PascalCuenta.requiere(2, 'Firma en masa'))) return;
        const propias = typeof mySignatures !== 'undefined' ? mySignatures : [];
        let delegadas = [];
        try { if (window.PascalDelegar) delegadas = await PascalDelegar.vigentes(); } catch (e) { /* sin delegaciones */ }
        const opciones = [
            ...propias.map((s, i) => ({ v: 'p' + i, t: `${s.signer} · mi firma` })),
            ...delegadas.map((d, i) => ({ v: 'd' + i, t: `${d.firma_nombre} · delegada por ${d.titular_nombre || d.titular_correo}` }))
        ];
        const h = hoja(`
            <h2>Firma en masa</h2>
            <p class="pc-muted">Carga hasta ${MAX_ARCHIVOS} PDF o Word. Todos se firman con la misma firma y el mismo objeto; cada uno recibe su propio consecutivo y queda en tu historial. Los documentos no salen de tu dispositivo.</p>
            <label class="pc-btn pc-sec" style="width:100%;box-sizing:border-box;margin:6px 0">Elegir documentos (PDF o Word)<input type="file" data-archivos multiple accept=".pdf,.docx,.doc,application/msword,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></label>
            <p class="pc-muted" data-cuantos style="margin:0 0 6px">Ningún documento elegido.</p>
            ${opciones.length ? `<label class="pc-muted" for="ms-firma">Firma</label><select class="pc-campo" id="ms-firma">${opciones.map(o => `<option value="${o.v}">${esc(o.t)}</option>`).join('')}</select>`
            : '<p class="pc-msg pc-err">Primero guarda una firma en este dispositivo (Firmar → «Guardar esta firma»).</p>'}
            <label class="pc-muted" for="ms-objeto">Objeto (va en todos los documentos)</label>
            <input class="pc-campo" id="ms-objeto" maxlength="120" placeholder="Ej. Certificado de cumplimiento">
            <select class="pc-campo" id="ms-objeto-sel" hidden></select>
            <label class="pc-muted" for="ms-radicado">Radicado (opcional, igual para todos)</label>
            <input class="pc-campo" id="ms-radicado" maxlength="60">

            <div class="pc-sec-t">Dónde va la firma</div>
            <select class="pc-campo" id="ms-modo" aria-label="Cómo ubicar la firma">
                <option value="auto">Automática: campo de firma, palabra y línea de firma (recomendado)</option>
                <option value="marcada">La posición que marque en el primer documento</option>
                <option value="fija">Posición fija</option>
            </select>
            <div data-bloque="auto">
                <div style="border:1px solid #E9E9E9;border-radius:14px;padding:10px 12px;margin:6px 0">
                    <label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="ms-bloque"> Firmo sobre mi nombre</label>
                    <div data-bloque-campos hidden>
                        <label class="pc-muted" for="ms-nombre">Nombre como aparece en los documentos</label>
                        <input class="pc-campo" id="ms-nombre" maxlength="120" placeholder="Ej. Danilo Torrado Blanco">
                        <label class="pc-muted" for="ms-cargo">Cargo o texto debajo del nombre (opcional)</label>
                        <input class="pc-campo" id="ms-cargo" maxlength="80" placeholder="Ej. Coordinador">
                        <label class="pc-muted" for="ms-lado">Dónde va la firma</label>
                        <select class="pc-campo" id="ms-lado"><option value="encima">Encima del nombre</option><option value="izquierda">A la izquierda del nombre</option><option value="derecha">A la derecha del nombre</option></select>
                        <p class="pc-muted" style="font-size:12px;margin:4px 0">Se usa el nombre que va solo en su renglón (con el cargo debajo, si lo escribes), no las veces que aparece dentro del texto.</p>
                        <button type="button" class="pc-btn pc-sec" data-guardar-bloque style="min-height:38px;padding:6px 14px">Guardar como mi bloque de firma</button>
                    </div>
                </div>
                <label class="pc-muted" for="ms-palabra">Palabra o frase junto a la firma (opcional)</label>
                <input class="pc-campo" id="ms-palabra" maxlength="80" placeholder="Ej. Firma del contratista, Firma:, tu nombre">
                <p class="pc-muted" style="font-size:12px;margin:2px 0 6px">Busca, en este orden: el campo de firma del PDF, tu bloque de firma (si lo activas), esta palabra y una línea «______» junto a «Firma», «Contratista», «C.C.»…</p>
            </div>
            <div data-bloque="marca" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:4px 0">
                <button type="button" class="pc-btn pc-sec" data-marcar>Marcar en el primer documento</button>
                <span class="pc-muted" data-marca-txt>Sin marcar (opcional en la automática)</span>
            </div>
            <div data-bloque="fija">
                <p class="pc-muted" data-fija-txt style="margin:6px 0 0;font-size:13px">Si no se encuentra el campo de firma:</p>
                <div class="pc-fila" style="margin-top:4px">
                    <div><label class="pc-muted" for="ms-pagina">Página</label><select class="pc-campo" id="ms-pagina"><option value="ultima">Última</option><option value="primera">Primera</option><option value="todas">Todas</option></select></div>
                    <div><label class="pc-muted" for="ms-lugar">Ubicación</label><select class="pc-campo" id="ms-lugar"><option value="derecha">Abajo a la derecha</option><option value="centro">Abajo al centro</option><option value="izquierda">Abajo a la izquierda</option></select></div>
                </div>
            </div>
            <label style="display:flex;gap:8px;align-items:center;margin:8px 0;font-size:14px"><input type="checkbox" id="ms-evidencia" checked> Agregar hoja de evidencia al final de cada documento</label>
            <div class="pc-fila"><button class="pc-btn pc-sec" data-revisar ${opciones.length ? '' : 'disabled'}>1. Revisar dónde queda la firma</button><button class="pc-btn" data-firmar disabled>2. Firmar los documentos</button></div>
            <div data-progreso class="pc-muted" style="margin-top:10px" aria-live="polite"></div>
            <div data-revision></div>
            <div data-msg></div>
            <p class="pc-muted" style="font-size:12px;margin-top:12px">Los Word se convierten a PDF en tu navegador: conservan su aspecto, pero el texto queda como imagen, así que en ellos no se busca el campo: se usa la posición marcada o la fija. Si necesitas que se busque, guárdalos como PDF desde Word antes de cargarlos.</p>`);
        const q = (s) => h.querySelector(s);
        const msg = q('[data-msg]'), prog = q('[data-progreso]');
        let archivos = [], docs = [], errores = [], marca = null, revisado = false;

        const invalidar = () => { revisado = false; q('[data-firmar]').disabled = true; q('[data-revision]').innerHTML = ''; };
        const pintarModo = () => {
            const m = q('#ms-modo').value;
            q('[data-bloque="auto"]').hidden = m !== 'auto';
            q('[data-bloque="marca"]').style.display = m === 'fija' ? 'none' : 'flex';
            q('[data-bloque="fija"]').hidden = m === 'marcada';
            q('[data-fija-txt]').textContent = m === 'fija' ? 'Posición en todos los documentos:' : 'Si no se encuentra el campo de firma (ni hay posición marcada):';
            q('[data-marca-txt]').textContent = marca ? `Marcada en la ${marca.pagina === 'ultima' ? 'última página' : 'página ' + (marca.pagina + 1)}` : (m === 'marcada' ? 'Falta marcar la posición' : 'Sin marcar (opcional)');
            invalidar();
        };
        ['#ms-modo', '#ms-palabra', '#ms-pagina', '#ms-lugar', '#ms-bloque', '#ms-nombre', '#ms-cargo', '#ms-lado'].forEach(s => q(s).addEventListener('input', pintarModo));
        // Bloque de firma: se recuerda en el dispositivo; el nombre se sugiere con el de la firma elegida
        const BLOQUE = 'pascalpdf-bloque-firma';
        try { const b = JSON.parse(localStorage.getItem(BLOQUE) || 'null'); if (b) { q('#ms-bloque').checked = !!b.activo; q('#ms-nombre').value = b.nombre || ''; q('#ms-cargo').value = b.cargo || ''; q('#ms-lado').value = b.lado || 'encima'; } } catch (e) { /* sin almacenamiento */ }
        const pintarBloque = () => { q('[data-bloque-campos]').hidden = !q('#ms-bloque').checked; };
        q('#ms-bloque').addEventListener('change', () => {
            pintarBloque();
            if (q('#ms-bloque').checked && !q('#ms-nombre').value) { const e = elegida(); q('#ms-nombre').value = e.propia ? e.propia.signer : (e.delegada ? e.delegada.firma_nombre : ''); }
        });
        pintarBloque();
        q('[data-guardar-bloque]').onclick = () => {
            try { localStorage.setItem(BLOQUE, JSON.stringify({ activo: q('#ms-bloque').checked, nombre: q('#ms-nombre').value.trim(), cargo: q('#ms-cargo').value.trim(), lado: q('#ms-lado').value })); toast('Bloque de firma guardado en este dispositivo.'); }
            catch (e) { toast('No se pudo guardar en este navegador.', true); }
        };
        pintarModo();

        q('[data-archivos]').onchange = (e) => {
            archivos = [...e.target.files].filter(f => /\.(pdf|docx?)$/i.test(f.name));
            const grandes = archivos.filter(f => f.size > MAX_MB * 1048576);
            if (archivos.length > MAX_ARCHIVOS) { aviso(msg, `Máximo ${MAX_ARCHIVOS} documentos por lote.`); archivos = archivos.slice(0, MAX_ARCHIVOS); }
            else if (grandes.length) { aviso(msg, `${grandes.length} documento(s) pasan de ${MAX_MB} MB y no se incluirán.`); archivos = archivos.filter(f => f.size <= MAX_MB * 1048576); }
            else aviso(msg, '');
            const w = archivos.filter(f => /\.docx?$/i.test(f.name)).length;
            q('[data-cuantos]').textContent = archivos.length ? `${archivos.length} documento(s): ${archivos.length - w} PDF y ${w} Word.` : 'Ningún documento elegido.';
            docs = []; errores = []; marca = null; pintarModo();
        };
        // Firma delegada con objetos restringidos: el objeto se elige de la lista autorizada
        const elegida = () => {
            const v = q('#ms-firma') ? q('#ms-firma').value : '';
            return v.startsWith('d') ? { delegada: delegadas[+v.slice(1)] } : { propia: propias[+v.slice(1)] };
        };
        const ajustarObjeto = () => {
            const e = elegida(), lista = e.delegada ? e.delegada.objetos : [];
            q('#ms-objeto').hidden = lista.length > 0;
            q('#ms-objeto-sel').hidden = !lista.length;
            q('#ms-objeto-sel').innerHTML = lista.map(o => `<option>${esc(o)}</option>`).join('');
        };
        if (q('#ms-firma')) { q('#ms-firma').onchange = ajustarObjeto; ajustarObjeto(); }

        // Prepara cada documento una sola vez (Word → PDF, huella, número de páginas)
        async function preparar() {
            if (docs.length || !archivos.length) return;
            errores = [];
            for (let i = 0; i < archivos.length; i++) {
                const f = archivos[i];
                prog.textContent = `Preparando ${i + 1} de ${archivos.length}: ${f.name}`;
                try {
                    const original = new Uint8Array(await f.arrayBuffer());
                    const esWord = /\.docx$/i.test(f.name);
                    const pdfBytes = esWord ? new Uint8Array(await wordAPdf(f)) : original;
                    const doc = await PDFLib.PDFDocument.load(pdfBytes).catch(err => { throw new Error(/encrypt/i.test(err.message) ? 'está protegido con contraseña' : 'no es un PDF válido'); });
                    docs.push({ nombre: f.name, bytes: pdfBytes, hash: await huella(original), paginas: doc.getPageCount(), esWord });
                } catch (err) { errores.push(`${f.name}: ${err.message}`); }
            }
            prog.textContent = '';
            if (!docs.length) throw new Error('Ningún documento se pudo leer. ' + errores.slice(0, 3).join(' · '));
        }
        const opcionesUbicar = () => ({
            modo: q('#ms-modo').value, palabra: q('#ms-palabra').value.trim(), marca,
            bloque: { activo: q('#ms-bloque').checked, nombre: q('#ms-nombre').value.trim(), cargo: q('#ms-cargo').value.trim(), lado: q('#ms-lado').value },
            fija: { pagina: q('#ms-pagina').value, lugar: q('#ms-lugar').value }
        });

        const bMarcar = q('[data-marcar]');
        bMarcar.onclick = () => conBoton(bMarcar, async () => {
            if (!archivos.length) return aviso(msg, 'Primero elige los documentos.');
            try { await preparar(); } catch (e) { return aviso(msg, e.message); }
            const m = await PascalUbicar.marcar(docs[0].bytes, docs[0].nombre);
            if (m) { marca = m; pintarModo(); }
        });

        // 1. Revisar: ubica la firma en cada documento y muestra el resumen con vista previa
        async function revisar() {
            aviso(msg, '');
            if (!archivos.length) { aviso(msg, 'Elige los documentos que vas a firmar.'); return false; }
            const op = opcionesUbicar();
            if (op.modo === 'marcada' && !marca) { aviso(msg, 'Marca la posición en el primer documento o elige otra forma de ubicar la firma.'); return false; }
            await preparar();
            for (let i = 0; i < docs.length; i++) {
                prog.textContent = `Buscando dónde va la firma: ${i + 1} de ${docs.length}`;
                docs[i].ubic = await PascalUbicar.localizar(docs[i].bytes, docs[i].esWord && op.modo === 'auto' ? { ...op, palabra: '' } : op);
            }
            prog.textContent = '';
            const conAviso = docs.filter(d => d.ubic[0].aviso).length;
            q('[data-revision]').innerHTML = `
                <div class="pc-sec-t">Revisión del lote${conAviso ? ` · <span style="color:#991B1B">${conAviso} sin campo encontrado</span>` : ''}</div>
                <div style="max-height:260px;overflow:auto;border:1px solid #E9E9E9;border-radius:14px">
                ${docs.map((d, i) => `<div style="display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid #F2F2F2;font-size:13px">
                    <span style="flex:1;min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.nombre)}</b>
                    <span style="color:${d.ubic[0].aviso ? '#991B1B' : '#166534'}">${esc(d.ubic[0].metodo)}</span><span class="pc-muted"> · pág. ${d.ubic.map(u => u.pagina + 1).join(', ')} · ${esc(d.ubic[0].detalle || '')}${d.ubic[0].aviso ? ' · ' + esc(d.ubic[0].aviso) : ''}</span></span>
                    <button type="button" class="pc-btn pc-sec" data-ver="${i}" style="min-height:36px;padding:6px 14px;flex:0 0 auto">Ver</button></div>`).join('')}
                </div>
                ${errores.length ? `<p class="pc-msg pc-err">No se pudieron leer: ${esc(errores.slice(0, 4).join(' · '))}</p>` : ''}`;
            q('[data-revision]').querySelectorAll('[data-ver]').forEach(b => b.onclick = () => conBoton(b, async () => {
                const d = docs[+b.dataset.ver];
                const lienzo = await PascalUbicar.vistaPrevia(d.bytes, d.ubic[0]);
                const v = document.createElement('div');
                v.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(20,20,20,.86);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:14px;color:#fff;font:14px Inter,sans-serif';
                lienzo.style.cssText = 'max-width:min(560px,94vw);max-height:78vh;width:auto;height:auto;background:#fff;border-radius:6px';
                v.innerHTML = `<b>${esc(d.nombre)} · página ${d.ubic[0].pagina + 1}</b>`;
                v.appendChild(lienzo);
                const c = document.createElement('button');
                c.textContent = 'Cerrar';
                c.style.cssText = 'min-height:44px;padding:0 24px;border-radius:999px;border:0;background:#FFC107;color:#1F1F1F;font:700 14px Montserrat,Inter,sans-serif';
                c.onclick = () => v.remove();
                v.appendChild(c);
                v.onclick = (e) => { if (e.target === v) v.remove(); };
                document.body.appendChild(v);
            }));
            revisado = true;
            q('[data-firmar]').disabled = false;
            q('[data-firmar]').textContent = `2. Firmar ${docs.length} documento(s)`;
            return true;
        }
        const bRev = q('[data-revisar]');
        bRev.onclick = () => conBoton(bRev, async () => { try { await revisar(); } catch (e) { prog.textContent = ''; aviso(msg, e.message); } });

        // 2. Firmar: registra en el servidor (consecutivos), estampa y descarga
        const btn = q('[data-firmar]');
        btn.onclick = () => conBoton(btn, async () => {
            aviso(msg, '');
            if (!revisado && !(await revisar())) return;
            const e = elegida();
            const objeto = (e.delegada && e.delegada.objetos.length ? q('#ms-objeto-sel').value : q('#ms-objeto').value).trim();
            if (!objeto) return aviso(msg, 'Escribe el objeto que va en los documentos.');
            const radicado = q('#ms-radicado').value.trim();
            const sinCampo = docs.filter(d => d.ubic[0].aviso).length;
            if (!confirm(`Vas a firmar ${docs.length} documento(s) con el objeto «${objeto}».${sinCampo ? ` En ${sinCampo} no se encontró el campo de firma y se usará la posición ${marca ? 'marcada' : 'fija'}.` : ''} Revisa que sean los correctos: tú respondes por lo que firmas. ¿Continuar?`)) return;
            const conEvidencia = q('#ms-evidencia').checked;
            try {
                // Firma a usar
                let firma, delegacionId = null, delegado = null, metodo;
                if (e.delegada) {
                    prog.textContent = 'Trayendo la firma delegada…';
                    const x = await PascalDelegar.obtener(e.delegada, objeto);
                    firma = { id: x.sig.id, nombre: x.sig.signer, png: x.sig.src };
                    delegacionId = x.delegacionId; metodo = 'imagen';
                    const c = PascalCuenta.cuenta; delegado = c ? (c.nombre || c.correo) : null;
                } else {
                    firma = { id: e.propia.id, nombre: e.propia.signer, png: await PascalDelegar.firmaPNG(e.propia) };
                    metodo = e.propia.kind === 'text' ? 'escrita' : e.propia.kind === 'drawn' ? 'dibujada' : 'imagen';
                }
                // Registrar las firmas en el servidor (consecutivo y hora del servidor), de a 50
                const registros = [];
                for (let i = 0; i < docs.length; i += 50) {
                    prog.textContent = `Registrando firmas ${i + 1}–${Math.min(i + 50, docs.length)} de ${docs.length}…`;
                    const r = await api('registrar_firmas', {
                        eventos: docs.slice(i, i + 50).map(d => ({
                            app: 'pascalpdf', documento_nombre: d.nombre, documento_tipo: 'Otro', documento_hash: d.hash,
                            firma_id: firma.id, metodo, paginas: d.paginas, firmante: firma.nombre, objeto, radicado: radicado || null,
                            delegacion_id: delegacionId
                        }))
                    });
                    registros.push(...r.registros);
                }
                // Estampar firma, datos y consecutivo en cada documento
                await cargar(LIBS.jszip);
                const zip = new JSZip();
                const salidas = [], fallos = [];
                for (let i = 0; i < docs.length; i++) {
                    const d = docs[i], reg = registros[i];
                    prog.textContent = `Firmando ${i + 1} de ${docs.length}: ${d.nombre}`;
                    const datos = { nombre: firma.nombre, fecha: PascalSello.fechaISO(new Date(reg.firmado_en)), objeto, radicado, consecutivo: reg.consecutivo, delegado };
                    try {
                        const out = await estampar(d.bytes, firma, datos, d.ubic, conEvidencia ? { ...reg, hash: d.hash } : null);
                        const n = `${base(d.nombre)}_firmado_${reg.consecutivo}.pdf`;
                        salidas.push({ n, out });
                        zip.file(n, out);
                    } catch (err) { fallos.push(`${d.nombre}: ${err.message}`); }
                }
                prog.textContent = 'Preparando la descarga…';
                if (salidas.length === 1) await downloadBlob(new Blob([salidas[0].out], { type: 'application/pdf' }), salidas[0].n);
                else if (salidas.length) await downloadBlob(await zip.generateAsync({ type: 'blob' }), `PascalPDF_firmados_${new Date().toISOString().slice(0, 10)}.zip`);
                prog.textContent = `Listo: ${salidas.length} documento(s) firmados, consecutivos ${registros[0].consecutivo} a ${registros[registros.length - 1].consecutivo}.`;
                const todos = [...errores, ...fallos];
                if (todos.length) aviso(msg, `No se pudieron firmar ${todos.length}: ${todos.slice(0, 5).join(' · ')}${todos.length > 5 ? '…' : ''}`);
                else aviso(msg, 'Todos los documentos quedaron firmados y registrados en tu historial.', true);
                toast(`${salidas.length} documento(s) firmados.`);
                invalidar();
            } catch (err) {
                console.error(err);
                prog.textContent = '';
                aviso(msg, err.message);
            }
        });
    }

    window.PascalMasiva = { abrir, wordAPdf, estampar };
    if (typeof SUITE_CATEGORIES !== 'undefined' && SUITE_CATEGORIES.sign) {
        SUITE_CATEGORIES.sign.tools.push({ label: 'Firma en masa (PDF y Word)', icon: 'fa-layer-group', action: () => abrir() });
    }
})();
