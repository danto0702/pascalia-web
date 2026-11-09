// Tutorial interactivo de la primera vez (PascalPDF y Pascal Sign): resalta cada parte de la pantalla
// con una explicación corta. Se puede saltar, navegar con el teclado y volver a ver desde «Mi cuenta».
(function () {
    'use strict';
    const css = `
    .tt-velo{position:fixed;inset:0;z-index:9990;pointer-events:auto}
    .tt-foco{position:fixed;border-radius:14px;box-shadow:0 0 0 9999px rgba(20,20,20,.72);outline:3px solid #FFC107;outline-offset:3px;transition:all .28s cubic-bezier(.16,1,.3,1);pointer-events:none;z-index:9991}
    .tt-foco.tt-sin{width:0!important;height:0!important;left:50%!important;top:45%!important;outline:none}
    .tt-tarjeta{position:fixed;z-index:9992;background:#fff;color:#1F1F1F;border-radius:20px;padding:18px 18px 14px;width:min(340px,calc(100vw - 32px));box-shadow:0 18px 50px rgba(0,0,0,.35);font:15px/1.5 Inter,system-ui,sans-serif;transition:top .28s cubic-bezier(.16,1,.3,1),left .28s cubic-bezier(.16,1,.3,1)}
    .tt-tarjeta h3{font:800 17px/1.25 Montserrat,Inter,sans-serif;margin:0 0 6px}
    .tt-tarjeta p{margin:0;color:#3D3D3D;font-size:14px}
    .tt-pie{display:flex;align-items:center;gap:8px;margin-top:14px}
    .tt-puntos{display:flex;gap:5px;flex:1}
    .tt-puntos i{width:7px;height:7px;border-radius:99px;background:#E2E2E2;display:block}
    .tt-puntos i.on{background:#FFB300;width:18px}
    .tt-btn{border:0;border-radius:999px;padding:10px 16px;font:700 14px Montserrat,Inter,sans-serif;cursor:pointer;background:#FFC107;color:#1F1F1F;min-height:42px}
    .tt-btn.sec{background:#fff;box-shadow:inset 0 0 0 1px #E2E2E2}
    .tt-saltar{position:absolute;top:10px;right:12px;border:0;background:none;color:#5C5C5C;font:600 13px Inter,sans-serif;cursor:pointer;padding:6px;text-decoration:underline;text-underline-offset:3px}
    .tt-btn:focus-visible,.tt-saltar:focus-visible{outline:3px solid #8A6100;outline-offset:2px}
    @media(prefers-reduced-motion:reduce){.tt-foco,.tt-tarjeta{transition:none}}`;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const guardar = (k) => { try { localStorage.setItem(k, new Date().toISOString()); } catch (e) { /* sin almacenamiento */ } };
    const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // Primer elemento visible para el paso (acepta varios selectores o una función)
    function objetivo(p) {
        if (typeof p.el === 'function') return p.el();
        for (const sel of [].concat(p.el || [])) {
            for (const el of document.querySelectorAll(sel)) {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
            }
        }
        return null;
    }

    let activo = null;
    function iniciar(clave, pasos, opciones = {}) {
        if (activo) return;
        if (!opciones.forzar && leer(clave)) return;
        let i = 0;
        const velo = document.createElement('div');
        velo.className = 'tt-velo';
        const foco = document.createElement('div');
        foco.className = 'tt-foco';
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tt-tarjeta';
        tarjeta.setAttribute('role', 'dialog');
        tarjeta.setAttribute('aria-modal', 'true');
        tarjeta.setAttribute('aria-live', 'polite');
        document.body.append(velo, foco, tarjeta);
        const previo = document.activeElement;

        function terminar() {
            guardar(clave);
            velo.remove(); foco.remove(); tarjeta.remove();
            document.removeEventListener('keydown', teclas, true);
            window.removeEventListener('resize', ubicar);
            activo = null;
            if (previo && previo.focus) try { previo.focus(); } catch (e) { /* nada */ }
            if (opciones.alTerminar) opciones.alTerminar();
        }
        function teclas(e) {
            if (e.key === 'Escape') { e.preventDefault(); terminar(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); ir(i + 1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1); }
        }
        function ubicar() {
            const p = pasos[i];
            const el = objetivo(p);
            const m = 8, vw = innerWidth, vh = innerHeight;
            const tw = tarjeta.offsetWidth, th = tarjeta.offsetHeight;
            if (!el) {
                foco.classList.add('tt-sin');
                tarjeta.style.left = Math.max(16, (vw - tw) / 2) + 'px';
                tarjeta.style.top = Math.max(16, (vh - th) / 2) + 'px';
                return;
            }
            foco.classList.remove('tt-sin');
            el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            const r = el.getBoundingClientRect();
            Object.assign(foco.style, { left: r.left - m / 2 + 'px', top: r.top - m / 2 + 'px', width: r.width + m + 'px', height: r.height + m + 'px' });
            // La tarjeta va debajo del elemento; si no cabe, encima; si tampoco, centrada
            let top = r.bottom + 16;
            if (top + th > vh - 12) top = r.top - th - 16;
            if (top < 12) top = Math.max(12, (vh - th) / 2);
            let left = r.left + r.width / 2 - tw / 2;
            left = Math.min(vw - tw - 16, Math.max(16, left));
            tarjeta.style.left = left + 'px';
            tarjeta.style.top = top + 'px';
        }
        function ir(n) {
            if (n < 0) return;
            if (n >= pasos.length) return terminar();
            i = n;
            const p = pasos[i];
            if (p.antes) try { p.antes(); } catch (e) { /* paso opcional */ }
            tarjeta.innerHTML = `<button class="tt-saltar" data-saltar>Saltar</button>
                <h3 id="tt-t">${esc(p.titulo)}</h3><p>${esc(p.texto)}</p>
                <div class="tt-pie"><div class="tt-puntos" aria-label="Paso ${i + 1} de ${pasos.length}">${pasos.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
                ${i > 0 ? '<button class="tt-btn sec" data-ant>Atrás</button>' : ''}
                <button class="tt-btn" data-sig>${i === pasos.length - 1 ? 'Empezar' : 'Siguiente'}</button></div>`;
            tarjeta.setAttribute('aria-labelledby', 'tt-t');
            tarjeta.querySelector('[data-saltar]').onclick = terminar;
            tarjeta.querySelector('[data-sig]').onclick = () => ir(i + 1);
            const ant = tarjeta.querySelector('[data-ant]');
            if (ant) ant.onclick = () => ir(i - 1);
            requestAnimationFrame(() => { ubicar(); tarjeta.querySelector('[data-sig]').focus(); });
        }
        velo.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('keydown', teclas, true);
        window.addEventListener('resize', ubicar);
        activo = { terminar };
        ir(0);
    }

    window.PascalTutorial = { iniciar, visto: (clave) => !!leer(clave) };
})();
