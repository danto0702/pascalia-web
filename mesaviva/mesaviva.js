// MesaViva landing: "Arma tu plan" configurator. Recommends a plan and pre-fills the contact form.
(function () {
  var form = document.querySelector('[data-config]');
  if (!form) return;

  var PLANS = {
    esencial: { name: 'Esencial', includes: ['POS y factura electrónica', 'Notas crédito y débito', 'Inventario y código de barras', 'Carta QR'] },
    restaurante: { name: 'Restaurante', includes: ['Todo Esencial', 'Pedidos por WhatsApp', 'Mesas, meseros y comisiones', 'Cocina y recetas'] },
    mesaviva: { name: 'MesaViva', includes: ['Todo Restaurante', 'Mesa NFC colaborativa', 'Pago por persona', 'Domicilios y CRM'] },
    cadena: { name: 'Cadena', includes: ['Todo MesaViva', 'Varias sedes', 'Nómina electrónica', 'Reportes consolidados'] },
  };

  var mesas = 12;
  var out = form.querySelector('[data-mesas]');
  var planEl = form.querySelector('[data-plan]');
  var whyEl = form.querySelector('[data-why]');
  var incEl = form.querySelector('[data-includes]');
  var kitEl = form.querySelector('[data-kit]');
  var quote = form.querySelector('[data-quote]');
  var srEl = form.querySelector('[data-plan-sr]');
  var bar = form.querySelector('[data-bar]');
  var previous = '';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function value(name) {
    var el = form.querySelector('[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  function pick() {
    var cajas = Number(value('cajas'));
    var sedes = Number(value('sedes'));
    var f = {
      whatsapp: form.whatsapp.checked,
      nfc: form.nfc.checked,
      domicilios: form.domicilios.checked,
      nomina: form.nomina.checked,
    };
    if (sedes > 1) return { id: 'cadena', why: 'Porque tienes varias sedes.', f: f, cajas: cajas, sedes: sedes };
    if (f.nomina) return { id: 'cadena', why: 'Porque quieres la nómina electrónica.', f: f, cajas: cajas, sedes: sedes };
    if (f.nfc) return { id: 'mesaviva', why: 'Porque quieres la mesa NFC y el pago por persona.', f: f, cajas: cajas, sedes: sedes };
    if (f.domicilios) return { id: 'mesaviva', why: 'Porque quieres domicilios con motorizado.', f: f, cajas: cajas, sedes: sedes };
    if (cajas > 2) return { id: 'mesaviva', why: 'Porque necesitas más de dos cajas.', f: f, cajas: cajas, sedes: sedes };
    if (f.whatsapp) return { id: 'restaurante', why: 'Porque quieres recibir pedidos por WhatsApp.', f: f, cajas: cajas, sedes: sedes };
    if (mesas > 0 || cajas === 2) return { id: 'restaurante', why: 'Porque atiendes mesas con meseros.', f: f, cajas: cajas, sedes: sedes };
    return { id: 'esencial', why: 'Para vender y facturar en mostrador.', f: f, cajas: cajas, sedes: sedes };
  }

  function flaps(text) {
    var chars = text.toUpperCase().split('');
    var prev = previous.toUpperCase();
    var n = 0;
    previous = text;
    return chars
      .map(function (ch, i) {
        var changed = !reduce && prev.charAt(i) !== ch;
        return '<span class="ch' + (changed ? ' flip" style="--i:' + n++ : '') + '">' + ch + '</span>';
      })
      .join('');
  }

  function summary(r) {
    var wants = [];
    if (r.f.whatsapp) wants.push('pedidos por WhatsApp');
    if (r.f.nfc) wants.push('mesa NFC y pago por persona');
    if (r.f.domicilios) wants.push('domicilios');
    if (r.f.nomina) wants.push('nómina electrónica');
    return (
      'Quiero cotizar MesaViva, plan ' + PLANS[r.id].name + '. ' +
      'Mesas: ' + mesas + '. Cajas: ' + (r.cajas === 4 ? '3 o 4' : r.cajas) + '. Sedes: ' + (r.sedes > 1 ? 'varias' : 'una') + '. ' +
      (wants.length ? 'Me interesa: ' + wants.join(', ') + '.' : '')
    );
  }

  function render() {
    out.textContent = String(mesas);
    var r = pick();
    var plan = PLANS[r.id];
    planEl.innerHTML = flaps(plan.name);
    srEl.textContent = plan.name;
    if (bar && !reduce) {
      bar.classList.remove('sweep');
      void bar.offsetWidth;
      bar.classList.add('sweep');
    }
    whyEl.textContent = r.why;
    incEl.innerHTML = plan.includes.map(function (t) { return '<li>' + t + '</li>'; }).join('');
    if (r.f.nfc && mesas > 0) {
      kitEl.hidden = false;
      kitEl.textContent = 'Incluye en la cotización ' + mesas + (mesas === 1 ? ' chip NFC' : ' chips NFC') + ', uno por mesa.';
    } else kitEl.hidden = true;
    document.querySelectorAll('[data-plan-card]').forEach(function (card) {
      card.classList.toggle('is-picked', card.getAttribute('data-plan-card') === r.id);
    });
    quote.dataset.summary = summary(r);
    syncForm(false);
  }

  // Keeps the site's contact form in step with the plan: fills an empty message, and keeps
  // updating it while it still holds our own text.
  function syncForm(focus) {
    var area = document.querySelector('#contacto textarea[name="mensaje"]');
    if (!area) return false;
    if (!area.dataset.mvReady) {
      area.dataset.mvReady = '1';
      area.placeholder = 'Cuéntanos de tu restaurante: cuántas mesas y cajas tienes y qué quieres resolver.';
    }
    var text = quote.dataset.summary || '';
    if (!area.value.trim() || area.value === area.dataset.mvText) {
      area.value = text;
      area.dataset.mvText = text;
    }
    if (focus) setTimeout(function () { area.focus({ preventScroll: true }); }, 500);
    return true;
  }

  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-step]');
    if (!b) return;
    mesas = Math.max(0, Math.min(200, mesas + Number(b.getAttribute('data-step'))));
    render();
  });
  form.addEventListener('change', render);
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  // Pre-fill the site's contact form with the plan the visitor built.
  quote.addEventListener('click', function () { syncForm(true); });
  // The form is mounted by contacto.js after load; fill it as soon as it exists.
  var tries = 0;
  (function waitForm() {
    if (!syncForm(false) && tries++ < 40) setTimeout(waitForm, 150);
  })();

  render();
})();
