/* Pascal Web · menú móvil, preguntas frecuentes y subrayado de la frase clave. */
(function () {
  "use strict";
  var btn = document.querySelector("[data-menu-btn]"), menu = document.getElementById("menu");
  function abrir(on) { menu.classList.toggle("is-open", on); btn.setAttribute("aria-expanded", on ? "true" : "false"); document.body.style.overflow = on ? "hidden" : ""; }
  if (btn && menu) {
    btn.addEventListener("click", function () { abrir(!menu.classList.contains("is-open")); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) abrir(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("is-open")) { abrir(false); btn.focus(); } });
  }
  var faq = Array.prototype.slice.call(document.querySelectorAll("[data-faq] details"));
  faq.forEach(function (d) { d.addEventListener("toggle", function () { if (d.open) faq.forEach(function (o) { if (o !== d) o.open = false; }); }); });
  var marks = document.querySelectorAll(".mark");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); } }); }, { threshold: 0.6 });
    marks.forEach(function (m) { io.observe(m); });
  } else marks.forEach(function (m) { m.classList.add("on"); });
})();
