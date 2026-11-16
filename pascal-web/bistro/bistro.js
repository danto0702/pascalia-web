/* La Niebla · sitio de demostración de Pascal Web. Nada sale del navegador. */
(function () {
  var doc = document, body = doc.body;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  doc.documentElement.classList.add('js');

  /* Carga */
  var listo = false;
  function terminarCarga() { if (listo) return; listo = true; body.classList.remove('cargando'); }
  window.addEventListener('load', function () { setTimeout(terminarCarga, 900); });
  setTimeout(terminarCarga, 3200);

  /* Idioma */
  var idioma = 'es';
  var MESES = { es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };
  var DIAS = { es: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] };
  $$('[data-en]').forEach(function (el) { el.setAttribute('data-es', el.innerHTML); });
  function ponerIdioma(l) {
    idioma = l;
    doc.documentElement.lang = l === 'en' ? 'en' : 'es-CO';
    $$('[data-en]').forEach(function (el) { el.innerHTML = el.getAttribute('data-' + l); });
    $$('[data-idioma]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-idioma') === l)); });
    $$('.dias-nom span').forEach(function (s, i) { s.textContent = DIAS[l][i]; });
    pintarMes(); pintarPaso();
  }
  $$('[data-idioma]').forEach(function (b) { b.addEventListener('click', function () { ponerIdioma(b.getAttribute('data-idioma')); }); });

  /* Menú */
  var menu = $('[data-menu]'), hamb = $('[data-menu-btn]');
  $$('li', menu).forEach(function (li, i) { li.style.setProperty('--i', i); });
  function abrirMenu(si) {
    menu.hidden = !si; hamb.setAttribute('aria-expanded', String(si));
    body.classList.toggle('fijo', si);
  }
  hamb.addEventListener('click', function () { abrirMenu(menu.hidden); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) abrirMenu(false); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { abrirMenu(false); hamb.focus(); } });

  /* Aparición al bajar */
  var vistos = $$('[data-ver]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    vistos.forEach(function (el) { io.observe(el); });
  } else { vistos.forEach(function (el) { el.classList.add('visto'); }); }

  /* Carruseles */
  $$('[data-carrusel]').forEach(function (c) {
    var pista = $('.pista', c), ant = $('[data-ant]', c), sig = $('[data-sig]', c);
    function estado() {
      ant.disabled = pista.scrollLeft < 8;
      sig.disabled = pista.scrollLeft > pista.scrollWidth - pista.clientWidth - 8;
    }
    function mover(d) { pista.scrollBy({ left: d * pista.clientWidth, behavior: 'smooth' }); }
    ant.addEventListener('click', function () { mover(-1); });
    sig.addEventListener('click', function () { mover(1); });
    pista.addEventListener('scroll', estado, { passive: true });
    window.addEventListener('resize', estado);
    estado();
  });

  /* Capas: reserva y carta */
  function abrirCapa(nombre) {
    $$('dialog[open]').forEach(function (d) { d.close(); });
    var d = $('[data-capa="' + nombre + '"]');
    if (!d) return;
    abrirMenu(false);
    if (nombre === 'reserva') { paso = 1; pintarPaso(); }
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('[data-abrir]');
    if (a) { e.preventDefault(); abrirCapa(a.getAttribute('data-abrir')); return; }
    var x = e.target.closest('[data-cerrar]');
    if (x) x.closest('dialog').close();
  });

  /* Carta */
  $$('[data-carta]').forEach(function (b) {
    b.addEventListener('click', function () {
      var cual = b.getAttribute('data-carta');
      $$('[data-carta]').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      $$('[data-hoja]').forEach(function (h) { h.hidden = h.getAttribute('data-hoja') !== cual; });
    });
  });

  /* Reserva */
  var paso = 1, personas = 2, fecha = null, hora = null;
  var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  var mesVisto = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  var salida = $('[data-personas]'), cajaDias = $('[data-dias]'), cajaHoras = $('[data-horas]');
  var continuar = $('[data-continuar]'), atras = $('[data-atras]');
  var T = {
    es: { seguir: 'Continuar', listo: 'Entendido', persona: ' persona', personas: ' personas', a: ' a las ', mesa: 'Mesa para ' },
    en: { seguir: 'Continue', listo: 'Got it', persona: ' guest', personas: ' guests', a: ' at ', mesa: 'Table for ' }
  };
  $('[data-menos]').addEventListener('click', function () { personas = Math.max(1, personas - 1); salida.textContent = personas; });
  $('[data-mas]').addEventListener('click', function () { personas = Math.min(12, personas + 1); salida.textContent = personas; });

  function pintarMes() {
    if (!cajaDias) return;
    var a = mesVisto.getFullYear(), m = mesVisto.getMonth();
    $('[data-mes]').textContent = MESES[idioma][m] + ' ' + a;
    $('[data-mes-ant]').disabled = a === hoy.getFullYear() && m === hoy.getMonth();
    var inicio = new Date(a, m, 1); inicio.setDate(1 - ((inicio.getDay() + 6) % 7));
    cajaDias.textContent = '';
    for (var i = 0; i < 42; i++) {
      var d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      var b = doc.createElement('button');
      b.type = 'button'; b.textContent = d.getDate(); b.disabled = d < hoy;
      b.setAttribute('aria-label', d.getDate() + ' ' + MESES[idioma][d.getMonth()]);
      b.setAttribute('aria-pressed', String(!!fecha && +d === +fecha));
      b.setAttribute('data-dia', d.getTime());
      cajaDias.appendChild(b);
    }
  }
  cajaDias.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    fecha = new Date(+b.getAttribute('data-dia')); pintarMes(); pintarPaso();
  });
  $('[data-mes-ant]').addEventListener('click', function () { mesVisto.setMonth(mesVisto.getMonth() - 1); pintarMes(); });
  $('[data-mes-sig]').addEventListener('click', function () { mesVisto.setMonth(mesVisto.getMonth() + 1); pintarMes(); });

  ['12:30', '1:00', '1:30', '2:00', '7:00', '7:30', '8:00', '8:30', '9:00'].forEach(function (h) {
    var b = doc.createElement('button');
    b.type = 'button'; b.textContent = h + ' pm'; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () {
      hora = b.textContent;
      $$('button', cajaHoras).forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      pintarPaso();
    });
    cajaHoras.appendChild(b);
  });

  function pintarPaso() {
    if (!continuar) return;
    $$('[data-paso]').forEach(function (p) { p.hidden = +p.getAttribute('data-paso') !== paso; });
    $('[data-avance]').style.width = (paso * 25) + '%';
    $('.avance').setAttribute('aria-valuenow', paso);
    atras.hidden = paso === 1;
    continuar.textContent = T[idioma][paso === 4 ? 'listo' : 'seguir'];
    continuar.disabled = (paso === 2 && !fecha) || (paso === 3 && !hora);
    continuar.style.opacity = continuar.disabled ? '.55' : '';
    if (paso === 4 && fecha) {
      $('[data-resumen]').textContent = T[idioma].mesa + personas + T[idioma][personas === 1 ? 'persona' : 'personas'] + ', ' +
        fecha.getDate() + ' ' + MESES[idioma][fecha.getMonth()] + T[idioma].a + hora + '.';
    }
  }
  continuar.addEventListener('click', function () {
    if (paso === 4) { $('#reserva').close(); return; }
    paso++; pintarPaso();
  });
  atras.addEventListener('click', function () { paso = Math.max(1, paso - 1); pintarPaso(); });

  pintarMes(); pintarPaso();
})();
