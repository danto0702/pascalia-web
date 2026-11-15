/* PascalIA · capa legal común (obligatoria en todas las páginas, ver CUMPLIMIENTO.md).
   - Enlace "Saltar al contenido" para teclado.
   - Franja legal con datos del responsable y enlaces a las políticas.
   - Aviso de cookies con opciones del mismo peso (Aceptar / Rechazar / Configurar).
   - API window.PascaliaConsent para condicionar cualquier script opcional futuro:
       PascaliaConsent.permitido("analitica") -> true/false
       PascaliaConsent.alCambiar(fn)
   Hoy el sitio solo usa almacenamiento necesario: no hay analítica ni publicidad. */
(function () {
  "use strict";
  var CLAVE = "pascalia_consentimiento", VERSION = 2;
  var CATS = [
    { id: "necesarias", nombre: "Necesarias", fija: true, txt: "Recuerdan tu elección de cookies, tu sesión en el panel o en PascalPDF y el avance de las demos. Sin ellas el sitio no funciona." },
    { id: "preferencias", nombre: "Preferencias", txt: "Guardan ajustes opcionales, como una firma o sello que decidas recordar en este navegador." },
    { id: "analitica", nombre: "Analítica", txt: "Medición propia y anónima de visitas, sin terceros: un identificador al azar en tu navegador, la página que visitas, de dónde llegaste y tu tipo de dispositivo. Nunca tu IP ni tus datos personales. Se borra a los 13 meses." }
  ];
  var oyentes = [];
  function leer() { try { var v = JSON.parse(localStorage.getItem(CLAVE)); return v && v.v === VERSION ? v : null; } catch (e) { return null; } }
  function guardar(sel) {
    var v = { v: VERSION, fecha: new Date().toISOString(), necesarias: true, preferencias: !!sel.preferencias, analitica: !!sel.analitica };
    try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch (e) {}
    estado = v; oyentes.forEach(function (f) { try { f(v); } catch (e) {} });
  }
  var estado = leer();
  window.PascaliaConsent = {
    permitido: function (cat) { return cat === "necesarias" || !!(estado && estado[cat]); },
    alCambiar: function (f) { oyentes.push(f); },
    abrir: function () { mostrar(true); }
  };

  var css = ".pl-skip{position:fixed;left:12px;top:-60px;z-index:10001;background:#111;color:#fff;padding:10px 16px;border-radius:8px;font:600 15px/1.2 system-ui,sans-serif;text-decoration:none}.pl-skip:focus{top:12px}" +
    ":focus-visible{outline:3px solid #1d4ed8;outline-offset:2px}" +
    ".pl-legal{background:#111827;color:#e5e7eb;font:14px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;padding:20px 16px;text-align:center}" +
    ".pl-legal nav{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 16px;margin-bottom:8px}" +
    ".pl-legal a,.pl-legal button{color:#fff;text-decoration:underline;background:none;border:0;font:inherit;cursor:pointer;padding:4px 0}" +
    ".pl-legal p{margin:4px auto;max-width:900px;color:#d1d5db}" +
    ".pl-ck{position:fixed;left:16px;right:16px;bottom:16px;z-index:10000;max-width:560px;margin:0 auto;background:#fff;color:#111827;border:1px solid #d1d5db;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:18px;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}" +
    ".pl-ck h2{font-size:17px;margin:0 0 6px}.pl-ck p{margin:0 0 12px}.pl-ck a{color:#1d4ed8}" +
    ".pl-ck .pl-row{display:flex;flex-wrap:wrap;gap:8px}.pl-ck button{flex:1 1 140px;min-height:44px;border-radius:10px;border:2px solid #111827;background:#fff;color:#111827;font:600 15px system-ui,sans-serif;cursor:pointer}" +
    ".pl-ck button.pl-p{background:#111827;color:#fff}.pl-ck fieldset{border:0;padding:0;margin:0 0 12px}.pl-ck label{display:flex;gap:10px;align-items:flex-start;margin:8px 0}.pl-ck label small{display:block;color:#4b5563}" +
    ".pl-ck input{width:20px;height:20px;margin-top:2px;flex:none}@media print{.pl-ck,.pl-skip{display:none}}";

  function el(h) { var d = document.createElement("div"); d.innerHTML = h; return d.firstElementChild; }
  var caja = null;
  function mostrar(detalle) {
    if (caja) caja.remove();
    var s = estado || {};
    var opciones = detalle ? '<fieldset><legend class="pl-sr" style="position:absolute;left:-9999px">Categorías</legend>' + CATS.map(function (c) {
      return '<label><input type="checkbox" name="' + c.id + '"' + (c.fija || s[c.id] ? " checked" : "") + (c.fija ? " disabled" : "") + '><span><b>' + c.nombre + (c.fija ? " (siempre activas)" : "") + "</b><small>" + c.txt + "</small></span></label>";
    }).join("") + "</fieldset>" : "";
    caja = el('<section class="pl-ck" role="dialog" aria-labelledby="pl-ck-t" aria-live="polite"><h2 id="pl-ck-t">Cookies y almacenamiento</h2>' +
      "<p>Usamos solo lo necesario para que el sitio funcione. Las opcionales quedan apagadas hasta que tú decidas. " +
      '<a href="/politica-de-cookies/">Política de cookies</a>.</p>' + opciones +
      '<div class="pl-row"><button type="button" data-a="rechazar">Rechazar opcionales</button>' +
      (detalle ? '<button type="button" data-a="guardar">Guardar selección</button>' : '<button type="button" data-a="config">Configurar</button>') +
      '<button type="button" class="pl-p" data-a="aceptar">Aceptar todas</button></div></section>');
    caja.addEventListener("click", function (e) {
      var a = e.target.getAttribute && e.target.getAttribute("data-a"); if (!a) return;
      if (a === "config") return mostrar(true);
      if (a === "aceptar") guardar({ preferencias: true, analitica: true });
      if (a === "rechazar") guardar({});
      if (a === "guardar") guardar({ preferencias: caja.querySelector("[name=preferencias]").checked, analitica: caja.querySelector("[name=analitica]").checked });
      caja.remove(); caja = null;
    });
    document.body.appendChild(caja);
    var f = caja.querySelector("button"); if (detalle && f) f.focus();
  }

  function iniciar() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    var destino = document.querySelector("main") || document.querySelector("h1");
    if (destino) {
      if (!destino.id) destino.id = "contenido";
      if (!destino.hasAttribute("tabindex")) destino.setAttribute("tabindex", "-1");
      var sk = el('<a class="pl-skip" href="#' + destino.id + '">Saltar al contenido</a>');
      document.body.insertBefore(sk, document.body.firstChild);
    }
    if (!document.body.hasAttribute("data-sin-franja-legal")) {
      document.body.appendChild(el('<footer class="pl-legal" aria-label="Información legal"><nav aria-label="Documentos legales">' +
        '<a href="/politica-de-datos/">Privacidad y datos</a><a href="/terminos/">Términos y condiciones</a>' +
        '<a href="/reembolsos/">Reembolsos</a><a href="/politica-de-cookies/">Cookies</a>' +
        '<a href="/eliminar-mis-datos/">Eliminar mis datos</a><a href="/aviso-legal/">Aviso legal y créditos</a>' +
        '<button type="button" data-pl-cookies>Configurar cookies</button></nav>' +
        "<p>PascalIA · Responsable: Danilo Orlando Torrado Blanco, C.C. 1.090.453.097 · Calle 11 # 13-55, Ábrego, Norte de Santander, Colombia · " +
        '<a href="mailto:contacto@pascalia.lat">contacto@pascalia.lat</a> · WhatsApp <a href="https://wa.me/573123885012">+57 312 388 5012</a></p>' +
        "<p>Servicios dirigidos a personas mayores de 18 años. Precios en pesos colombianos; lo que pagas se informa antes de cobrar.</p></footer>"));
    }
    document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-pl-cookies]")) { e.preventDefault(); mostrar(true); } });
    if (!estado) mostrar(false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
