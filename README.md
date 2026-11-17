# pascalia-web

Sitio web de **PascalIA** — *Ideas que hacen florecer tu organización*. Consultoría, desarrollo y capacitación en inteligencia artificial a la medida de organizaciones y personas.

Publicado en https://pascalia.lat con GitHub Pages: `.github/workflows/pages.yml` publica cada push a `main`. HTML + CSS estático, sin build.

| Ruta | Contenido |
|------|-----------|
| `/` | Portada de PascalIA: servicios, soluciones (Suite de Salud Pública), CuentaFacil, cómo trabajamos, valores y contacto |
| `/desarrollos/` | Desarrollos a la medida para empresas: NFC, web, menús, dashboards, WhatsApp, lectura de documentos, documentos automáticos, CRM, reservas y apps de campo |
| `/flota/` | Solución Flota Vehicular: itinerario, marcas con GPS desde el celular, días de operación y planilla |
| `/nana-dnt/` | NANA DNT: seguimiento nutricional infantil (desnutrición aguda en menores de 5 años), con su marca azul y dorado |
| `/si-aps/` | SI-APS: caracterización sociofamiliar e individual en terreno y archivo plano APS124CCFP para PISIS |
| `/mision-medica/` | Misión Médica: infracciones, carnet con QR, emblemas, capacitación DIH, riesgos, desplazamientos e inspección. Logotipo del módulo en `mision-medica/logo-*.png` (bordes redondeados) |
| `/fanatikos/` | Fanátikos: gestión de campeonatos de fútbol aficionado (tabla, planilla arbitral, actas PDF, afiches para redes). Demo en `/fanatikos/demo/` (`noindex`, un solo HTML; lo que se hace se guarda solo en el navegador) |
| `/pv-car/` | Página del producto PV Car · Pascal Video Car: qué hace, calculadora de horas según la memoria, comandos de voz, cómo se usa, preguntas y formulario. Capturas reales de la demo (escena de carretera simulada) en `pv-car/img/` |
| `/pv-car/terminos/` | Términos y condiciones de PV Car, versión 1.0, **borrador pendiente de revisión jurídica**. La demo guarda la versión aceptada (`TERMINOS` en `pv-car/demo/js/app.js`) y la vuelve a pedir si cambia: al publicar una versión nueva, súbela en los dos lugares |
| `/pv-car/demo/` | Demo de PV Car · Pascal Video Car: cámara vehicular en bucle, copiloto «Hola Pascal», sensor de impacto y bóveda con SHA-256 y acta PDF. Es una PWA que funciona sin conexión (`sw.js` con alcance `/pv-car/demo/`); `noindex` y fuera del sitemap. Lo grabado queda solo en el navegador. El código fuente vive en el repositorio `PVCar`: copiar desde allí al actualizar y subir `VERSION` en `sw.js` |
| `/cuentafacil/` | Página del producto CuentaFacil (cuentas de cobro de contratistas por WhatsApp) |
| `/politica-de-datos/` | Política de tratamiento de datos personales (Ley 1581 de 2012), versión 1.1 aprobada por el abogado |
| `/terminos/` | Términos y condiciones del servicio CuentaFacil, versión 1.0 |
| `/pascal/` | Página de expectativa de Pascal (destino del QR del teaser «POV: Día 30»): sin menú ni enlaces, `noindex` y fuera del sitemap hasta el lanzamiento oficial |

## Solicitudes (formulario y tablero)

- **Formulario** (`contacto.js` + `contacto.css`): se monta en cada `<div data-pascalia-form data-solucion="...">` y envía a la función de Supabase `pascalia-solicitud` (`supabase/functions/`), que valida, frena spam (campo trampa, tiempo mínimo y límite de envíos), guarda en `pascalia_solicitudes` y envía con Resend el aviso a contacto@ y la confirmación a quien escribe.
- **Tablero** en `/panel/` (no indexado): ingreso con usuario de Supabase autorizado en `pascalia_admins`; indicadores, gráficas, filtros, detalle con etapa, prioridad, valor, próxima acción, motivo de cierre y bitácora; CSV para Excel. `panel/vendor/` trae supabase-js 2.45.4 (MIT) para no depender de una CDN.
- **Base de datos:** temporalmente en el proyecto Supabase *SI-APS HRNO*, aislada con prefijo `pascalia_` y RLS. SQL en `supabase/migrations/`. Para trasladarla, ver el encabezado de ese archivo.
- **Secretos de la función** (en Supabase → Edge Functions → Secrets): `RESEND_API_KEY`; opcionales `PASCALIA_FROM` y `PASCALIA_AVISO`.

## Ver en local

```
python3 -m http.server 8000
```

y abrir http://localhost:8000.

## Identidad visual

- Colores: amarillo PascalIA `#FFC107`, gris grafito `#1F1F1F`, gris claro `#E9E8E9`, crema `#FFF8E1` (variables en `pascalia.css`). Para texto amarillo sobre fondo claro se usa `--gold-text` (`#8A6100`) por contraste.
- Tipografía: Montserrat (Google Fonts).
- Logo: `flower.svg` (flor) + palabra "Pascal**IA**" con "IA" en amarillo; `flower-outline.svg` para las flores de fondo.
- `/cuentafacil/` usa `sitio.css` con el amarillo de PascalIA y su logo de calendario con chulo. El verde no hace parte de la paleta de PascalIA.

## Notas

- `CNAME` asocia el sitio a `pascalia.lat`. El DNS está en Porkbun (registros `A`/`AAAA` de GitHub Pages y `www` → `danto0702.github.io`).
- Contacto: `contacto@pascalia.lat` (reenvío de correo de Porkbun).
- La política de tratamiento de datos está en `/politica-de-datos/`. Si cambia, sube la versión y la fecha en la página (los contratistas aceptan una versión concreta en WhatsApp).
