// Datos de la firma (nombre, fecha, objeto, radicado y consecutivo), comunes a PascalPDF y Pascal Sign.
// Van como líneas de texto debajo de la firma, igual que el pie de firma de siempre (sin recuadro).
// Se dibujan igual en pantalla (HTML) y en el PDF (pdf-lib).
(function () {
    'use strict';
    const TINTA = '#595966';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const dos = (n) => String(n).padStart(2, '0');

    // Fecha y hora local en formato AAAA-MM-DD HH:MM
    function fechaISO(d) {
        const f = d instanceof Date ? d : new Date(d || Date.now());
        return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())} ${dos(f.getHours())}:${dos(f.getMinutes())}`;
    }

    // Iniciales: primer nombre, primer apellido y segundo apellido (DANILO TORRADO BLANCO → DTB).
    // Con cuatro o más palabras se toman la primera y las dos últimas.
    function iniciales(nombre) {
        const p = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
            .split(/[^A-ZÑ]+/).filter(w => w && !['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y'].includes(w));
        const sel = p.length >= 4 ? [p[0], p[p.length - 2], p[p.length - 1]] : p;
        return sel.map(w => w[0]).join('') || 'X';
    }

    // Formato del consecutivo: iniciales-número-año (DTB-0001-2026)
    function formato(nombre, numero, anio) {
        return `${iniciales(nombre)}-${String(numero).padStart(4, '0')}-${anio}`;
    }

    // Respaldo sin conexión: contador del dispositivo, por año. El normal lo asigna el servidor al guardar.
    function consecutivoLocal(nombre) {
        const anio = new Date().getFullYear(), k = 'pascalpdf-consecutivo-' + anio;
        let n = 1;
        try { n = (parseInt(localStorage.getItem(k), 10) || 0) + 1; localStorage.setItem(k, String(n)); } catch (e) { n = Date.now() % 10000; }
        return formato(nombre, n, anio);
    }

    function lineas(datos) {
        const out = [
            'Firmado electrónicamente por ' + String(datos.nombre || '').toUpperCase(),
            'Fecha: ' + (datos.fecha || fechaISO())
        ];
        if (datos.delegado) out.push('Usada por delegación: ' + datos.delegado);
        if (datos.objeto) out.push('Objeto: ' + datos.objeto);
        if (datos.radicado) out.push('Radicado: ' + datos.radicado);
        out.push('Consecutivo: ' + (datos.consecutivo || `${iniciales(datos.nombre)}-____-${new Date().getFullYear()} (se asigna al guardar)`));
        return out;
    }

    // Proporciones relativas al ancho del bloque
    const P = { tam: 0.03, lh: 1.35 };

    // Alto del bloque (en las mismas unidades del ancho)
    function alto(w, datos) {
        return lineas(datos).length * w * P.tam * P.lh;
    }

    // HTML para la vista en pantalla: ocupa el 100 % del ancho de su contenedor
    function html(datos) {
        return `<div style="container-type:inline-size;width:100%"><div class="sello-firma" style="color:${TINTA};font-family:Inter,Roboto,Arial,sans-serif;line-height:${P.lh};text-align:left">`
            + lineas(datos).map(t => `<div style="font-size:${(P.tam * 100).toFixed(2)}cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t)}</div>`).join('')
            + '</div></div>';
    }

    // Dibuja las líneas en el PDF. "dibujo.texto(str, x, yArriba, tamaño, fuente, color)" usa coordenadas de la vista.
    function pdf(dibujo, fuentes, x, y, w, datos, toWinAnsi) {
        const { rgb } = PDFLib;
        const color = rgb(0x59 / 255, 0x59 / 255, 0x66 / 255);
        const lh = w * P.tam * P.lh;
        let yy = y;
        lineas(datos).forEach(l => {
            const t = toWinAnsi(l);
            let size = w * P.tam;
            while (size > 3 && fuentes.regular.widthOfTextAtSize(t, size) > w) size -= 0.2;
            dibujo.texto(t, x, yy + (lh - size) / 2, size, fuentes.regular, color);
            yy += lh;
        });
        return alto(w, datos);
    }

    window.PascalSello = { html, pdf, alto, fechaISO, iniciales, formato, consecutivoLocal };
})();
