// Páginas de producto de pascalia.lat: menú, pestañas, botones y animaciones al bajar.
(function () {
  "use strict";

  document.documentElement.classList.add("js");
  var quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cada = function (sel, fn, raiz) { [].forEach.call((raiz || document).querySelectorAll(sel), fn); };

  // Borde de la navegación al bajar
  var nav = document.querySelector("[data-nav]");
  if (nav) {
    var alBajar = function () { window.scrollY > 8 ? nav.setAttribute("data-scrolled", "") : nav.removeAttribute("data-scrolled"); };
    alBajar();
    window.addEventListener("scroll", alBajar, { passive: true });
  }

  // Menú en celular
  var btnMenu = document.querySelector("[data-menu-btn]");
  var menu = document.getElementById("menu");
  if (btnMenu && menu) {
    var abrir = function (si) { menu.classList.toggle("is-open", si); btnMenu.setAttribute("aria-expanded", si ? "true" : "false"); };
    btnMenu.addEventListener("click", function () { abrir(!menu.classList.contains("is-open")); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) abrir(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("is-open")) { abrir(false); btnMenu.focus(); } });
  }

  // Onda al tocar un botón: confirma la acción
  document.addEventListener("pointerdown", function (e) {
    var b = e.target.closest(".btn, .pf-submit");
    if (!b || quieto) return;
    var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
    var o = document.createElement("span");
    o.className = "ripple";
    o.style.width = o.style.height = d + "px";
    o.style.left = (e.clientX - r.left - d / 2) + "px";
    o.style.top = (e.clientY - r.top - d / 2) + "px";
    if (getComputedStyle(b).position === "static") b.style.position = "relative";
    b.style.overflow = "hidden";
    b.appendChild(o);
    setTimeout(function () { o.remove(); }, 650);
  });

  // Pestañas: explorador de funciones y roles
  cada("[data-tabs]", function (grupo) {
    var tabs = [].slice.call(grupo.querySelectorAll('[role="tab"]'));
    function elegir(tab, foco) {
      tabs.forEach(function (t) {
        var si = t === tab, panel = document.getElementById(t.getAttribute("aria-controls"));
        t.setAttribute("aria-selected", si ? "true" : "false");
        t.tabIndex = si ? 0 : -1;
        if (!panel) return;
        if (si) {
          panel.hidden = false;
          panel.classList.remove("is-entering"); void panel.offsetWidth; panel.classList.add("is-entering");
        } else panel.hidden = true;
      });
      if (foco) tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { elegir(t); });
      t.addEventListener("keydown", function (e) {
        var k = e.key, n = null;
        if (k === "ArrowDown" || k === "ArrowRight") n = tabs[(i + 1) % tabs.length];
        if (k === "ArrowUp" || k === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (k === "Home") n = tabs[0];
        if (k === "End") n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); elegir(n, true); }
      });
    });
    var inicial = tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0] || tabs[0];
    tabs.forEach(function (t) { var p = document.getElementById(t.getAttribute("aria-controls")); if (p && t !== inicial) p.hidden = true; t.tabIndex = t === inicial ? 0 : -1; });
  });

  // Enlaces que abren una pestaña (mosaico del inicio, enlaces desde otras páginas con #id)
  function abrirPestana(idPanel, desplazar) {
    var tab = document.querySelector('[role="tab"][aria-controls="' + idPanel + '"]');
    if (!tab) return false;
    tab.click();
    if (desplazar) (tab.closest("[data-tabs]") || tab).scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "start" });
    return true;
  }
  cada("[data-open-tab]", function (a) {
    a.addEventListener("click", function (e) {
      var tab = document.getElementById(a.getAttribute("data-open-tab"));
      if (tab && abrirPestana(tab.getAttribute("aria-controls"), true)) { e.preventDefault(); history.replaceState(null, "", "#" + tab.getAttribute("aria-controls")); }
    });
  });
  if (location.hash) setTimeout(function () { abrirPestana(decodeURIComponent(location.hash.slice(1)), true); }, 60);
  window.addEventListener("hashchange", function () { abrirPestana(decodeURIComponent(location.hash.slice(1)), true); });

  // Apariciones (una vez) y maquetas que solo se mueven en pantalla
  var revelar = document.querySelectorAll("[data-reveal], .flow, .proofs, .versus");
  var bucles = document.querySelectorAll(".loop, .ticker");
  if (!("IntersectionObserver" in window) || quieto) {
    cada("[data-reveal], .flow, .proofs, .versus", function (el) { el.classList.add("is-in"); });
    cada(".loop, .ticker", function (el) { el.classList.add("is-playing"); });
    return;
  }
  var obs = new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); obs.unobserve(en.target); } });
  }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
  [].forEach.call(revelar, function (el) { obs.observe(el); });
  var vis = new IntersectionObserver(function (es) {
    es.forEach(function (en) { en.target.classList.toggle("is-playing", en.isIntersecting); });
  }, { threshold: 0.1 });
  [].forEach.call(bucles, function (el) { vis.observe(el); });
})();
