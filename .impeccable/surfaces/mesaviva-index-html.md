---
version: 1
slug: "mesaviva-index-html"
primary_target: "mesaviva/index.html"
related_targets: []
---

# MesaViva · página de venta (pascalia.lat/mesaviva/)

Scope: `mesaviva/index.html` + `mesaviva/mesaviva.css` + `mesaviva/mesaviva.js`; la demo publicada en `mesaviva/demo/`. Modo: Persuade.

Audiencia y trabajo: dueño o administrador de restaurante o comida rápida, desde el celular; debe entender qué hace MesaViva, ver que funciona (demo) y dejar sus datos para cotizar. Prueba: la demo en vivo (simulada, marcada). Sin clientes, cifras ni testimonios; MesaViva está en desarrollo y se dice.

Marco: menú y pie de PascalIA (sitio.css) y formulario de contacto del sitio; el contenido usa el mundo de MesaViva (transmisión nocturna, #07080C, Brasa/Ámbar/Esmeralda, Space Grotesk + Plus Jakarta Sans) como banda oscura de submarca, igual que CuentaFacil tiene su acento.

Decisiones abiertas: número de WhatsApp de ventas de MesaViva (pendiente en Meta): el CTA usa el formulario del sitio; la opción "mesaviva" del formulario requiere desplegar la función `pascalia-solicitud` (pedir permiso al dueño); mientras tanto el formulario usa "desarrollo" con el resumen del plan en el mensaje.

## Direction contract

THESIS: La página es un configurador que funciona en el primer pantallazo: respondes cuatro cosas de tu negocio y el marcador te dice qué plan de MesaViva necesitas y por qué, con la cotización lista para enviar. Rechaza el hero de titular + botón + fila de tarjetas iguales.

OWN-WORLD: Banda oscura #07080C bajo el menú claro de PascalIA; el resultado del plan vive en un marcador de transmisión (vidrio, cifras split-flap en Space Grotesk, barra Esmeralda); controles como chips y steppers de la demo; listas de "alineación" con dorsal para módulos en vez de tarjetas; Brasa solo para acción.

STORY: Entiendo en una línea que mi mesa y mi caja ven lo mismo en vivo; armo mi plan en 20 segundos; pruebo la demo en un celular; veo módulos, cálculo al peso y facturación DIAN con proveedor autorizado; pido cotización con mi plan ya escrito.

FIRST VIEWPORT: Escritorio: izquierda ~45 % titular grande "Tu mesa y tu caja, en vivo." + una línea + enlace a la demo; derecha ~55 % el configurador: mesas (stepper), cajas (chips), sedes (chips), cuatro interruptores (pedidos por WhatsApp, mesa NFC y pago por persona, domicilios, nómina) y debajo el marcador con el plan recomendado, el porqué y el botón Brasa "Pedir cotización". Celular: titular corto y el configurador debajo, el marcador fijo al pie de la tarjeta.

FORM: "Arma tu plan", primera estructura repartida (seed key 0cc110dc, roll degradado sin retadores), elegida por el dueño. Firma: el marcador del plan cambia con efecto split-flap a cada respuesta. Ruta: code-led.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
