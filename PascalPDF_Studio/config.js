// Dirección de la función que gestiona las solicitudes de firma a otras personas
// (Edge Function pascalpdf-firma, proyecto Supabase de CuentaFacil).
// Mientras esté vacía, la opción «Pedir firma a otra persona» no aparece en la app.
window.PASCALPDF_API = 'https://dfzoqenxvpqkzkuakmli.supabase.co/functions/v1/pascalpdf-firma';

// Convertidor Word → PDF con LibreOffice (servicio en Railway). Mientras esté vacío,
// los Word se convierten solo en el navegador (puede variar el formato).
window.PASCAL_CONVERTIDOR = '';
