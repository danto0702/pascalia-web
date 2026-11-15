/* Analítica propia de pascalia.lat (sin terceros). Solo corre si la persona aceptó «Analítica» en el banner de cookies
   (PascaliaConsent, de /legal.js, que debe cargarse antes). Guarda en el navegador un identificador aleatorio
   (pascalia_visitante) y de dónde llegó la primera vez (pascalia_origen, 30 días). Envía a la función pascalpdf-firma:
   la página, el botón tocado (data-analitica="etiqueta"), los utm y el dominio de origen, y el tipo de dispositivo.
   Nunca IP, correo ni contenido de documentos. Si se retira el permiso, borra lo que guardó.
   window.PascaliaAnalitica.origen() da el origen para asociarlo a una cuenta nueva (o null sin permiso). */
(function () {
  "use strict";
  var API = window.PASCALPDF_API || "https://dfzoqenxvpqkzkuakmli.supabase.co/functions/v1/pascalpdf-firma";
  var KV = "pascalia_visitante", KO = "pascalia_origen", DIAS_ORIGEN = 30;
  var activa = false;

  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function permitido() { return !!(window.PascaliaConsent && PascaliaConsent.permitido("analitica")); }

  function visitante() {
    var v = leer(KV);
    if (v && /^[A-Za-z0-9_-]{8,40}$/.test(v)) return v;
    var a = new Uint8Array(15);
    crypto.getRandomValues(a);
    v = Array.prototype.map.call(a, function (b) { return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[b & 63]; }).join("");
    guardar(KV, v);
    return v;
  }

  function dispositivo() {
    var ua = navigator.userAgent || "";
    if (/Android/i.test(ua)) return "android";
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
    if (/Mobi/i.test(ua)) return "otro";
    return "escritorio";
  }

  // De dónde viene esta visita: utm del enlace o, si no hay, el dominio que la trajo (solo si es externo)
  function fuenteActual() {
    var q = new URLSearchParams(location.search), r = {};
    [["utm_source", "fuente", 60], ["utm_medium", "medio", 60], ["utm_campaign", "campana", 80]].forEach(function (x) {
      var v = (q.get(x[0]) || "").trim().slice(0, x[2]);
      if (v) r[x[1]] = v.toLowerCase();
    });
    var ref = "";
    try { ref = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { /* sin referente */ }
    if (ref && ref !== location.hostname) {
      r.referente = ref.slice(0, 120);
      if (!r.fuente) r.fuente = ref.replace(/^(www|l|lm|m|mobile|out)\./, "").slice(0, 60);
    }
    return r;
  }

  function enviar(datos) {
    try {
      fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify(datos) }).catch(function () {});
    } catch (e) { /* nunca romper la página por la analítica */ }
  }

  function base(evento) {
    var f = fuenteActual();
    return { accion: "analitica", evento: evento, visitante: visitante(), pagina: location.pathname.slice(0, 120), dispositivo: dispositivo(),
      fuente: f.fuente || null, medio: f.medio || null, campana: f.campana || null, referente: f.referente || null };
  }

  function iniciar() {
    if (activa) return;
    activa = true;
    // Primer contacto: se conserva 30 días para saber de dónde llegó quien crea la cuenta
    var f = fuenteActual(), o = null;
    try { o = JSON.parse(leer(KO) || "null"); } catch (e) { o = null; }
    if (o && o.hasta && Date.parse(o.hasta) < Date.now()) o = null;
    if (!o && (f.fuente || f.medio || f.campana)) guardar(KO, JSON.stringify(Object.assign({ hasta: new Date(Date.now() + DIAS_ORIGEN * 864e5).toISOString() }, f)));
    enviar(base("visita"));
  }

  document.addEventListener("click", function (e) {
    if (!activa) return;
    var el = e.target.closest && e.target.closest("[data-analitica]");
    if (!el) return;
    var d = base("cta");
    d.etiqueta = String(el.getAttribute("data-analitica")).slice(0, 40);
    enviar(d);
  }, true);

  window.PascaliaAnalitica = {
    origen: function () {
      if (!permitido()) return null;
      try {
        var o = JSON.parse(leer(KO) || "null");
        if (!o || (o.hasta && Date.parse(o.hasta) < Date.now())) return null;
        return { fuente: o.fuente, medio: o.medio, campana: o.campana, referente: o.referente };
      } catch (e) { return null; }
    }
  };

  function arrancar() {
    if (!window.PascaliaConsent) return;
    if (permitido()) iniciar();
    PascaliaConsent.alCambiar(function (v) {
      if (v.analitica) iniciar();
      else { activa = false; guardar(KV, null); guardar(KO, null); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
