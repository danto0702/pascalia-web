/* Pascal Web · lógica común de los sitios de demostración (negocios ficticios).
   Carta con pedido desde la mesa (QR), cuenta dividida, pago simulado, reservas y citas.
   Nada sale del navegador: es una demostración. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var cop = function (n) { return "$" + Math.round(n).toLocaleString("es-CO"); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var aviso = $("[data-aviso]");
  function avisar(t) { if (!aviso) return; (document.querySelector("dialog[open]") || document.body).appendChild(aviso); aviso.textContent = t; aviso.hidden = false; clearTimeout(avisar.t); avisar.t = setTimeout(function () { aviso.hidden = true; }, 3600); }

  /* ---------- Mesa (QR) ---------- */
  var mesa = (new URLSearchParams(location.search).get("mesa") || "").replace(/[^0-9A-Za-z]/g, "").slice(0, 4);
  $$("[data-mesa]").forEach(function (el) { el.textContent = mesa ? "Mesa " + mesa : "Pide desde tu mesa"; });
  $$("[data-qr-link]").forEach(function (a) { a.href = location.pathname + "?mesa=" + (a.getAttribute("data-qr-link") || "4") + "#carta"; });

  /* ---------- Carta ---------- */
  var datos = $("#carta-datos"), cont = $("[data-carta]");
  var pedido = {};
  if (datos && cont) {
    var carta = JSON.parse(datos.textContent);
    var tabs = $("[data-carta-tabs]");
    carta.forEach(function (cat, i) {
      if (tabs) tabs.insertAdjacentHTML("beforeend", '<button type="button" aria-pressed="' + (i === 0) + '" data-tab="' + i + '">' + esc(cat.nombre) + "</button>");
      cont.insertAdjacentHTML("beforeend", '<div class="carta-cat" data-panel="' + i + '"' + (i ? " hidden" : "") + "><ul>" + cat.platos.map(function (p, j) {
        var id = i + "-" + j;
        return '<li class="plato"><div class="plato-tx"><h3>' + esc(p.n) + "</h3>" + (p.d ? "<p>" + esc(p.d) + "</p>" : "") + '</div><div class="plato-ac"><span class="precio">' + cop(p.p) +
          '</span><button type="button" class="mas" data-add="' + id + '" aria-label="Agregar ' + esc(p.n) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div></li>';
      }).join("") + "</ul></div>");
    });
    var buscar = function (id) { var k = id.split("-"); return carta[+k[0]].platos[+k[1]]; };
    if (tabs) tabs.addEventListener("click", function (e) {
      var b = e.target.closest("[data-tab]"); if (!b) return;
      $$("[data-tab]", tabs).forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      $$("[data-panel]", cont).forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== b.getAttribute("data-tab"); });
    });
    cont.addEventListener("click", function (e) {
      var b = e.target.closest("[data-add]"); if (!b) return;
      var id = b.getAttribute("data-add"); pedido[id] = (pedido[id] || 0) + 1; pintar();
      avisar(buscar(id).n + ($("[data-hoja][data-cuotas]") ? " va en tu presupuesto" : " va en tu pedido"));
    });

    /* ---------- Hoja del pedido y cuenta dividida ---------- */
    var hoja = $("[data-hoja]"), barra = $("[data-barra]"), lista = $("[data-lista]");
    var personas = 2, propina = false, pagados = 0, cuotas = hoja && hoja.hasAttribute("data-cuotas");
    var total = function () { return Object.keys(pedido).reduce(function (s, id) { return s + buscar(id).p * pedido[id]; }, 0); };
    var pintar = function () {
      var n = Object.keys(pedido).reduce(function (s, k) { return s + pedido[k]; }, 0), t = total();
      if (barra) { barra.hidden = n === 0; $("[data-n]", barra).textContent = n; $("[data-t]", barra).textContent = cop(t); }
      if (!lista) return;
      lista.innerHTML = Object.keys(pedido).map(function (id) {
        var p = buscar(id);
        return '<li><span class="q"><button type="button" data-menos="' + id + '" aria-label="Quitar uno de ' + esc(p.n) + '">−</button><b>' + pedido[id] + '</b><button type="button" data-add="' + id + '" aria-label="Agregar otro ' + esc(p.n) + '">+</button></span><span class="pn">' + esc(p.n) + "</span><span class=\"pv\">" + cop(p.p * pedido[id]) + "</span></li>";
      }).join("") || '<li class="vacio">Tu pedido está vacío. Agrega algo de la carta.</li>';
      var prop = propina ? Math.round(t * 0.1) : 0, gran = t + prop;
      $("[data-sub]").textContent = cop(t); $("[data-prop]").textContent = cop(prop); $("[data-gran]").textContent = cop(gran);
      $("[data-personas]").textContent = personas;
      $("[data-cada]").textContent = cop(Math.ceil(gran / personas / 50) * 50);
      $("[data-pagados]").textContent = cuotas ? pagados + " de " + personas + " cuotas pagadas" : pagados + " de " + personas + " ya pagaron";
      var bar = $("[data-progreso]"); if (bar) bar.style.setProperty("--p", (pagados / personas * 100) + "%");
    };
    if (lista) {
      lista.addEventListener("click", function (e) {
        var m = e.target.closest("[data-menos]"), a = e.target.closest("[data-add]");
        if (m) { var id = m.getAttribute("data-menos"); if (--pedido[id] <= 0) delete pedido[id]; }
        if (a) { pedido[a.getAttribute("data-add")]++; }
        pintar();
      });
      $$("[data-abrir-hoja]").forEach(function (b) { b.addEventListener("click", function () { hoja.showModal(); }); });
      $("[data-cerrar-hoja]").addEventListener("click", function () { hoja.close(); });
      hoja.addEventListener("click", function (e) { if (e.target === hoja || e.target.closest("a[href^='#']")) hoja.close(); });
      $("[data-pmas]").addEventListener("click", function () { if (personas < 12) personas++; pintar(); });
      $("[data-pmenos]").addEventListener("click", function () { if (personas > 1) personas--; pagados = Math.min(pagados, personas); pintar(); });
      $("[data-propina]").addEventListener("change", function (e) { propina = e.target.checked; pintar(); });
      $("[data-enviar]").addEventListener("click", function () {
        if (!total()) return avisar("Primero agrega algo de la carta.");
        avisar((mesa ? "Mesa " + mesa + ": p" : "P") + "edido enviado. Demostración: no se envió nada real.");
      });
      $("[data-pagar]").addEventListener("click", function () {
        if (!total()) return avisar("Todavía no hay nada por pagar.");
        if (pagados < personas) pagados++;
        avisar(pagados === personas ? "Cuenta saldada. Demostración: no se cobró nada." : "Pago simulado de " + $("[data-cada]").textContent + ". Faltan " + (personas - pagados) + ".");
        pintar();
      });
      pintar();
    }
  }

  /* ---------- Reservas y citas ---------- */
  $$("[data-slots]").forEach(function (g) {
    g.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b || b.disabled) return;
      $$("button", g).forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      var inp = g.parentNode.querySelector("[name=hora]"); if (inp) inp.value = b.textContent.trim();
    });
  });
  $$("input[type=date][data-hoy]").forEach(function (i) {
    var d = new Date(), iso = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    i.min = iso; if (!i.value) i.value = iso;
  });
  $$("form[data-reserva]").forEach(function (f) {
    var out = $("[data-reserva-msg]", f);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      $$("[aria-invalid]", f).forEach(function (x) { x.removeAttribute("aria-invalid"); });
      var faltan = $$("[required]", f).filter(function (x) { return x.type === "checkbox" ? !x.checked : !x.value.trim(); });
      if (faltan.length) {
        faltan.forEach(function (x) { x.setAttribute("aria-invalid", "true"); });
        if (faltan[0].type !== "hidden") faltan[0].focus();
        out.textContent = faltan.some(function (x) { return x.name === "hora"; }) ? "Elige una hora y revisa los campos marcados." : "Revisa los campos marcados: faltan datos.";
        out.className = "msg err"; return;
      }
      var fd = new FormData(f), fecha = fd.get("fecha") ? new Date(fd.get("fecha") + "T12:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }) : "";
      out.className = "msg ok";
      out.textContent = (f.getAttribute("data-reserva") || "Reserva") + " lista, " + String(fd.get("nombre") || "").split(" ")[0] + ": " + fecha + (fd.get("hora") ? " a las " + fd.get("hora") : "") + (fd.get("personas") ? ", " + fd.get("personas") + " personas" : "") + ". En el sitio real te llega la confirmación por WhatsApp. Demostración: no se guardó ningún dato.";
    });
  });

  /* ---------- Menú móvil ---------- */
  var tg = $("[data-menu-btn]"), mn = $("[data-menu]");
  if (tg && mn) {
    tg.addEventListener("click", function () { var o = tg.getAttribute("aria-expanded") === "true"; tg.setAttribute("aria-expanded", String(!o)); mn.classList.toggle("abierto", !o); });
    mn.addEventListener("click", function (e) { if (e.target.closest("a")) { tg.setAttribute("aria-expanded", "false"); mn.classList.remove("abierto"); } });
  }
})();
