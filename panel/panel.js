// Tablero de solicitudes de pascalia.lat (solo administradores de PascalIA).
// Lee y escribe pascalia_solicitudes / pascalia_actividades con la sesión del usuario;
// los permisos los decide la base de datos (RLS + pascalia_es_admin()).
(function () {
  "use strict";

  var SUPABASE_URL = "https://wttljozqyaxlzilomnef.supabase.co";
  var SUPABASE_KEY = "sb_publishable_t-B7hBBK8ovmwvk7GZrPCg_qdGJsNZz";

  var ETAPAS = [
    ["nueva", "Nueva"], ["contactada", "Contactada"], ["reunion_agendada", "Reunión agendada"],
    ["demo_realizada", "Demo realizada"], ["propuesta_enviada", "Propuesta enviada"], ["negociacion", "Negociación"],
    ["ganada", "Ganada"], ["perdida", "Perdida"], ["descartada", "Descartada"]
  ];
  var CERRADAS = { ganada: 1, perdida: 1, descartada: 1 };
  var SOLUCIONES = [
    ["flota", "Flota Vehicular"], ["nana_dnt", "NANA DNT"], ["si_aps", "SI-APS"], ["mision_medica", "Misión Médica"],
    ["cuentafacil", "CuentaFacil"], ["consultoria", "Consultoría"], ["desarrollo", "Desarrollo"],
    ["capacitacion", "Capacitación"], ["otro", "Otro"]
  ];
  var FUENTES = [
    ["recomendacion", "Recomendación"], ["redes_sociales", "Redes sociales"], ["busqueda", "Búsqueda"],
    ["evento", "Evento"], ["whatsapp", "WhatsApp"], ["otro", "Otro"]
  ];
  var PRIORIDADES = [["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]];
  var MOTIVOS = [
    ["cliente_ganado", "Cliente ganado"], ["precio", "Precio"], ["sin_presupuesto", "Sin presupuesto"],
    ["tiempos", "Tiempos"], ["eligio_otro_proveedor", "Eligió otro proveedor"], ["no_responde", "No responde"],
    ["no_es_cliente_objetivo", "No es cliente objetivo"], ["duplicada_o_spam", "Duplicada o spam"], ["otro", "Otro"]
  ];
  var TIPOS = [
    ["llamada", "Llamada"], ["whatsapp", "WhatsApp"], ["correo", "Correo"], ["reunion", "Reunión"],
    ["demo", "Demo"], ["nota", "Nota"]
  ];
  var TIPOS_TODOS = TIPOS.concat([["cambio_etapa", "Cambio de etapa"], ["sistema", "Sistema"]]);

  var mapa = function (l) { var m = {}; l.forEach(function (x) { m[x[0]] = x[1]; }); return m; };
  var L = { etapa: mapa(ETAPAS), solucion: mapa(SOLUCIONES), fuente: mapa(FUENTES), prioridad: mapa(PRIORIDADES), motivo: mapa(MOTIVOS), tipo: mapa(TIPOS_TODOS) };

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  var $ = function (s) { return document.querySelector(s); };
  var todas = [], filtradas = [], actual = null;

  // ---------- utilidades ----------
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  var fmtCOP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  var fmtNum = new Intl.NumberFormat("es-CO");
  var fmtCorto = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });
  function fecha(d, conHora) {
    if (!d) return "—";
    return new Date(d).toLocaleString("es-CO", conHora ? { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" } : { dateStyle: "medium", timeZone: "America/Bogota" });
  }
  function hoyISO() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }); }
  function duracion(ms) {
    if (ms == null || ms < 0) return "—";
    var h = ms / 3600000;
    if (h < 1) return Math.max(1, Math.round(ms / 60000)) + " min";
    if (h < 48) return Math.round(h) + " h";
    return Math.round(h / 24) + " días";
  }
  function vencida(s) { return !CERRADAS[s.etapa] && s.proxima_accion_fecha && s.proxima_accion_fecha < hoyISO(); }
  function opciones(sel, lista, vacio) {
    sel.innerHTML = (vacio ? '<option value="">' + vacio + "</option>" : "") +
      lista.map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + "</option>"; }).join("");
  }
  function toast(t, error) {
    var n = $("#toast"); n.textContent = t; n.className = "toast" + (error ? " error" : ""); n.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { n.hidden = true; }, 3500);
  }
  function waLink(num) {
    var d = String(num || "").replace(/\D/g, "");
    if (!d) return null;
    if (d.length === 10 && d[0] === "3") d = "57" + d;
    return "https://wa.me/" + d;
  }
  function vista(id) {
    ["#v-login", "#v-sin-acceso", "#v-app"].forEach(function (v) { $(v).hidden = v !== id; });
  }

  // ---------- sesión ----------
  async function arrancar(session) {
    if (!session) { vista("#v-login"); return; }
    var r = await sb.rpc("pascalia_es_admin");
    if (r.error || r.data !== true) {
      $("#sa-correo").textContent = session.user.email || "";
      vista("#v-sin-acceso"); return;
    }
    $("#u-correo").textContent = session.user.email || "";
    vista("#v-app");
    await cargar();
  }

  $("#f-login").addEventListener("submit", async function (e) {
    e.preventDefault();
    var msg = $("#login-msg"); msg.textContent = "Ingresando…"; msg.className = "msg";
    var r = await sb.auth.signInWithPassword({ email: $("#l-correo").value.trim(), password: $("#l-clave").value });
    if (r.error) { msg.textContent = "Correo o contraseña incorrectos."; msg.className = "msg error"; return; }
    msg.textContent = "";
    arrancar(r.data.session);
  });
  $("#b-olvide").addEventListener("click", async function () {
    var correo = $("#l-correo").value.trim(), msg = $("#login-msg");
    if (!correo) { msg.textContent = "Escribe tu correo y vuelve a pulsar el enlace."; msg.className = "msg error"; return; }
    var r = await sb.auth.resetPasswordForEmail(correo, { redirectTo: location.origin + "/panel/" });
    msg.className = "msg"; msg.textContent = r.error ? "No pudimos enviar el correo. Intenta más tarde." : "Si la cuenta existe, te enviamos un enlace para crear una nueva contraseña.";
  });
  $("#f-nueva-clave").addEventListener("submit", async function (e) {
    e.preventDefault();
    var clave = $("#n-clave").value, msg = $("#clave-msg");
    if (clave.length < 10) { msg.textContent = "Usa al menos 10 caracteres."; msg.className = "msg error"; return; }
    var r = await sb.auth.updateUser({ password: clave });
    if (r.error) { msg.textContent = "No se pudo guardar: " + r.error.message; msg.className = "msg error"; return; }
    $("#f-nueva-clave").hidden = true; $("#f-login").hidden = false;
    var s = await sb.auth.getSession(); arrancar(s.data.session);
  });
  document.querySelectorAll("[data-salir]").forEach(function (b) {
    b.addEventListener("click", async function () { await sb.auth.signOut(); location.reload(); });
  });
  sb.auth.onAuthStateChange(function (ev) {
    if (ev === "PASSWORD_RECOVERY") { vista("#v-login"); $("#f-login").hidden = true; $("#f-nueva-clave").hidden = false; }
  });

  // ---------- datos ----------
  async function cargar() {
    var r = await sb.from("pascalia_solicitudes").select("*").order("created_at", { ascending: false }).limit(5000);
    if (r.error) { toast("No se pudieron cargar las solicitudes: " + r.error.message, true); return; }
    todas = r.data || [];
    pintar();
    if (actual) {
      var a = todas.find(function (s) { return s.id === actual.id; });
      if (a) abrir(a, true);
    }
  }

  function filtrar() {
    var q = $("#f-q").value.trim().toLowerCase();
    var per = $("#f-periodo").value, desde = per === "todo" ? 0 : Date.now() - Number(per) * 86400000;
    var et = $("#f-etapa").value, so = $("#f-solucion").value, pr = $("#f-prioridad").value, fu = $("#f-fuente").value;
    var solo = $("#f-vencidas").checked;
    return todas.filter(function (s) {
      if (desde && new Date(s.created_at).getTime() < desde) return false;
      if (et === "_abiertas" && CERRADAS[s.etapa]) return false;
      if (et && et !== "_abiertas" && s.etapa !== et) return false;
      if (so && s.solucion !== so) return false;
      if (pr && s.prioridad !== pr) return false;
      if (fu && (s.fuente || "") !== fu) return false;
      if (solo && !vencida(s)) return false;
      if (q) {
        var h = [s.radicado, s.nombre, s.correo, s.whatsapp, s.mensaje, s.tamano, s.proxima_accion].join(" ").toLowerCase();
        if (h.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function ordenar(l) {
    var o = $("#f-orden").value, pr = { alta: 0, media: 1, baja: 2 };
    return l.slice().sort(function (a, b) {
      if (o === "proxima") return (a.proxima_accion_fecha || "9999") < (b.proxima_accion_fecha || "9999") ? -1 : (a.proxima_accion_fecha || "9999") > (b.proxima_accion_fecha || "9999") ? 1 : 0;
      if (o === "prioridad") return pr[a.prioridad] - pr[b.prioridad] || (a.created_at < b.created_at ? 1 : -1);
      if (o === "valor") return (b.valor_estimado || 0) - (a.valor_estimado || 0);
      return a.created_at < b.created_at ? 1 : -1;
    });
  }

  function pintar() {
    filtradas = ordenar(filtrar());
    $("#n-filtradas").textContent = fmtNum.format(filtradas.length);
    pintarKpis(filtradas);
    barras("#c-etapa", ETAPAS.map(function (e) { return [e[1], filtradas.filter(function (s) { return s.etapa === e[0]; }).length]; }));
    barras("#c-solucion", contar(filtradas, "solucion", SOLUCIONES));
    barras("#c-fuente", contar(filtradas, "fuente", FUENTES.concat([["", "Sin dato"]])));
    barras("#c-mes", porMes(filtradas));
    pintarTabla();
  }

  function contar(l, campo, lista) {
    return lista.map(function (o) {
      return [o[1], l.filter(function (s) { return (s[campo] || "") === o[0]; }).length];
    }).filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
  }
  function porMes(l) {
    var out = [], d = new Date();
    for (var i = 5; i >= 0; i--) {
      var m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      var clave = m.getFullYear() + "-" + String(m.getMonth() + 1).padStart(2, "0");
      var nombre = m.toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
      out.push([nombre, l.filter(function (s) { return s.created_at.slice(0, 7) === clave; }).length]);
    }
    return out;
  }

  function pintarKpis(l) {
    var abiertas = l.filter(function (s) { return !CERRADAS[s.etapa]; });
    var nuevas = l.filter(function (s) { return s.etapa === "nueva"; });
    var venc = l.filter(vencida);
    var resp = l.filter(function (s) { return s.primer_contacto_at; }).map(function (s) { return new Date(s.primer_contacto_at) - new Date(s.created_at); });
    var media = resp.length ? resp.reduce(function (a, b) { return a + b; }, 0) / resp.length : null;
    var valor = abiertas.reduce(function (a, s) { return a + (s.valor_estimado || 0); }, 0);
    var ganadas = l.filter(function (s) { return s.etapa === "ganada"; });
    var cerradas = l.filter(function (s) { return s.etapa === "ganada" || s.etapa === "perdida"; });
    var masVieja = nuevas.reduce(function (m, s) { return !m || s.created_at < m ? s.created_at : m; }, null);
    var tiles = [
      ["Solicitudes", fmtNum.format(l.length), abiertas.length + " abiertas", ""],
      ["Sin contactar", fmtNum.format(nuevas.length), masVieja ? "la más antigua hace " + duracion(Date.now() - new Date(masVieja)) : "al día", nuevas.length ? "warn" : ""],
      ["Acciones vencidas", fmtNum.format(venc.length), venc.length ? "revisa la lista" : "ninguna", venc.length ? "bad" : ""],
      ["Primera respuesta", media == null ? "—" : duracion(media), "promedio", ""],
      ["Valor en embudo", "$ " + fmtCorto.format(valor), fmtCOP.format(valor) + " en abiertas", ""],
      ["Ganadas", fmtNum.format(ganadas.length), cerradas.length ? Math.round(ganadas.length * 100 / cerradas.length) + " % de las cerradas" : "sin cierres aún", ""]
    ];
    $("#kpis").innerHTML = tiles.map(function (t) {
      return '<div class="kpi ' + t[3] + '"><span class="k-l">' + (t[3] === "bad" ? "⚠ " : t[3] === "warn" ? "● " : "") + esc(t[0]) + '</span><b class="k-v">' + esc(t[1]) + '</b><span class="k-s">' + esc(t[2]) + "</span></div>";
    }).join("");
  }

  function barras(sel, datos) {
    var max = Math.max.apply(null, datos.map(function (d) { return d[1]; }).concat([1]));
    var total = datos.reduce(function (a, d) { return a + d[1]; }, 0);
    $(sel).innerHTML = !total ? '<p class="muted small">Sin datos para estos filtros.</p>' :
      '<ul class="bars">' + datos.map(function (d) {
        var pct = total ? Math.round(d[1] * 100 / total) : 0;
        return '<li title="' + esc(d[0]) + ": " + d[1] + " (" + pct + ' %)"><span class="b-l">' + esc(d[0]) + '</span><span class="b-t"><i style="width:' + (d[1] ? Math.max(2, d[1] * 100 / max) : 0) + '%"></i></span><span class="b-v">' + d[1] + "</span></li>";
      }).join("") + "</ul>";
  }

  function pintarTabla() {
    var hoy = hoyISO();
    $("#t-vacio").hidden = filtradas.length > 0;
    $("#t-body").innerHTML = filtradas.map(function (s) {
      var venc = vencida(s);
      var resp = s.primer_contacto_at ? duracion(new Date(s.primer_contacto_at) - new Date(s.created_at))
        : (CERRADAS[s.etapa] ? "—" : '<span class="pend">esperando · ' + duracion(Date.now() - new Date(s.created_at)) + "</span>");
      return '<tr data-id="' + s.id + '" tabindex="0">' +
        '<td class="mono">' + esc(s.radicado) + (s.origen === "manual" ? ' <span class="tag-m" title="Creada a mano">M</span>' : "") + "</td>" +
        "<td>" + fecha(s.created_at) + "</td>" +
        '<td><b>' + esc(s.nombre) + '</b><br><span class="muted small">' + esc(s.correo) + "</span></td>" +
        "<td>" + esc(L.solucion[s.solucion] || s.solucion) + (s.tamano ? '<br><span class="muted small">' + esc(s.tamano) + "</span>" : "") + "</td>" +
        '<td><span class="et et-' + s.etapa + '">' + esc(L.etapa[s.etapa]) + "</span></td>" +
        '<td><span class="pr pr-' + s.prioridad + '">' + esc(L.prioridad[s.prioridad]) + "</span></td>" +
        "<td>" + (s.proxima_accion_fecha ? '<span class="' + (venc ? "venc" : s.proxima_accion_fecha === hoy ? "hoy" : "") + '">' + (venc ? "⚠ " : "") + fecha(s.proxima_accion_fecha + "T12:00:00") + "</span><br>" : "") +
          '<span class="muted small">' + esc(s.proxima_accion || "") + "</span></td>" +
        '<td class="num">' + (s.valor_estimado != null ? fmtCOP.format(s.valor_estimado) : "—") + "</td>" +
        "<td>" + resp + "</td></tr>";
    }).join("");
  }

  $("#t-body").addEventListener("click", function (e) {
    var tr = e.target.closest("tr[data-id]"); if (!tr) return;
    abrir(todas.find(function (s) { return s.id === tr.dataset.id; }));
  });
  $("#t-body").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.matches("tr[data-id]")) abrir(todas.find(function (s) { return s.id === e.target.dataset.id; }));
  });

  // ---------- detalle ----------
  async function abrir(s, refrescar) {
    if (!s) return;
    actual = s;
    $("#d-rad").textContent = s.radicado;
    $("#d-titulo").textContent = s.nombre;
    var wa = waLink(s.whatsapp);
    $("#d-quick").innerHTML =
      '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(s.correo) + "?subject=" + encodeURIComponent("Tu solicitud " + s.radicado + " · PascalIA") + '">✉ Correo</a>' +
      (wa ? '<a class="btn btn-ghost btn-sm" href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' : "") +
      (s.whatsapp ? '<a class="btn btn-ghost btn-sm" href="tel:' + esc(s.whatsapp.replace(/[^\d+]/g, "")) + '">☎ Llamar</a>' : "");
    var filas = [
      ["Correo", esc(s.correo)], ["WhatsApp", esc(s.whatsapp || "—")], ["Solución", esc(L.solucion[s.solucion] || s.solucion)],
      ["Tamaño", esc(s.tamano || "—")], ["Cómo nos conoció", esc(L.fuente[s.fuente] || "—")],
      ["Recibida", fecha(s.created_at, true)], ["Origen", s.origen === "manual" ? "Creada a mano" : "Formulario web · " + esc(s.pagina_origen || "")],
      ["Primera respuesta", s.primer_contacto_at ? fecha(s.primer_contacto_at, true) + " (" + duracion(new Date(s.primer_contacto_at) - new Date(s.created_at)) + ")" : "Pendiente"],
      ["Autorización de datos", s.acepta_datos ? "Sí · " + fecha(s.acepta_datos_at, true) : "No"],
      ["Correos automáticos", s.origen === "manual" ? "—" : (s.correo_aviso_enviado ? "aviso ✓" : "aviso ✗") + " · " + (s.correo_respuesta_enviado ? "confirmación ✓" : "confirmación ✗")]
    ];
    if (s.utm) filas.push(["Campaña", esc(Object.keys(s.utm).map(function (k) { return k.replace("utm_", "") + ": " + s.utm[k]; }).join(" · "))]);
    if (s.cerrada_at) filas.push(["Cerrada", fecha(s.cerrada_at, true)]);
    $("#d-datos").innerHTML = filas.map(function (f) { return "<dt>" + f[0] + "</dt><dd>" + f[1] + "</dd>"; }).join("");
    $("#d-mensaje").textContent = s.mensaje;

    $("#s-etapa").value = s.etapa; $("#s-prioridad").value = s.prioridad;
    $("#s-valor").value = s.valor_estimado != null ? fmtNum.format(s.valor_estimado) : "";
    $("#s-accion").value = s.proxima_accion || ""; $("#s-fecha").value = s.proxima_accion_fecha || "";
    $("#s-motivo").value = s.motivo_cierre || ""; $("#s-detalle").value = s.cierre_detalle || "";
    mostrarCierre();
    if (!refrescar) { $("#seg-msg").textContent = ""; $("#a-fecha").value = ahoraLocal(); $("#a-desc").value = ""; }

    if (!refrescar) {
      $("#drawer").hidden = false; $("#d-bg").hidden = false; document.body.classList.add("no-scroll");
      $("#d-cerrar").focus();
    }
    cargarActividades(s.id);
  }
  function ahoraLocal() {
    var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
  function cerrar() {
    $("#drawer").hidden = true; $("#d-bg").hidden = true; document.body.classList.remove("no-scroll"); actual = null;
  }
  $("#d-cerrar").addEventListener("click", cerrar);
  $("#d-bg").addEventListener("click", cerrar);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#drawer").hidden) cerrar(); });

  function mostrarCierre() {
    var c = !!CERRADAS[$("#s-etapa").value];
    document.querySelectorAll("#f-seg .cierre").forEach(function (n) { n.hidden = !c; });
  }
  $("#s-etapa").addEventListener("change", mostrarCierre);

  $("#f-seg").addEventListener("submit", async function (e) {
    e.preventDefault();
    var msg = $("#seg-msg");
    var etapa = $("#s-etapa").value, cerrada = !!CERRADAS[etapa];
    var valorTxt = $("#s-valor").value.replace(/\D/g, "");
    var cambios = {
      etapa: etapa,
      prioridad: $("#s-prioridad").value,
      valor_estimado: valorTxt ? Number(valorTxt) : null,
      proxima_accion: $("#s-accion").value.trim() || null,
      proxima_accion_fecha: $("#s-fecha").value || null,
      motivo_cierre: cerrada ? ($("#s-motivo").value || null) : null,
      cierre_detalle: cerrada ? ($("#s-detalle").value.trim() || null) : null
    };
    if (cerrada && !cambios.motivo_cierre) { msg.textContent = "Elige el motivo de cierre."; msg.className = "msg error"; $("#s-motivo").focus(); return; }
    if (etapa === "ganada" && !cambios.motivo_cierre) cambios.motivo_cierre = "cliente_ganado";
    msg.textContent = "Guardando…"; msg.className = "msg";
    var r = await sb.from("pascalia_solicitudes").update(cambios).eq("id", actual.id).select().single();
    if (r.error) { msg.textContent = "No se guardó: " + r.error.message; msg.className = "msg error"; return; }
    msg.textContent = "Guardado ✓";
    var i = todas.findIndex(function (s) { return s.id === r.data.id; }); todas[i] = r.data; actual = r.data;
    pintar(); abrir(r.data, true);
  });

  async function cargarActividades(id) {
    var ol = $("#d-timeline"); ol.innerHTML = '<li class="muted small">Cargando…</li>';
    var r = await sb.from("pascalia_actividades").select("*").eq("solicitud_id", id).order("fecha", { ascending: false });
    if (!actual || actual.id !== id) return;
    if (r.error) { ol.innerHTML = '<li class="error small">No se pudo cargar la bitácora.</li>'; return; }
    var items = (r.data || []).map(function (a) {
      return '<li class="tl tl-' + a.tipo + '"><span class="tl-t">' + esc(L.tipo[a.tipo] || a.tipo) + " · " + fecha(a.fecha, true) + "</span><p>" + esc(a.descripcion) + "</p></li>";
    });
    items.push('<li class="tl tl-sistema"><span class="tl-t">Solicitud recibida · ' + fecha(actual.created_at, true) + "</span></li>");
    ol.innerHTML = items.join("");
  }

  $("#f-act").addEventListener("submit", async function (e) {
    e.preventDefault();
    var desc = $("#a-desc").value.trim(); if (!desc || !actual) return;
    var f = $("#a-fecha").value ? new Date($("#a-fecha").value).toISOString() : new Date().toISOString();
    var r = await sb.from("pascalia_actividades").insert({ solicitud_id: actual.id, tipo: $("#a-tipo").value, fecha: f, descripcion: desc });
    if (r.error) { toast("No se guardó la actividad: " + r.error.message, true); return; }
    $("#a-desc").value = "";
    toast("Actividad agregada");
    await cargar();
  });

  $("#b-eliminar").addEventListener("click", async function () {
    if (!actual || !confirm("¿Eliminar definitivamente la solicitud " + actual.radicado + " y su bitácora? Úsalo solo para spam o duplicados.")) return;
    var r = await sb.from("pascalia_solicitudes").delete().eq("id", actual.id);
    if (r.error) { toast("No se eliminó: " + r.error.message, true); return; }
    toast("Solicitud eliminada"); cerrar(); await cargar();
  });

  // ---------- nueva manual ----------
  $("#b-nueva").addEventListener("click", function () { $("#f-nueva").reset(); $("#nueva-msg").textContent = ""; $("#dlg-nueva").showModal(); });
  $("#f-nueva").addEventListener("submit", async function (e) {
    if (e.submitter && e.submitter.value === "cancel") return;
    e.preventDefault();
    var f = e.target, msg = $("#nueva-msg");
    if (!f.reportValidity()) return;
    var r = await sb.from("pascalia_solicitudes").insert({
      origen: "manual", radicado: "", nombre: f.nombre.value.trim(), correo: f.correo.value.trim().toLowerCase(),
      whatsapp: f.whatsapp.value.trim() || null, solucion: f.solucion.value, tamano: f.tamano.value.trim() || null,
      fuente: f.fuente.value || null, mensaje: f.mensaje.value.trim(), acepta_datos: f.acepta_datos.checked
    }).select().single();
    if (r.error) { msg.textContent = "No se creó: " + r.error.message; msg.className = "msg error"; return; }
    $("#dlg-nueva").close(); toast("Solicitud " + r.data.radicado + " creada");
    await cargar(); abrir(todas.find(function (s) { return s.id === r.data.id; }));
  });

  // ---------- CSV ----------
  $("#b-csv").addEventListener("click", function () {
    var cols = [
      ["Radicado", "radicado"], ["Recibida", function (s) { return fecha(s.created_at, true); }], ["Origen", "origen"], ["Nombre", "nombre"], ["Correo", "correo"],
      ["WhatsApp", "whatsapp"], ["Solución", function (s) { return L.solucion[s.solucion]; }], ["Tamaño", "tamano"],
      ["Cómo nos conoció", function (s) { return L.fuente[s.fuente] || ""; }], ["Mensaje", "mensaje"],
      ["Etapa", function (s) { return L.etapa[s.etapa]; }], ["Prioridad", function (s) { return L.prioridad[s.prioridad]; }],
      ["Valor estimado (COP)", "valor_estimado"], ["Próxima acción", "proxima_accion"], ["Fecha próxima acción", "proxima_accion_fecha"],
      ["Primera respuesta", function (s) { return s.primer_contacto_at ? fecha(s.primer_contacto_at, true) : ""; }],
      ["Horas a primera respuesta", function (s) { return s.primer_contacto_at ? Math.round((new Date(s.primer_contacto_at) - new Date(s.created_at)) / 360000) / 10 : ""; }],
      ["Motivo de cierre", function (s) { return L.motivo[s.motivo_cierre] || ""; }], ["Detalle de cierre", "cierre_detalle"],
      ["Cerrada", function (s) { return s.cerrada_at ? fecha(s.cerrada_at, true) : ""; }], ["Página", "pagina_origen"]
    ];
    var celda = function (v) { v = v == null ? "" : String(v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lineas = [cols.map(function (c) { return c[0]; }).join(";")].concat(filtradas.map(function (s) {
      return cols.map(function (c) { return celda(typeof c[1] === "function" ? c[1](s) : s[c[1]]); }).join(";");
    }));
    var blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "solicitudes-pascalia-" + hoyISO() + ".csv"; a.click(); URL.revokeObjectURL(a.href);
  });

  // ---------- filtros ----------
  opciones($("#f-etapa"), [["_abiertas", "Solo abiertas"]].concat(ETAPAS), "Todas las etapas");
  opciones($("#f-solucion"), SOLUCIONES, "Todas las soluciones");
  opciones($("#f-prioridad"), PRIORIDADES, "Todas las prioridades");
  opciones($("#f-fuente"), FUENTES, "Todas las fuentes");
  opciones($("#s-etapa"), ETAPAS); opciones($("#s-prioridad"), PRIORIDADES); opciones($("#s-motivo"), MOTIVOS, "Elige un motivo");
  opciones($("#a-tipo"), TIPOS); opciones($("#n-solucion"), SOLUCIONES, "Elige"); opciones($("#n-fuente"), FUENTES, "Sin dato");
  ["#f-q", "#f-periodo", "#f-etapa", "#f-solucion", "#f-prioridad", "#f-fuente", "#f-vencidas", "#f-orden"].forEach(function (s) {
    $(s).addEventListener(s === "#f-q" ? "input" : "change", pintar);
  });
  $("#b-limpiar").addEventListener("click", function () {
    $("#f-q").value = ""; $("#f-periodo").value = "todo"; ["#f-etapa", "#f-solucion", "#f-prioridad", "#f-fuente"].forEach(function (s) { $(s).value = ""; });
    $("#f-vencidas").checked = false; pintar();
  });
  $("#b-recargar").addEventListener("click", function () { cargar().then(function () { toast("Datos actualizados"); }); });
  $("#s-valor").addEventListener("blur", function () {
    var d = this.value.replace(/\D/g, ""); this.value = d ? fmtNum.format(Number(d)) : "";
  });
  setInterval(function () { if (!$("#v-app").hidden && document.visibilityState === "visible") cargar(); }, 120000);

  sb.auth.getSession().then(function (r) { arrancar(r.data.session); });
})();
