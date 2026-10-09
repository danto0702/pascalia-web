// Formulario de contacto de pascalia.lat.
// Se monta en cada <div data-pascalia-form data-solucion="..."> y envía a la función
// de Supabase `pascalia-solicitud`, que guarda la solicitud y envía los correos.
(function () {
  "use strict";

  var ENDPOINT = "https://wttljozqyaxlzilomnef.supabase.co/functions/v1/pascalia-solicitud";
  var CORREO = "contacto@pascalia.lat";

  var SOLUCIONES = [
    ["flota", "Flota Vehicular"],
    ["nana_dnt", "NANA DNT · nutrición infantil"],
    ["si_aps", "SI-APS · atención primaria"],
    ["mision_medica", "Misión Médica"],
    ["cuentafacil", "CuentaFacil · cuentas de cobro"],
    ["consultoria", "Consultoría"],
    ["desarrollo", "Desarrollo a la medida"],
    ["capacitacion", "Capacitación"],
    ["otro", "Otro"]
  ];
  var FUENTES = [
    ["recomendacion", "Me lo recomendaron"],
    ["redes_sociales", "Redes sociales"],
    ["busqueda", "Búsqueda en internet"],
    ["evento", "Evento o capacitación"],
    ["whatsapp", "WhatsApp"],
    ["otro", "Otro"]
  ];
  var TAMANO = {
    flota: ["¿Cuántos vehículos y conductores?", "Ej.: 8 vehículos, 10 conductores"],
    nana_dnt: ["¿Cuántos municipios o IPS?", "Ej.: 4 municipios"],
    si_aps: ["¿Cuántos Equipos Básicos de Salud?", "Ej.: 6 equipos"],
    mision_medica: ["¿Cuántas IPS o personas en el programa?", "Ej.: 9 IPS, 250 personas"],
    cuentafacil: ["¿Cuántos contratos manejas?", "Ej.: 2 contratos"],
    _: ["Tamaño de tu equipo u organización", "Ej.: 30 personas"]
  };
  var MENSAJE = {
    flota: "Cuéntanos cómo programan hoy los vehículos y qué te gustaría mejorar.",
    nana_dnt: "Cuéntanos cómo llevan hoy el seguimiento nutricional.",
    si_aps: "Cuéntanos cómo capturan y reportan hoy el APS124CCFP.",
    mision_medica: "Cuéntanos qué procesos del programa quieres digitalizar.",
    cuentafacil: "Cuéntanos con qué entidad tienes tu contrato.",
    _: "Cuéntanos qué hace tu organización y qué tarea les quita más tiempo."
  };

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function opciones(lista, vacio) {
    return (vacio ? '<option value="">' + vacio + "</option>" : "") +
      lista.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + "</option>"; }).join("");
  }
  function utm() {
    var p = new URLSearchParams(location.search), r = {}, hay = false;
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
      if (p.get(k)) { r[k] = p.get(k).slice(0, 100); hay = true; }
    });
    return hay ? r : null;
  }

  function montar(cont, n) {
    var pre = cont.getAttribute("data-solucion") || "";
    var id = function (s) { return "pf" + n + "-" + s; };
    var form = el("form", { "class": "pf" + (cont.hasAttribute("data-verde") ? " pf-green" : ""), novalidate: "", "aria-label": "Formulario de contacto" });
    form.innerHTML =
      '<div class="pf-grid">' +
        '<div class="pf-field"><label for="' + id("nombre") + '">Nombre completo</label>' +
          '<input type="text" id="' + id("nombre") + '" name="nombre" autocomplete="name" maxlength="120" required>' +
          '<span class="pf-err" id="' + id("nombre-e") + '"></span></div>' +
        '<div class="pf-field"><label for="' + id("correo") + '">Correo</label>' +
          '<input type="email" id="' + id("correo") + '" name="correo" autocomplete="email" maxlength="160" required>' +
          '<span class="pf-err" id="' + id("correo-e") + '"></span></div>' +
        '<div class="pf-field"><label for="' + id("whatsapp") + '">WhatsApp <span class="pf-opt">(opcional)</span></label>' +
          '<input type="tel" id="' + id("whatsapp") + '" name="whatsapp" autocomplete="tel" maxlength="30" placeholder="Ej.: 300 123 4567"></div>' +
        '<div class="pf-field"><label for="' + id("solucion") + '">¿Qué te interesa?</label>' +
          '<select id="' + id("solucion") + '" name="solucion" required>' + opciones(SOLUCIONES, "Elige una opción") + "</select>" +
          '<span class="pf-err" id="' + id("solucion-e") + '"></span></div>' +
        '<div class="pf-field"><label for="' + id("tamano") + '"><span class="pf-tam-l"></span> <span class="pf-opt">(opcional)</span></label>' +
          '<input type="text" id="' + id("tamano") + '" name="tamano" maxlength="120"></div>' +
        '<div class="pf-field"><label for="' + id("fuente") + '">¿Cómo nos conociste? <span class="pf-opt">(opcional)</span></label>' +
          '<select id="' + id("fuente") + '" name="fuente">' + opciones(FUENTES, "Elige una opción") + "</select></div>" +
        '<div class="pf-field full"><label for="' + id("mensaje") + '">Mensaje</label>' +
          '<textarea id="' + id("mensaje") + '" name="mensaje" maxlength="3000" required></textarea>' +
          '<span class="pf-err" id="' + id("mensaje-e") + '"></span></div>' +
        '<div class="pf-hp" aria-hidden="true"><label for="' + id("sitio") + '">Sitio web</label>' +
          '<input type="text" id="' + id("sitio") + '" name="sitio_web" tabindex="-1" autocomplete="off"></div>' +
        '<div class="pf-field full"><label class="pf-check" for="' + id("acepta") + '">' +
          '<input type="checkbox" id="' + id("acepta") + '" name="acepta_datos" required>' +
          '<span>Autorizo a PascalIA a tratar mis datos para responder esta solicitud y hacerle seguimiento, según la ' +
          '<a href="/politica-de-datos/" target="_blank" rel="noopener">Política de tratamiento de datos</a>.</span></label>' +
          '<span class="pf-err" id="' + id("acepta-e") + '"></span></div>' +
      "</div>" +
      '<div class="pf-actions"><button type="submit" class="pf-submit">Enviar solicitud</button>' +
        '<span class="pf-status" role="status" aria-live="polite"></span></div>';

    var inicio = Date.now();
    var sel = form.querySelector("select[name=solucion]");
    var tamL = form.querySelector(".pf-tam-l"), tam = form.querySelector("input[name=tamano]");
    var msg = form.querySelector("textarea[name=mensaje]");
    function ajustar() {
      var t = TAMANO[sel.value] || TAMANO._;
      tamL.textContent = t[0]; tam.placeholder = t[1];
      msg.placeholder = MENSAJE[sel.value] || MENSAJE._;
    }
    if (pre) sel.value = pre;
    ajustar();
    sel.addEventListener("change", ajustar);

    function marcar(nombre, texto) {
      var campo = form.querySelector("[name=" + nombre + "]"), err = form.querySelector("#" + id((nombre === "acepta_datos" ? "acepta" : nombre) + "-e"));
      if (campo) campo.setAttribute("aria-invalid", texto ? "true" : "false");
      if (campo && err) campo.setAttribute("aria-describedby", err.id);
      if (err) err.textContent = texto || "";
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var status = form.querySelector(".pf-status"), btn = form.querySelector(".pf-submit");
      var datos = {
        nombre: form.nombre.value.trim(),
        correo: form.correo.value.trim(),
        whatsapp: form.whatsapp.value.trim(),
        solucion: sel.value,
        tamano: tam.value.trim(),
        fuente: form.fuente.value,
        mensaje: msg.value.trim(),
        acepta_datos: form.acepta_datos.checked,
        sitio_web: form.sitio_web.value,
        pagina: location.pathname,
        utm: utm(),
        t: Date.now() - inicio
      };
      var errores = {
        nombre: datos.nombre.length < 2 ? "Escribe tu nombre." : "",
        correo: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.correo) ? "" : "Escribe un correo válido.",
        solucion: datos.solucion ? "" : "Elige qué te interesa.",
        mensaje: datos.mensaje.length < 5 ? "Cuéntanos un poco más." : "",
        acepta_datos: datos.acepta_datos ? "" : "Necesitamos tu autorización para responderte."
      };
      var primero = null;
      Object.keys(errores).forEach(function (k) { marcar(k, errores[k]); if (errores[k] && !primero) primero = k; });
      if (primero) { form.querySelector("[name=" + primero + "]").focus(); status.className = "pf-status"; status.textContent = ""; return; }

      btn.disabled = true; btn.textContent = "Enviando…";
      status.className = "pf-status"; status.textContent = "";
      fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; }); })
        .then(function (res) {
          if (res.r.ok && res.j.ok) {
            var hecho = el("div", { "class": "pf-done", tabindex: "-1" },
              '<div class="pf-ok" aria-hidden="true">✓</div><h3>¡Recibimos tu solicitud!</h3>' +
              (res.j.radicado ? '<span class="pf-rad">' + esc(res.j.radicado) + "</span>" : "") +
              "<p>Te responderemos pronto, normalmente el siguiente día hábil.</p>" +
              (res.j.correo ? "<p>Revisa tu correo: te enviamos una confirmación.</p>" : ""));
            form.innerHTML = ""; form.appendChild(hecho); hecho.focus();
            return;
          }
          if (res.j.campos) res.j.campos.forEach(function (c) { marcar(c, "Revisa este campo."); });
          throw new Error(res.j.error || "No pudimos enviar tu solicitud.");
        })
        .catch(function (e) {
          btn.disabled = false; btn.textContent = "Enviar solicitud";
          status.className = "pf-status error";
          status.innerHTML = esc(e && e.message && e.message !== "Failed to fetch" ? e.message : "No pudimos enviar tu solicitud. Revisa tu conexión e intenta de nuevo.") +
            ' También puedes escribirnos a <a href="mailto:' + CORREO + '">' + CORREO + "</a>.";
        });
    });

    cont.innerHTML = "";
    cont.appendChild(form);
  }

  function iniciar() {
    var nodos = document.querySelectorAll("[data-pascalia-form]");
    for (var i = 0; i < nodos.length; i++) montar(nodos[i], i);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
