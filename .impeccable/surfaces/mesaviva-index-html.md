---
version: 1
slug: "mesaviva-index-html"
primary_target: "mesaviva/index.html"
related_targets: []
---

# MesaViva · página de venta (pascalia.lat/mesaviva/)

Scope: `mesaviva/index.html` + `mesaviva/mesaviva.css` + `mesaviva/mesaviva.js`, imágenes en `mesaviva/img/`; la demo publicada en `mesaviva/demo/` (su propio rediseño vive en el repo mesaviva). Modo: Persuade.

Audiencia y trabajo: dueño o administrador de restaurante o comida rápida, desde el celular; entiende qué hace MesaViva, ve que funciona (demo) y deja sus datos para cotizar con el plan ya armado. Prueba: la demo en vivo (simulada, marcada) y reglas de cálculo verificables. Sin clientes, logos, cifras de uso ni testimonios (decisión del dueño 2026-10-26: las secciones de testimonios, logos y cifras del prompt se cambian por pruebas reales). MesaViva está en desarrollo y se dice.

Rediseño 2026-10-26: el dueño rechazó "Partido en vivo" (no conecta con la imagen de PascalIA, se ve genérica). Mundo fijado por el dueño: hoja de marca PascalIA (flor de seis pétalos redondos con nodos, paleta #FFC107/#FFB300/#FFD54F/#1F1F1F/#E9E9E9/#FFF8E1/#FFFFFF/#5C5C5C, Montserrat 800 + Inter 400/500, Pascal en 3D, chips de sugerencia, botón play, mockups blancos) y el prompt "PROMPTS_LANDING_PASCALIA" (estructura y efectos estilo Passionfroot). Sitio estático, sin Next.js. Personajes recortados de la hoja de marca hasta tener PNG en alta.

## Direction contract

THESIS: MesaViva se vende como lo que es: una idea de PascalIA que florece en tu restaurante. La página conversa: le cuentas a Pascal tu negocio en la barra del hero y el plan sale armado; luego ves la mesa, la cuenta al peso y la caja funcionando. Rechaza el hero oscuro de transmisión y el split de titular + tarjeta.

OWN-WORLD: Blanco con secciones crema #FFF8E1, grafito para la tarjeta del plan recomendado (el resultado del configurador, como el banner oscuro de la hoja de marca), la franja de reglas, el cierre y el pie. Amarillo PascalIA solo para acción, marcador bajo palabras clave y la flor-red; texto sobre amarillo siempre grafito. Píldoras 999px, tarjetas 20–24px, bordes 1px #E9E9E9, sombras cálidas. Flor de seis pétalos redondos translúcidos con nodos blancos conectados, gigante y girando detrás del hero. Pascal 3D señalando la barra.

STORY: Entiendo en una línea que mesa y caja ven lo mismo en vivo; le escribo a Pascal o toco un chip y me responde con mi plan; veo tres mockups que se arman solos (pedir, dividir al peso, aprobar y facturar); recorro cómo arranco; ajusto el plan y pido cotización con el plan ya escrito.

FIRST VIEWPORT: Centrado. Chip "● Hecho por PascalIA · en desarrollo con los primeros restaurantes". H1 Montserrat 800 "Tu mesa y tu caja, en vivo." con "en vivo" en marcador amarillo que se dibuja. Subtítulo. CTAs: "Arma tu plan →" primario y "▶ Ver la demo" (abre la demo en modal de celular). Debajo, la barra "Cuéntale a Pascal…" con placeholder que se escribe solo, botón circular amarillo, tres pestañas con indicador deslizante (Restaurante · Comida rápida · Café o comercio) y chips. Pascal de pie a la izquierda señalando la barra (escritorio; el único recorte de la hoja de marca señala hacia la derecha). Flor gigante semitransparente detrás.

FORM: Estructura del prompt PascalIA/Passionfroot, fijada por el dueño (sin tirada de concept-seed; dirección fijada). Firma: Pascal responde en la barra con el plan recomendado y llena el configurador y el formulario. Ruta: code-led.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
