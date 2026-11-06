# Cumplimiento obligatorio — todas las páginas y productos de PascalIA

Toda página nueva (producto, demo, subpágina) debe cumplir esto **antes de publicarse**.
El paso «Verificar cumplimiento» de `.github/workflows/pages.yml` (`.github/scripts/cumplimiento.py`) bloquea la publicación si falta lo automatizable.

## Automático (lo revisa CI)
- `<script src="/legal.js" defer></script>` en el `<head>`: banner de cookies (aceptar/rechazar con el mismo peso, configurar), franja legal con datos del negocio y enlaces, enlace «Saltar al contenido» y foco visible. Herramientas internas pueden ocultar la franja con `<body data-sin-franja-legal>`, nunca el banner.
- `<html lang="es-CO">`, `alt` en toda `<img>` (`alt=""` si es decorativa).
- Existen: `/politica-de-datos/`, `/terminos/`, `/reembolsos/`, `/politica-de-cookies/`, `/eliminar-mis-datos/`, `/aviso-legal/`.
- Analítica, píxeles o SDK de seguimiento solo detrás de `PascaliaConsent.permitido("analitica")`.

## Manual (revisar en cada cambio)
- **Formularios:** casilla de autorización sin marcar, enlace a la política, «soy mayor de 18 años»; pedir solo los datos necesarios para el fin.
- **Menores:** servicios para mayores de 18. Si un producto involucra niños, el adulto responsable autoriza (consentimiento parental).
- **Correos:** pie con responsable, enlace de baja, cabecera `List-Unsubscribe` y enlace a `/eliminar-mis-datos/`.
- **Precios:** valor total en COP antes de cobrar; nada de cargos ocultos, renovaciones automáticas no avisadas ni casillas premarcadas.
- **Patrones oscuros:** nada de urgencia falsa, contadores inventados, «confirmshaming», cancelación más difícil que la compra.
- **Afirmaciones:** sin reseñas ni testimonios inventados; cifras y promesas solo con respaldo; demos marcadas como ficticias.
- **Accesibilidad:** contraste AA (4,5:1 texto normal), todo usable con teclado, foco visible, etiquetas en campos.
- **SDK de terceros:** listar cualquier CDN o servicio nuevo en `/politica-de-cookies/` y su licencia en `/aviso-legal/`.
- **Imágenes y fuentes:** solo propias o con licencia que permita uso comercial; registrar créditos en `/aviso-legal/`.
- **Datos del negocio y políticas:** si cambian responsable, domicilio o precios, actualizar `legal.js`, las políticas y la fecha de versión.
- Los textos legales nuevos marcados como borrador deben pasar revisión de abogado.
