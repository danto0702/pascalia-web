/* La Cebolla Roja: aparición al bajar y fotos con profundidad. */
(function () {
  var doc = document;
  doc.documentElement.classList.add('js');
  var vistos = [].slice.call(doc.querySelectorAll('[data-ver]'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    vistos.forEach(function (el) { io.observe(el); });
  } else { vistos.forEach(function (el) { el.classList.add('visto'); }); }
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var capas = [].slice.call(doc.querySelectorAll('[data-par] img, [data-par-img]'));
  var pedido = false;
  function mover() {
    pedido = false;
    capas.forEach(function (img) {
      var r = img.parentNode.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      var c = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      img.style.setProperty('--y', (c * -60).toFixed(1));
    });
  }
  addEventListener('scroll', function () { if (!pedido) { pedido = true; requestAnimationFrame(mover); } }, { passive: true });
  mover();
})();
