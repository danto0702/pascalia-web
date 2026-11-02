# PascalPDF · servidor de firmas a otras personas

Va en el **proyecto Supabase de CuentaFacil** (no en el de SI-APS que usa el formulario de contacto). Tablas aisladas con el prefijo `pascalpdf_`, sin políticas RLS: solo la función, con la llave de servicio, lee y escribe.

## Qué guarda
- `pascalpdf_solicitudes`: quién pide, quién firma (nombres y correos), nombre y tipo del documento, huellas SHA-256 del documento enviado y del firmado, fechas de creación, verificación del correo y firma, identificador de la firma.
- `pascalpdf_codigos`: códigos de un solo uso del remitente (solo su huella; vencen en 10 minutos y se borran a los 2 días).
- Bucket privado `pascalpdf-sobres`: el PDF **cifrado** (AES-256-GCM) antes y después de firmar. La clave va solo en el enlace que el remitente comparte (después del `#`, que el navegador nunca envía al servidor). Se borra al firmarse (original), al cancelarse o a los 7 días (firmado).

## Desplegar (pide aprobación del dueño: cambia el esquema de producción)
1. Migración: `supabase db push` con `migrations/20261102_pascalpdf_firmas.sql`, o pegarla en el editor SQL del proyecto.
2. Secretos de la función:
   - `PASCALPDF_SECRETO`: cadena aleatoria larga (p. ej. `openssl rand -base64 48`).
   - `RESEND_API_KEY`: la misma de pascalia.lat (dominio verificado).
   - `PASCALPDF_FROM` (opcional): por defecto `PascalPDF <contacto@pascalia.lat>`.
3. Función: `supabase functions deploy pascalpdf-firma --no-verify-jwt` desde `supabase/pascalpdf/` (el navegador la llama sin sesión, igual que `pascalia-solicitud`).
4. Activar en la app: poner la URL de la función en `PascalPDF_Studio/config.js`:
   `window.PASCALPDF_API = 'https://<ref>.supabase.co/functions/v1/pascalpdf-firma';`
   Mientras esté vacía, la opción «Pedir firma a otra persona» no aparece.

## Límites
20 solicitudes por remitente al día · 5 códigos por correo por hora · 5 intentos por código · 5 envíos de código por solicitud · documentos de hasta 25 MB · vigencia de 7 días.

## Pruebas
`functions/pascalpdf-firma/logica.ts` no depende de Deno ni de Supabase: se probó de punta a punta con un servidor simulado en Node (`node --experimental-strip-types`) y el navegador (remitente en escritorio, firmante en iPhone). La migración se probó en Postgres 16 (aplicada dos veces).
