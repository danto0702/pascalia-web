// MesaViva landing: Pascal's ask bar, the "Arma tu plan" configurator, the demo modal and the page's motion.
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var cop = function (n) { return '$' + Math.round(n).toLocaleString('es-CO'); };

  /* ---------- Plans: same rules as packages/sales/src/plans.ts ---------- */
  var PLANS = {
    esencial: { name: 'Esencial', includes: ['POS y factura electrónica', 'Notas crédito y débito', 'Inventario y código de barras', 'Carta QR'] },
    restaurante: { name: 'Restaurante', includes: ['Todo Esencial', 'Pedidos por WhatsApp', 'Mesas, meseros y comisiones', 'Cocina y recetas'] },
    mesaviva: { name: 'MesaViva', includes: ['Todo Restaurante', 'Mesa NFC colaborativa', 'Pago por persona', 'Domicilios y CRM'] },
    cadena: { name: 'Cadena', includes: ['Todo MesaViva', 'Varias sedes', 'Nómina electrónica', 'Reportes consolidados'] },
  };

  var form = $('[data-config]');
  var mesas = 12;
  var lastPlan = '';

  function value(name) {
    var el = form.querySelector('[name="' + name + '"]:checked');
    return el ? Number(el.value) : 1;
  }
  function state() {
    return {
      mesas: mesas, cajas: value('cajas'), sedes: value('sedes'),
      f: { whatsapp: form.whatsapp.checked, nfc: form.nfc.checked, domicilios: form.domicilios.checked, nomina: form.nomina.checked },
    };
  }
  function pick(s) {
    if (s.sedes > 1) return { id: 'cadena', why: 'Porque tienes varias sedes.' };
    if (s.f.nomina) return { id: 'cadena', why: 'Porque quieres la nómina electrónica.' };
    if (s.f.nfc) return { id: 'mesaviva', why: 'Porque quieres la mesa NFC y el pago por persona.' };
    if (s.f.domicilios) return { id: 'mesaviva', why: 'Porque quieres domicilios con motorizado.' };
    if (s.cajas > 2) return { id: 'mesaviva', why: 'Porque necesitas más de dos cajas.' };
    if (s.f.whatsapp) return { id: 'restaurante', why: 'Porque quieres recibir pedidos por WhatsApp.' };
    if (s.mesas > 0 || s.cajas === 2) return { id: 'restaurante', why: 'Porque atiendes mesas con meseros.' };
    return { id: 'esencial', why: 'Para vender y facturar en mostrador.' };
  }
  function summary(s, r) {
    var wants = [];
    if (s.f.whatsapp) wants.push('pedidos por WhatsApp');
    if (s.f.nfc) wants.push('mesa NFC y pago por persona');
    if (s.f.domicilios) wants.push('domicilios');
    if (s.f.nomina) wants.push('nómina electrónica');
    return 'Quiero cotizar MesaViva, plan ' + PLANS[r.id].name + '. Mesas: ' + s.mesas + '. Cajas: ' + (s.cajas === 4 ? '3 o 4' : s.cajas) +
      '. Sedes: ' + (s.sedes > 1 ? 'varias' : 'una') + '. ' + (wants.length ? 'Me interesa: ' + wants.join(', ') + '.' : '');
  }

  var result = $('[data-result]');
  var quote = $('[data-quote]');
  function render() {
    $('[data-mesas]').textContent = String(mesas);
    var s = state(), r = pick(s), plan = PLANS[r.id];
    $('[data-plan]').textContent = plan.name;
    $('[data-why]').textContent = 'Te lo recomendamos ' + r.why.charAt(0).toLowerCase() + r.why.slice(1);
    $('[data-includes]').innerHTML = plan.includes.map(function (t) { return '<li>' + t + '</li>'; }).join('');
    var kit = $('[data-kit]');
    kit.hidden = !(s.f.nfc && mesas > 0);
    kit.textContent = 'La cotización incluye ' + mesas + (mesas === 1 ? ' chip NFC' : ' chips NFC') + ', uno por mesa.';
    $$('[data-plan-card]').forEach(function (row) { row.classList.toggle('is-picked', row.getAttribute('data-plan-card') === r.id); });
    if (lastPlan && lastPlan !== r.id && !reduce) {
      result.classList.remove('bump'); void result.offsetWidth; result.classList.add('bump');
    }
    lastPlan = r.id;
    quote.dataset.summary = summary(s, r);
    syncForm(false);
    return { s: s, r: r };
  }

  // Keeps the site's contact form in step with the plan while the message still holds our own text.
  function syncForm(focus) {
    var area = $('#contacto textarea[name="mensaje"]');
    if (!area) return false;
    if (!area.dataset.mvReady) {
      area.dataset.mvReady = '1';
      area.placeholder = 'Cuéntanos de tu restaurante: cuántas mesas y cajas tienes y qué quieres resolver.';
    }
    var text = quote.dataset.summary || '';
    if (!area.value.trim() || area.value === area.dataset.mvText) { area.value = text; area.dataset.mvText = text; }
    if (focus) setTimeout(function () { area.focus({ preventScroll: true }); }, 600);
    return true;
  }

  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-step-btn]');
    if (!b) return;
    mesas = Math.max(0, Math.min(200, mesas + Number(b.getAttribute('data-step-btn'))));
    render();
  });
  form.addEventListener('change', render);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  quote.addEventListener('click', function () { syncForm(true); });
  var tries = 0;
  (function waitForm() { if (!syncForm(false) && tries++ < 40) setTimeout(waitForm, 150); })();
  render();

  /* ---------- Pascal's ask bar: reads the message and fills the configurator ---------- */
  var NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, quince: 15, veinte: 20 };
  function norm(t) { return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function countBefore(t, word) {
    var m = t.match(new RegExp('(\\d+|' + Object.keys(NUM).join('|') + ')\\s+(?:\\w+\\s+)?' + word));
    if (!m) return null;
    return /\d/.test(m[1]) ? Number(m[1]) : NUM[m[1]];
  }
  function read(text) {
    var t = norm(text), found = [];
    // Each message describes the business from scratch.
    mesas = 12;
    form.querySelector('[name=cajas][value="1"]').checked = true;
    form.querySelector('[name=sedes][value="1"]').checked = true;
    ['whatsapp', 'nfc', 'domicilios', 'nomina'].forEach(function (k) { form[k].checked = false; });
    var m = countBefore(t, 'mesas?');
    if (m !== null) { mesas = Math.min(200, m); found.push(m + (m === 1 ? ' mesa' : ' mesas')); }
    else if (/mostrador|panaderia|tienda|comercio/.test(t)) { mesas = 0; found.push('venta en mostrador'); }
    var c = countBefore(t, 'cajas?');
    if (c !== null) { form.querySelector('[name=cajas][value="' + (c >= 3 ? 4 : c <= 1 ? 1 : 2) + '"]').checked = true; found.push(c + (c === 1 ? ' caja' : ' cajas')); }
    var sd = countBefore(t, '(?:sedes?|sucursales?|locales)');
    if ((sd !== null && sd > 1) || /varias (sedes|sucursales)/.test(t)) { form.querySelector('[name=sedes][value="2"]').checked = true; found.push('varias sedes'); }
    else if (sd === 1) form.querySelector('[name=sedes][value="1"]').checked = true;
    var flags = [
      ['whatsapp', /whats|wasap|guasap/, 'pedidos por WhatsApp'],
      ['nfc', /nfc|chip|por persona|dividir|divid|cada uno|pague/, 'pago por persona'],
      ['domicilios', /domicilio|motorizado|delivery|a domicilio/, 'domicilios'],
      ['nomina', /nomina/, 'nómina electrónica'],
    ];
    flags.forEach(function (f) { if (f[1].test(t)) { form[f[0]].checked = true; found.push(f[2]); } });
    if (/qr/.test(t) && m === null) found.push('carta QR');
    if (/factura/.test(t)) found.push('factura electrónica');
    if (/inventario|codigo de barras/.test(t)) found.push('inventario');
    return found;
  }

  var ask = $('[data-ask]'), input = $('[data-ask-input]'), reply = $('[data-reply]');
  var flor = '<svg class="flor" aria-hidden="true"><use href="#flor"/></svg>';
  function answer(text) {
    if (!text.trim()) { input.focus(); return; }
    var found = read(text);
    var out = render(), plan = PLANS[out.r.id];
    reply.hidden = false;
    reply.innerHTML = '<span class="reply-av">' + flor + '</span><div class="reply-bubble"><b class="who">Pascal</b><span class="typing" aria-label="Pascal está escribiendo"><i></i><i></i><i></i></span></div>';
    var heard = found.length ? 'Entendí: ' + found.join(', ') + '. ' : 'Te propongo empezar por aquí; ajústalo con tus datos. ';
    setTimeout(function () {
      reply.innerHTML = '<span class="reply-av">' + flor + '</span><div class="reply-bubble"><b class="who">Pascal</b>' +
        '<p>' + heard + 'Te va el plan <span class="plan-name">' + plan.name + '</span>. ' + out.r.why + '</p>' +
        '<a class="btn btn-dark btn-sm" href="#arma">Ver y ajustar mi plan <svg class="i arr" aria-hidden="true"><use href="/iconos.svg#arrow"/></svg></a></div>';
    }, reduce ? 0 : 900);
  }
  ask.addEventListener('submit', function (e) { e.preventDefault(); answer(input.value); });
  input.addEventListener('input', function () { ask.classList.toggle('has-text', !!input.value); });
  $$('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      $$('.chip').forEach(function (c) { c.classList.toggle('is-picked', c === chip); });
      input.value = chip.textContent; ask.classList.add('has-text'); answer(chip.textContent);
    });
  });

  // Placeholder that types itself in a loop.
  var ph = $('[data-ask-ph]');
  var lines = ['Tengo 12 mesas y quiero que dividan la cuenta…', 'Hago domicilios y quiero mi propio motorizado…', 'Vendo en mostrador y necesito facturar…'];
  if (reduce) ph.textContent = 'Cuéntale a Pascal de tu negocio…';
  else (function type(li, ci, back) {
    var l = lines[li];
    ph.textContent = l.slice(0, ci);
    if (!back && ci < l.length) return setTimeout(type, 38, li, ci + 1, false);
    if (!back) return setTimeout(type, 1800, li, ci, true);
    if (ci > 0) return setTimeout(type, 16, li, ci - 1, true);
    setTimeout(type, 300, (li + 1) % lines.length, 0, false);
  })(0, 0, false);

  // Tabs with a sliding indicator.
  var tabs = $$('[role=tab]'), ink = $('[data-tab-ink]');
  function moveInk(tab) { ink.style.width = tab.offsetWidth + 'px'; ink.style.transform = 'translateX(' + (tab.offsetLeft - 4) + 'px)'; ink.style.left = '4px'; }
  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab, panel = document.getElementById(t.getAttribute('aria-controls'));
      t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; panel.hidden = !on;
      if (on) { panel.classList.remove('in'); void panel.offsetWidth; panel.classList.add('in'); }
    });
    moveInk(tab);
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(t); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });
  var selected = function () { return tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0]; };
  requestAnimationFrame(function () { moveInk(selected()); });
  window.addEventListener('resize', function () { moveInk(selected()); });
  if (document.fonts) document.fonts.ready.then(function () { moveInk(selected()); });

  /* ---------- Headline words and markers ---------- */
  var h1 = $('[data-words]');
  (function split(node) {
    [].slice.call(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (w) {
          if (!w) return;
          if (/^\s+$/.test(w)) return frag.appendChild(document.createTextNode(w));
          var s = document.createElement('span'); s.className = 'w'; s.textContent = w; frag.appendChild(s);
        });
        n.replaceWith(frag);
      } else split(n);
    });
  })(h1);
  $$('.w', h1).forEach(function (w, i) { w.style.setProperty('--i', i); });
  requestAnimationFrame(function () { h1.classList.add('go'); });
  setTimeout(function () { $('.mark', h1).classList.add('on'); }, reduce ? 0 : 900);

  /* ---------- Reveal once in view ---------- */
  function countUp(el) {
    var to = Number(el.getAttribute('data-count')), pre = el.getAttribute('data-pre') || '', post = el.getAttribute('data-post') || '';
    var fmt = function (v) { return pre === '$' || !pre ? (pre === '$' ? cop(v) : Math.round(v).toLocaleString('es-CO')) + post : pre + v + post; };
    if (el.closest('.split')) fmt = function (v) { return cop(v); };
    if (reduce || to === 0) { el.textContent = fmt(to); return; }
    var t0 = performance.now(), dur = 1200;
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(to * e);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  $$('.order li').forEach(function (li, i) { li.style.setProperty('--i', i); });
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      el.classList.add('in');
      $$('.mark', el).forEach(function (m) { m.classList.add('on'); });
      $$('[data-count]', el).forEach(countUp);
      if (el.querySelector('[data-beat=approve]')) playApprove(el.querySelector('[data-beat=approve]'));
      seen.unobserve(el);
    });
  }, { threshold: .3, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal, .head, .facts, .values, .plan, .method-left').forEach(function (el) { seen.observe(el); });

  function playApprove(win) {
    var cur = $('.cursor', win), go = $('.approve-go', win), note = $('.approve-note', win);
    if (reduce) { go.classList.add('done'); note.classList.add('show'); return; }
    setTimeout(function () {
      var w = win.getBoundingClientRect(), b = go.getBoundingClientRect();
      cur.style.opacity = 1;
      cur.style.left = (b.left - w.left + b.width * .55) + 'px';
      cur.style.top = (b.top - w.top + b.height * .45) + 'px';
      setTimeout(function () { go.classList.add('press'); }, 1150);
      setTimeout(function () { go.classList.remove('press'); go.classList.add('done'); note.classList.add('show'); }, 1350);
      setTimeout(function () { cur.style.opacity = 0; }, 2300);
    }, 700);
  }

  /* ---------- Method steps: the active step follows the scroll ---------- */
  var steps = $$('[data-steps] li'), panels = $$('[data-panel]'), mbar = $('[data-method-bar]');
  var stepSeen = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var i = Number(en.target.getAttribute('data-step'));
      steps.forEach(function (s, j) { s.classList.toggle('is-on', j === i); });
      panels.forEach(function (p, j) { p.classList.toggle('is-on', j === i); });
      mbar.style.width = ((i + 1) / steps.length * 100) + '%';
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach(function (s) { stepSeen.observe(s); });

  /* ---------- Scroll: nav, progress, stage scale, parallax, back to top ---------- */
  var nav = $('[data-nav]'), bar = $('[data-progress]'), stage = $('[data-stage]'), top = $('[data-top]');
  var para = $$('[data-parallax]'), petals = $$('.petal');
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY, h = document.documentElement.scrollHeight - innerHeight;
    y > 24 ? nav.setAttribute('data-scrolled', '') : nav.removeAttribute('data-scrolled');
    bar.style.transform = 'scaleX(' + (h > 0 ? y / h : 0) + ')';
    top.classList.toggle('show', y > 600);
    if (reduce) return;
    var r = stage.getBoundingClientRect();
    var p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * .7)));
    stage.style.setProperty('--s', (.92 + .08 * p).toFixed(4));
    para.forEach(function (el) {
      var k = Number(el.getAttribute('data-parallax')), b = el.parentElement.getBoundingClientRect();
      var c = (b.top + b.height / 2 - innerHeight / 2) / innerHeight;
      el.style.translate = '0 ' + (c * k).toFixed(1) + 'px';
    });
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });

  // The desktop stage loads the real demo once it is near the viewport; phones open it in the modal.
  var frame = $('[data-stage-frame]');
  var nearStage = new IntersectionObserver(function (en) {
    if (!en[0].isIntersecting) return;
    if (innerWidth > 520) frame.src = frame.getAttribute('data-src');
    nearStage.disconnect();
  }, { rootMargin: '300px' });
  nearStage.observe(stage);

  /* ---------- Pointer: petals parallax, spotlight, tilt, magnetic button ---------- */
  if (fine && !reduce) {
    window.addEventListener('pointermove', function (e) {
      var cx = e.clientX / innerWidth - .5, cy = e.clientY / innerHeight - .5;
      petals.forEach(function (p, i) {
        var k = (i % 3 + 1) * 14;
        p.style.setProperty('--px', (cx * k).toFixed(1) + 'px'); p.style.setProperty('--py', (cy * k).toFixed(1) + 'px');
      });
    }, { passive: true });
    $$('.spot').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var b = el.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
        el.style.setProperty('--mx', x * 100 + '%'); el.style.setProperty('--my', y * 100 + '%');
        if (el.classList.contains('tilt')) { el.style.setProperty('--ry', ((x - .5) * 8).toFixed(2) + 'deg'); el.style.setProperty('--rx', ((.5 - y) * 8).toFixed(2) + 'deg'); }
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
    $$('.magnet').forEach(function (btn) {
      var zone = btn.parentElement;
      zone.addEventListener('pointermove', function (e) {
        var b = btn.getBoundingClientRect(), dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
        var d = Math.hypot(dx, dy), reach = Math.max(b.width, b.height) / 2 + 80;
        btn.style.translate = d < reach ? (dx * .18).toFixed(1) + 'px ' + (dy * .3).toFixed(1) + 'px' : '0 0';
      });
      zone.addEventListener('pointerleave', function () { btn.style.translate = '0 0'; });
    });
  }

  /* ---------- Mobile menu ---------- */
  var menuBtn = $('[data-menu-btn]'), menu = $('#menu');
  function openMenu(on) {
    menu.classList.toggle('is-open', on); menuBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    document.body.style.overflow = on ? 'hidden' : '';
  }
  menuBtn.addEventListener('click', function () { openMenu(!menu.classList.contains('is-open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) openMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('is-open')) { openMenu(false); menuBtn.focus(); } });

  /* ---------- FAQ: smooth height ---------- */
  $$('[data-faq] details').forEach(function (d) {
    var sum = $('summary', d), body = $('.faq-a', d);
    sum.addEventListener('click', function (e) {
      if (reduce) return;
      e.preventDefault();
      if (d.open) {
        body.style.height = body.scrollHeight + 'px';
        requestAnimationFrame(function () { body.style.height = '0px'; });
        setTimeout(function () { d.open = false; body.style.height = ''; }, 300);
      } else {
        d.open = true;
        var h = body.scrollHeight; body.style.height = '0px';
        requestAnimationFrame(function () { body.style.height = h + 'px'; });
        setTimeout(function () { body.style.height = ''; }, 300);
      }
    });
  });

  /* ---------- Demo modal ---------- */
  var modal = $('[data-demo-modal]'), mframe = $('[data-modal-frame]');
  $$('[data-demo-open]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!mframe.getAttribute('src')) mframe.src = '/mesaviva/demo/';
      if (modal.showModal) modal.showModal(); else window.open('/mesaviva/demo/', '_blank');
    });
  });
  $('[data-demo-close]').addEventListener('click', function () { modal.close(); });
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });
})();
