// Foto de la firma: cámara del dispositivo y limpieza de la imagen, todo en el navegador.
// La limpieza corrige la luz desigual (sombras, papel gris), separa la tinta del papel con un umbral
// automático, oscurece el trazo y deja el fondo transparente. Común a PascalPDF, Pascal Sign y la firma de terceros.
(function () {
    'use strict';
    const TINTA = [22, 34, 64]; // azul muy oscuro, se lee como tinta en pantalla e impreso

    // ------------------------------------------------------------------ limpieza
    // fuente: ImageBitmap, HTMLImageElement o canvas. Devuelve { src, w, h } recortado o null si no hay trazo.
    function limpiar(fuente, opciones = {}) {
        const max = opciones.max || 1400;
        const W0 = fuente.width, H0 = fuente.height;
        const k = Math.min(1, max / Math.max(W0, H0));
        const W = Math.max(1, Math.round(W0 * k)), H = Math.max(1, Math.round(H0 * k));
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(fuente, 0, 0, W, H);
        const img = cx.getImageData(0, 0, W, H), d = img.data, n = W * H;

        // 1. Luminancia
        const L = new Float32Array(n);
        for (let i = 0, j = 0; i < n; i++, j += 4) L[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];

        // 2. Fondo (iluminación del papel): máximo por bloques, suavizado y ampliado
        const B = Math.max(8, Math.round(Math.max(W, H) / 40));
        const bw = Math.ceil(W / B), bh = Math.ceil(H / B);
        const blo = new Float32Array(bw * bh);
        for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
            // percentil alto del bloque (más robusto que el máximo ante brillos)
            const vals = [];
            for (let y = by * B; y < Math.min(H, (by + 1) * B); y += 2) for (let x = bx * B; x < Math.min(W, (bx + 1) * B); x += 2) vals.push(L[y * W + x]);
            vals.sort((a, b) => a - b);
            blo[by * bw + bx] = vals.length ? vals[Math.floor(vals.length * 0.9)] : 255;
        }
        // dilatar (el trazo nunca debe tomarse como fondo) y suavizar
        const dil = new Float32Array(bw * bh);
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
            let m = 0;
            for (let yy = Math.max(0, y - 1); yy <= Math.min(bh - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(bw - 1, x + 1); xx++) m = Math.max(m, blo[yy * bw + xx]);
            dil[y * bw + x] = m;
        }
        const fondoAt = (x, y) => {
            const fx = Math.min(bw - 1.001, Math.max(0, x / B - 0.5)), fy = Math.min(bh - 1.001, Math.max(0, y / B - 0.5));
            const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(bw - 1, x0 + 1), y1 = Math.min(bh - 1, y0 + 1);
            const tx = fx - x0, ty = fy - y0;
            return (dil[y0 * bw + x0] * (1 - tx) + dil[y0 * bw + x1] * tx) * (1 - ty) + (dil[y1 * bw + x0] * (1 - tx) + dil[y1 * bw + x1] * tx) * ty;
        };

        // 3. Oscuridad relativa al papel (0 = papel, 1 = negro)
        const D = new Float32Array(n);
        const hist = new Uint32Array(256);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x;
            const f = Math.max(30, fondoAt(x, y));
            const v = Math.max(0, Math.min(1, 1 - L[i] / f));
            D[i] = v;
            hist[Math.round(v * 255)]++;
        }

        // 4. Umbral automático (Otsu) con un mínimo para no tomar la textura del papel como tinta
        let total = 0, suma = 0;
        for (let t = 0; t < 256; t++) { total += hist[t]; suma += t * hist[t]; }
        let sB = 0, wB = 0, mejor = 0, umbral = 0;
        for (let t = 0; t < 256; t++) {
            wB += hist[t]; if (!wB) continue;
            const wF = total - wB; if (!wF) break;
            sB += t * hist[t];
            const mB = sB / wB, mF = (suma - sB) / wF;
            const v = wB * wF * (mB - mF) * (mB - mF);
            if (v > mejor) { mejor = v; umbral = t; }
        }
        const t = Math.max(0.14, Math.min(0.5, umbral / 255));

        // 5. Alfa suave alrededor del umbral; color de tinta uniforme y oscuro
        const bajo = t * 0.55, alto = Math.min(0.95, t * 1.6);
        let tinta = 0;
        for (let i = 0, j = 0; i < n; i++, j += 4) {
            const v = D[i];
            let a = v <= bajo ? 0 : v >= alto ? 1 : (v - bajo) / (alto - bajo);
            a = a * a * (3 - 2 * a);
            d[j] = TINTA[0]; d[j + 1] = TINTA[1]; d[j + 2] = TINTA[2];
            d[j + 3] = Math.round(a * 255);
            if (a > 0.5) tinta++;
        }

        // 6. Quitar motas sueltas (píxeles con tinta sin vecinos con tinta)
        const A = new Uint8ClampedArray(n);
        for (let i = 0; i < n; i++) A[i] = d[i * 4 + 3];
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
            const i = y * W + x;
            if (!A[i]) continue;
            let vec = 0;
            for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) if ((yy || xx) && A[i + yy * W + xx] > 60) vec++;
            if (vec < 2) d[i * 4 + 3] = 0;
        }
        if (tinta < n * 0.0008) return null;
        cx.putImageData(img, 0, 0);
        return recortar(c, Math.round(Math.max(W, H) * 0.02));
    }

    // Recorta al trazo con un pequeño margen
    function recortar(c, margen = 8) {
        const { width: W, height: H } = c;
        const d = c.getContext('2d').getImageData(0, 0, W, H).data;
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) {
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        if (x1 < 0) return null;
        x0 = Math.max(0, x0 - margen); y0 = Math.max(0, y0 - margen);
        x1 = Math.min(W - 1, x1 + margen); y1 = Math.min(H - 1, y1 + margen);
        const o = document.createElement('canvas');
        o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
        o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
        return { src: o.toDataURL('image/png'), w: o.width, h: o.height };
    }

    // Lee un archivo de imagen (rechaza HEIC, que los navegadores no abren)
    async function leer(file) {
        if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) throw new Error('Las fotos HEIC del iPhone no se pueden abrir aquí. Usa «Tomar foto» o toma una captura de pantalla de la foto.');
        try {
            return await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch (e) {
            try { return await createImageBitmap(file); } catch (e2) { throw new Error('No se pudo leer la imagen. Usa una foto en JPG o PNG.'); }
        }
    }

    // ------------------------------------------------------------------ cámara
    // Abre la cámara (trasera en el celular) con una guía para encuadrar la firma.
    // Devuelve un canvas con la foto o null si la persona cancela. Sin acceso a la cámara, usa el selector del sistema.
    function camara() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return camaraSistema();
        return new Promise(async (resolve) => {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
            } catch (e) {
                if (e && e.name === 'NotAllowedError') alert('Para tomar la foto, permite el acceso a la cámara en tu navegador (ícono del candado junto a la dirección).');
                return resolve(await camaraSistema());
            }
            const v = document.createElement('div');
            v.setAttribute('role', 'dialog');
            v.setAttribute('aria-label', 'Tomar foto de la firma');
            v.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;font:15px Inter,system-ui,sans-serif;color:#fff';
            v.innerHTML = `<p style="margin:0;text-align:center;max-width:420px">Pon la firma dentro del recuadro, con buena luz y sin sombras.</p>
                <div style="position:relative;width:min(92vw,720px);aspect-ratio:4/3;background:#000;border-radius:18px;overflow:hidden">
                    <video playsinline muted autoplay style="width:100%;height:100%;object-fit:cover"></video>
                    <div style="position:absolute;left:8%;right:8%;top:28%;bottom:28%;border:2px dashed rgba(255,193,7,.95);border-radius:12px;box-shadow:0 0 0 999px rgba(0,0,0,.35)"></div>
                </div>
                <div style="display:flex;gap:12px">
                    <button data-cancelar style="min-height:48px;padding:0 22px;border-radius:999px;border:1px solid #555;background:#222;color:#fff;font:700 15px Montserrat,Inter,sans-serif">Cancelar</button>
                    <button data-tomar style="min-height:48px;padding:0 28px;border-radius:999px;border:0;background:#FFC107;color:#1F1F1F;font:700 15px Montserrat,Inter,sans-serif">Tomar foto</button>
                </div>`;
            document.body.appendChild(v);
            const video = v.querySelector('video');
            video.srcObject = stream;
            const fin = (r) => { stream.getTracks().forEach(t => t.stop()); v.remove(); resolve(r); };
            v.querySelector('[data-cancelar]').onclick = () => fin(null);
            v.querySelector('[data-tomar]').onclick = () => {
                const vw = video.videoWidth, vh = video.videoHeight;
                if (!vw) return;
                // lo que se ve en el recuadro: el video se muestra recortado a 4:3 (object-fit: cover)
                const r = 4 / 3;
                let sw = vw, sh = vh, sx = 0, sy = 0;
                if (vw / vh > r) { sw = vh * r; sx = (vw - sw) / 2; } else { sh = vw / r; sy = (vh - sh) / 2; }
                const gx = sx + sw * 0.08, gy = sy + sh * 0.28, gw = sw * 0.84, gh = sh * 0.44;
                const c = document.createElement('canvas');
                c.width = Math.round(gw); c.height = Math.round(gh);
                c.getContext('2d').drawImage(video, gx, gy, gw, gh, 0, 0, c.width, c.height);
                fin(c);
            };
        });
    }

    // Respaldo: cámara del sistema (en el celular abre la cámara directamente)
    function camaraSistema() {
        return new Promise((resolve) => {
            const i = document.createElement('input');
            i.type = 'file'; i.accept = 'image/*'; i.setAttribute('capture', 'environment');
            i.onchange = async () => {
                const f = i.files[0];
                if (!f) return resolve(null);
                try { resolve(await leer(f)); } catch (e) { alert(e.message); resolve(null); }
            };
            i.click();
        });
    }

    window.PascalLimpiaFirma = { limpiar, leer, camara, recortar };
})();
