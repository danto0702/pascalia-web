/* PascalBot: responde dudas sobre el alcance de CuentaFacil. Lo de cada cuenta va a WhatsApp. */
(function () {
  var script = document.currentScript;
  var ENDPOINT = (script && script.dataset.endpoint) || 'https://cuentasbotpanel-production.up.railway.app/api/pascalbot';
  var AVATAR = (script && script.dataset.avatar) || '/pascalbot/avatar.webp';
  var WHATSAPP = 'https://wa.me/573123885012';
  var STORE = 'pascalbot:v1';
  var GREETING = '¡Hola! Soy *PascalBot* 👋. Te cuento qué es CuentaFacil, cómo funciona y cuánto cuesta. ¿Qué quieres saber?';
  var CHIPS = ['¿Qué es CuentaFacil?', '¿Cuánto cuesta?', '¿Cómo empiezo?', '¿Mis datos están seguros?'];

  var history = [];
  try { history = JSON.parse(sessionStorage.getItem(STORE) || '[]'); } catch (e) { history = []; }
  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-20))); } catch (e) { /* sin almacenamiento */ }
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function escape(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Texto seguro: se escapa todo y solo se convierten *negritas* y enlaces.
  function format(s) {
    return escape(s)
      .replace(/\*\*?([^*\n]+)\*\*?/g, '<b>$1</b>')
      .replace(/(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/([\w.+-]+@pascalia\.lat)/g, '<a href="mailto:$1">$1</a>');
  }

  var root = el('div', 'pb');
  root.innerHTML =
    '<span class="pb-tag">¿Dudas? Pregúntale a PascalBot</span>' +
    '<button class="pb-bubble" type="button" aria-label="Abrir PascalBot" aria-expanded="false">' +
    '<img src="' + AVATAR + '" alt=""></button>' +
    '<section class="pb-panel" role="dialog" aria-label="PascalBot">' +
    '<header class="pb-head"><img src="' + AVATAR + '" alt="">' +
    '<div><b>PascalBot</b><small>Información sobre CuentaFacil</small></div>' +
    '<button class="pb-close" type="button" aria-label="Cerrar">×</button></header>' +
    '<div class="pb-log" aria-live="polite"></div>' +
    '<div class="pb-chips"></div>' +
    '<form class="pb-form"><input type="text" maxlength="600" placeholder="Escribe tu pregunta" aria-label="Tu pregunta" autocomplete="off">' +
    '<button type="submit">Enviar</button></form>' +
    '<p class="pb-foot">Solo doy información general. Para tu cuenta, escríbele a Pascal por ' +
    '<a href="' + WHATSAPP + '" target="_blank" rel="noopener">WhatsApp</a>.</p>' +
    '</section>';

  var bubble = root.querySelector('.pb-bubble');
  var log = root.querySelector('.pb-log');
  var chips = root.querySelector('.pb-chips');
  var form = root.querySelector('.pb-form');
  var input = form.querySelector('input');
  var send = form.querySelector('button');
  var busy = false;

  function add(role, text) {
    var m = el('div', 'pb-msg ' + (role === 'user' ? 'pb-user' : 'pb-bot'), format(text));
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }
  function render() {
    log.innerHTML = '';
    add('assistant', GREETING);
    history.forEach(function (t) { add(t.role, t.content); });
    chips.style.display = history.length ? 'none' : '';
  }
  CHIPS.forEach(function (q) {
    var b = el('button', '', escape(q));
    b.type = 'button';
    b.addEventListener('click', function () { ask(q); });
    chips.appendChild(b);
  });

  function ask(text) {
    text = text.trim();
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    chips.style.display = 'none';
    history.push({ role: 'user', content: text });
    save();
    add('user', text);
    var typing = add('assistant', 'Escribiendo…');
    typing.classList.add('pb-typing');
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-10) })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { return d && d.reply; })
      .catch(function () { return null; })
      .then(function (reply) {
        typing.remove();
        reply = reply || 'En este momento no puedo responder. Escríbele a Pascal por WhatsApp: ' + WHATSAPP;
        history.push({ role: 'assistant', content: reply });
        save();
        add('assistant', reply);
        busy = false;
        send.disabled = false;
        input.focus();
      });
  }

  function open(on) {
    root.classList.toggle('pb-open', on);
    bubble.setAttribute('aria-expanded', String(on));
    if (on) { render(); input.focus(); } else bubble.focus();
  }
  bubble.addEventListener('click', function () { open(true); });
  root.querySelector('.pb-close').addEventListener('click', function () { open(false); });
  root.addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = input.value;
    input.value = '';
    ask(t);
  });

  document.body.appendChild(root);
})();
