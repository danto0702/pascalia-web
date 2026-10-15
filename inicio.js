// Portada de pascalia.lat: menú móvil, rutas del hero y apariciones al hacer scroll.
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");
  var quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Borde de la navegación al bajar
  var nav = document.querySelector("[data-nav]");
  function alBajar() {
    if (window.scrollY > 8) nav.setAttribute("data-scrolled", "");
    else nav.removeAttribute("data-scrolled");
  }
  alBajar();
  window.addEventListener("scroll", alBajar, { passive: true });

  // Menú en celular
  var btn = document.querySelector("[data-menu-btn]");
  var menu = document.getElementById("menu");
  function abrir(si) {
    menu.classList.toggle("is-open", si);
    btn.setAttribute("aria-expanded", si ? "true" : "false");
  }
  btn.addEventListener("click", function () { abrir(!menu.classList.contains("is-open")); });
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) abrir(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menu.classList.contains("is-open")) { abrir(false); btn.focus(); }
  });

  // Rutas del hero: cada una ilumina su fragmento y su conexión con la flor
  var hero = document.querySelector("[data-hero]");
  var rutas = [].slice.call(document.querySelectorAll("[data-route]"));
  var turno = 0, ciclo = null, tocado = false;
  function activar(clave) {
    if (clave) hero.setAttribute("data-active", clave);
    else hero.removeAttribute("data-active");
    rutas.forEach(function (r) { r.classList.toggle("is-active", r.getAttribute("data-route") === clave); });
  }
  function detener() { tocado = true; clearInterval(ciclo); }
  rutas.forEach(function (r) {
    var clave = r.getAttribute("data-route");
    r.addEventListener("mouseenter", function () { detener(); activar(clave); });
    r.addEventListener("focus", function () { detener(); activar(clave); });
    r.addEventListener("mouseleave", function () { activar(null); });
    r.addEventListener("blur", function () { activar(null); });
  });
  // Sin interacción, recorre las rutas despacio para mostrar la idea
  // En celular los fragmentos no se muestran, así que no hay nada que iluminar
  if (!quieto && !window.matchMedia("(max-width: 680px)").matches) {
    setTimeout(function () {
      if (tocado) return;
      ciclo = setInterval(function () {
        if (tocado || document.hidden) return;
        activar(rutas[turno % rutas.length].getAttribute("data-route"));
        turno++;
      }, 3200);
    }, 2600);
  }

  // Suite en celular: las filas sin página propia se abren en el sitio
  [].forEach.call(document.querySelectorAll(".catalog-suite div.item .item-body"), function (cuerpo) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "more-btn"; b.textContent = "Ver más"; b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", function () {
      var abierto = cuerpo.parentNode.classList.toggle("is-open");
      b.textContent = abierto ? "Ver menos" : "Ver más";
      b.setAttribute("aria-expanded", abierto ? "true" : "false");
    });
    cuerpo.appendChild(b);
  });

  // Apariciones: una sola vez por bloque
  var bloques = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window) || quieto) {
    [].forEach.call(bloques, function (b) { b.classList.add("is-in"); });
    return;
  }
  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("is-in"); obs.unobserve(en.target); }
    });
  }, { threshold: 0.25, rootMargin: "0px 0px -8% 0px" });
  [].forEach.call(bloques, function (b) { obs.observe(b); });
})();
