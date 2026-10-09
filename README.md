# pascalia-web

Sitio web de **PascalIA** — *Ideas que hacen florecer tu organización*. Consultoría, desarrollo y capacitación en inteligencia artificial a la medida de organizaciones y personas.

Publicado en https://pascalia.lat con GitHub Pages: `.github/workflows/pages.yml` publica cada push a `main`. HTML + CSS estático, sin build.

| Ruta | Contenido |
|------|-----------|
| `/` | Portada de PascalIA: servicios, soluciones (Suite de Salud Pública), CuentaFacil, cómo trabajamos, valores y contacto |
| `/cuentafacil/` | Página del producto CuentaFacil (cuentas de cobro de contratistas por WhatsApp) |

## Ver en local

```
python3 -m http.server 8000
```

y abrir http://localhost:8000.

## Identidad visual

- Colores: amarillo PascalIA `#FFC107`, gris grafito `#1F1F1F`, gris claro `#E9E8E9`, crema `#FFF8E1` (variables en `pascalia.css`). Para texto amarillo sobre fondo claro se usa `--gold-text` (`#8A6100`) por contraste.
- Tipografía: Montserrat (Google Fonts).
- Logo: `flower.svg` (flor) + palabra "Pascal**IA**" con "IA" en amarillo; `flower-outline.svg` para las flores de fondo.
- `styles.css` es solo para `/cuentafacil/`, que conserva su propia identidad de producto (verde).

## Notas

- `CNAME` asocia el sitio a `pascalia.lat`. El DNS está en Porkbun (registros `A`/`AAAA` de GitHub Pages y `www` → `danto0702.github.io`).
- Contacto: `contacto@pascalia.lat` (reenvío de correo de Porkbun).
- La política de tratamiento de datos se publicará cuando la revise un abogado.
