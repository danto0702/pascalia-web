// Recuadro de firma electrónica (nombre, fecha, objeto y radicado), común a PascalPDF, Pascal Sign
// y la página de firma de otras personas. Se dibuja igual en pantalla (HTML) y en el PDF (pdf-lib).
(function () {
    'use strict';
    const TITULO = 'FIRMA ELECTRÓNICA — VÁLIDA SIN FÍSICA';
    const AZUL = '#245582';      // borde
    const TINTA = '#7F95AE';     // texto
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // Fecha local en formato AAAA-MM-DD
    function fechaISO(d) {
        const f = d instanceof Date ? d : new Date(d || Date.now());
        return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
    }

    function lineas(datos) {
        const out = [
            { t: TITULO, rol: 'titulo' },
            { t: String(datos.nombre || '').toUpperCase(), rol: 'nombre' },
            { t: 'Fecha: ' + (datos.fecha || fechaISO()), rol: 'dato' }
        ];
        if (datos.objeto) out.push({ t: 'Objeto: ' + datos.objeto, rol: 'dato' });
        if (datos.radicado) out.push({ t: 'Radicado: ' + datos.radicado, rol: 'dato' });
        return out;
    }

    // Proporciones relativas al ancho del recuadro
    const P = { pad: 0.045, titulo: 0.04, nombre: 0.05, dato: 0.046, lh: 1.32, radio: 0.03, borde: 0.006 };

    // Alto del recuadro (en las mismas unidades del ancho)
    function alto(w, datos) {
        const ls = lineas(datos);
        return w * P.pad * 2 + ls.reduce((a, l) => a + w * P[l.rol] * P.lh, 0);
    }

    // HTML para la vista en pantalla: ocupa el 100 % del ancho de su contenedor
    function html(datos) {
        return `<div style="container-type:inline-size;width:100%"><div class="sello-firma" style="border:max(1.5px,0.6cqw) solid ${AZUL};border-radius:3cqw;padding:4.5cqw 5cqw;color:${TINTA};font-family:Inter,Roboto,Arial,sans-serif;line-height:1.32;background:#fff;text-align:left">`
            + lineas(datos).map(l => `<div style="font-size:${(P[l.rol] * 100).toFixed(2)}cqw;${l.rol === 'titulo' ? 'font-weight:500' : ''};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.t)}</div>`).join('')
            + '</div></div>';
    }

    // Dibuja el recuadro en el PDF. "dibujo" traduce coordenadas de la vista (origen arriba a la izquierda):
    //   texto(str, x, yArriba, tamaño, fuente, color) y rect(x, yArriba, w, h, opciones)
    function pdf(dibujo, fuentes, x, y, w, datos, toWinAnsi) {
        const { rgb } = PDFLib;
        const hex = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
        const h = alto(w, datos);
        dibujo.rect(x, y, w, h, { color: rgb(1, 1, 1), borderColor: hex(AZUL), borderWidth: Math.max(0.8, w * P.borde), radio: w * P.radio });
        let yy = y + w * P.pad;
        const maxW = w * (1 - P.pad * 2.2);
        lineas(datos).forEach(l => {
            const font = l.rol === 'titulo' ? fuentes.medio || fuentes.regular : fuentes.regular;
            let size = w * P[l.rol];
            const t = toWinAnsi(l.t);
            while (size > 3 && font.widthOfTextAtSize(t, size) > maxW) size -= 0.2;
            const lh = w * P[l.rol] * P.lh;
            dibujo.texto(t, x + w * P.pad * 1.1, yy + (lh - size) / 2 + size * 0.05, size, font, hex(TINTA));
            yy += lh;
        });
        return h;
    }

    window.PascalSello = { html, pdf, alto, fechaISO, TITULO };
})();
