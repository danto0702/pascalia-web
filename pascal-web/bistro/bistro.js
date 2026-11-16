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

  /* Movimiento adicional */
  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cab = $('[data-cab]'), hero = $('.hero'), luz = $('[data-luz]');

  // Letras de la marca, una por una
  var marca = $('.logo-hero span');
  if (marca) {
    var letras = marca.textContent; marca.textContent = ''; marca.setAttribute('aria-label', letras);
    letras.split('').forEach(function (c, i) {
      var l = doc.createElement('span'); l.className = 'l'; l.setAttribute('aria-hidden', 'true');
      l.style.setProperty('--i', i); l.textContent = c === ' ' ? ' ' : c; marca.appendChild(l);
    });
  }
  ['.hero .redes li', '.lista li', '.anios li', '.sellos li', '.caras li', '.platos li', '.tiempos li', '.notas .trazos ellipse', '.notas .rotulos text'].forEach(function (sel) {
    var grupos = {};
    $$(sel).forEach(function (el) {
      var k = sel + '|' + $$('*').indexOf(el.parentNode);
      grupos[k] = (grupos[k] || 0); el.style.setProperty('--i', grupos[k]++);
    });
  });

  // Avance de lectura, cabecera que se esconde al bajar y fotos con profundidad
  var pars = $$('[data-par]'), ultimoY = 0, pedido = false;
  function alDesplazar() {
    pedido = false;
    var y = window.scrollY, alto = doc.documentElement.scrollHeight - innerHeight;
    cab.style.setProperty('--avance', alto > 0 ? (y / alto).toFixed(4) : 0);
    cab.classList.toggle('oculta', y > ultimoY && y > 500 && menu.hidden);
    ultimoY = y;
    if (quieto) return;
    pars.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > innerHeight + 100) return;
      var centro = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      var fuerza = el.getAttribute('data-par') === 'hero' ? y * 0.28 : centro * -34;
      (el.getAttribute('data-par') === 'hero' ? $('img', el) : $('img', el)).style.setProperty('--y', fuerza.toFixed(1));
    });
  }
  window.addEventListener('scroll', function () { if (!pedido) { pedido = true; requestAnimationFrame(alDesplazar); } }, { passive: true });
  alDesplazar();

  // Luz cálida que sigue el puntero en la portada
  if (luz && !quieto) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      luz.style.setProperty('--lx', (e.clientX - r.left) + 'px');
      luz.style.setProperty('--ly', (e.clientY - r.top) + 'px');
    });
  }

  // Cinta de palabras: solo corre cuando se ve
  var cinta = $('[data-cinta]');
  if (cinta && 'IntersectionObserver' in window && !quieto) {
    new IntersectionObserver(function (es) { cinta.classList.toggle('anda', es[0].isIntersecting); }).observe(cinta);
  }

  // Carruseles: avance automático con indicador; se detiene al tocarlos
  $$('[data-carrusel]').forEach(function (c) {
    var pista = $('.pista', c), n = pista.children.length, i = 0, reloj = null, visible = false, pausa = false;
    var puntos = doc.createElement('div'); puntos.className = 'puntos'; puntos.setAttribute('aria-hidden', 'true');
    for (var k = 0; k < n; k++) puntos.appendChild(doc.createElement('i'));
    c.appendChild(puntos);
    function marcar() {
      i = Math.round(pista.scrollLeft / Math.max(1, pista.clientWidth));
      $$('i', puntos).forEach(function (p, k) { p.classList.remove('activo'); if (k === i) { void p.offsetWidth; if (visible && !pausa && !quieto) p.classList.add('activo'); else p.style.background = ''; } });
      $$('i', puntos).forEach(function (p, k) { p.style.background = (k === i && (pausa || quieto || !visible)) ? 'var(--am)' : ''; });
    }
    function programar() {
      clearTimeout(reloj); marcar();
      if (!visible || pausa || quieto) return;
      reloj = setTimeout(function () {
        var sig = (i + 1) % n;
        pista.scrollTo({ left: sig * pista.clientWidth, behavior: 'smooth' });
      }, 5000);
    }
    var espera;
    pista.addEventListener('scroll', function () { clearTimeout(espera); espera = setTimeout(programar, 160); }, { passive: true });
    ['pointerenter', 'focusin', 'touchstart'].forEach(function (ev) { c.addEventListener(ev, function () { pausa = true; programar(); }, { passive: true }); });
    ['pointerleave', 'focusout'].forEach(function (ev) { c.addEventListener(ev, function () { pausa = false; programar(); }); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; programar(); }, { threshold: 0.5 }).observe(c);
    }
  });

  // El número de personas salta al cambiar
  ['[data-menos]', '[data-mas]'].forEach(function (sel) {
    $(sel).addEventListener('click', function () { salida.classList.remove('salta'); void salida.offsetWidth; salida.classList.add('salta'); });
  });
})();
