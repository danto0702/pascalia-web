# PascalPDF · Plan del servicio con cuentas, firmas y pagos

Borrador 1 · 1 de noviembre de 2026 · Para revisión del dueño (no publicado)

Decisiones tomadas por el dueño:

- Tipo de firma: **firma electrónica** (Decreto 2364 de 2012). No se ofrece "firma digital certificada".
- Cobro: **planes mensuales y anuales + paquetes prepago**, con códigos promocionales, pagos por **Wompi**.
- Clientes: personas (contratistas e independientes), empresas y entidades, firmantes externos y firma por lotes.
- Inicio de sesión: **correo con código de un solo uso + Google**.
- Respuestas del 2 de noviembre de 2026: **no responsable de IVA** (precios sin IVA) y factura electrónica con la aplicación gratuita de la DIAN; **sí** se guarda la huella SHA-256 del documento; base de datos en el **proyecto Supabase de CuentaFacil** (tablas con prefijo `pascalpdf_` y RLS) hasta que el servicio sea rentable; opera **Danilo Orlando Torrado Blanco como persona natural**, con intención de constituir una S.A.S. más adelante.
- Las firmas (trazo o imagen) **se guardan solo en el dispositivo**. En la base de datos solo queda el registro de uso: fecha, hora, tipo de documento, nombre del documento e identificador de la firma. La persona puede descargar ese registro en un archivo plano.

---

## 1. Qué se vende

| Producto | Qué incluye |
|---|---|
| **Firma Rápida** | Abrir PDF, crear firmas (dibujada, escrita o imagen) guardadas en el dispositivo, estampar firma, fecha y sello de texto, rellenar campos, registro de firmas descargable (CSV/TXT), hoja de evidencia al final del PDF (opcional). |
| **Suite** | Todo lo anterior + editar texto del PDF, insertar imágenes y textos, anotaciones, redacción, gestión de páginas (unir, dividir, rotar, extraer), firma por lotes, exportar a imagen, formularios, marca de agua, y envío a **firmantes externos**. |
| **Empresas** | Suite para varios usuarios bajo una organización, administración de miembros, facturación centralizada, registro de firmas consolidado y descargable por la organización. |

Las funciones que hoy son solo demostración (OCR, conversión a Word/Excel/PowerPoint, comparación de versiones, cifrado con contraseña, "validación criptográfica", "certificado X.509", "sello TSA") **no se venden**: se ocultan o se marcan como "Próximamente" antes de cobrar (ver §6.1).

## 2. Precios propuestos (COP)

Referencias usadas: precios internacionales de firma electrónica (USD 10–25 al mes por usuario), capacidad de pago de un contratista (cuenta de cobro mensual, ingreso medio) y el costo de Wompi por transacción (≈ 2,65 % + $700 + IVA en la tarifa estándar; **verificar la tarifa vigente de tu cuenta**). Por eso no conviene vender transacciones muy pequeñas: el paquete mínimo es de $9.900.

| Plan | Mensual | Anual (2 meses gratis) | Límite razonable |
|---|---|---|---|
| **Gratis** | $0 | — | 3 documentos firmados al mes, con la hoja de evidencia obligatoria. Sirve para probar. |
| **Firma Rápida** | **$12.900** | **$129.000** | Documentos firmados ilimitados con uso razonable (hasta 300 al mes); 1 dispositivo de firmas por cuenta, más copia de respaldo. |
| **Suite** | **$29.900** | **$299.000** | Todo, firma por lotes hasta 50 documentos por lote, 20 envíos a firmantes externos al mes. |
| **Empresas** | **$24.900 por usuario** al mes (mínimo 3) | $249.000 por usuario al año | Suite para cada usuario, 50 envíos externos por usuario al mes, panel de la organización. |

Paquetes prepago (no vencen, para quien firma poco o necesita más envíos):

| Paquete | Precio |
|---|---|
| 10 documentos firmados (Firma Rápida, sin plan) | $9.900 |
| 40 documentos firmados | $29.900 |
| 20 envíos adicionales a firmantes externos | $14.900 |

Códigos promocionales: porcentaje o valor fijo, con vigencia, número máximo de usos total y por persona, y planes a los que aplican. Ejemplos de lanzamiento: `CUENTAFACIL` (usuarios de CuentaFacil: 1 mes de Firma Rápida gratis), `LANZAMIENTO` (30 % el primer mes), códigos por entidad o empresa.

Pendiente de definir contigo (preguntas al final): si los precios incluyen IVA y si se renuevan automáticamente.

## 3. Cómo funciona (arquitectura)

### 3.1 Cuenta e inicio de sesión
- **Supabase Auth**: código de un solo uso por correo (sin contraseña) e inicio con Google.
- Para usar la app con un plan de pago hay que iniciar sesión. Sin sesión, la app sigue funcionando como hoy, en modo gratis con su límite.
- **Base de datos (decidido):** el proyecto Supabase de **CuentaFacil**, con tablas `pascalpdf_*` aisladas por RLS, hasta que PascalPDF sea rentable. Una sola cuenta puede servir para ambos servicios. Para migrar después a un proyecto propio se exportan las tablas `pascalpdf_*`.

### 3.2 Firmas en el dispositivo
- La imagen de cada firma se guarda en **IndexedDB** del navegador, cifrada con una clave **no exportable** de WebCrypto (AES-GCM), ligada a ese navegador y dispositivo.
- Cada firma tiene un **identificador** (UUID), generado en el dispositivo. Ese identificador es lo único de la firma que conoce el servidor.
- **Riesgo que hay que explicar al usuario:** si borra los datos del navegador, cambia de celular o pierde el equipo, pierde sus firmas. Por eso se ofrece **"Exportar copia de respaldo"**: un archivo `.pascalfirma` cifrado con una frase que elige la persona, que puede importar en otro dispositivo. PascalIA nunca ve ni la frase ni la firma.
- En dispositivos compartidos (computador de una oficina), la opción "No guardar en este equipo" usa la firma solo durante la sesión.

### 3.3 Registro de firmas (lo que guarda la base de datos)
Tabla `signature_events`:

| Campo | Ejemplo | Nota |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | de Supabase Auth |
| `org_id` | uuid o vacío | si firma dentro de una empresa |
| `signed_at` | 2026-11-01 15:42:10-05 | fecha y hora del servidor (no la del dispositivo, que se puede manipular) |
| `document_type` | Cuenta de cobro · Contrato · Informe · Acta · Otro | lista corta + "Otro" |
| `document_name` | Cuenta_cobro_oct.pdf | lo escribe o confirma la persona |
| `signature_id` | uuid de la firma | |
| `document_hash` | SHA-256 del PDF firmado | **recomendado** (ver pregunta 3): no revela el contenido y permite probar después que un PDF es el mismo que se firmó |
| `pages` / `method` | 3 / dibujada | opcional |

- El PDF **nunca** se sube: se procesa en el navegador.
- **Descarga en archivo plano:** botón "Descargar mi registro" que genera **CSV** (para Excel) o **TXT**, filtrable por fechas, desde el navegador y con los datos de la cuenta.
- Además de este registro, la base de datos tiene necesariamente: la cuenta (correo, nombre, proveedor de inicio de sesión), el plan y las transacciones de pago (referencia de Wompi, valor, estado; **nunca** datos de tarjeta, que solo maneja Wompi), los códigos usados y, si aplica, la empresa. La política de datos lo dice así; no se puede prometer "solo el registro de firmas".

### 3.4 Hoja de evidencia (opcional, recomendada)
Al final del PDF firmado se agrega una página con: nombre de quien firma, correo verificado, fecha y hora del servidor, identificador de la firma, identificador del evento y huella SHA-256 del documento antes de firmar, más un enlace de verificación `pascalia.lat/PascalPDF_Studio/verificar` donde cualquiera puede comprobar si un PDF coincide con un evento registrado. La comprobación se hace en el navegador calculando la huella, sin subir el archivo. Esto da a la firma electrónica la "confiabilidad" que exige el Decreto 2364 de 2012.

### 3.5 Firma por lotes
Cargar varios PDF, elegir firma y posición (misma página y coordenadas, o "última página"), firmar todo en el navegador y descargar un ZIP. Se crea un evento por documento.

### 3.6 Firmantes externos
Es el único caso en que el documento tiene que salir del dispositivo, porque otra persona lo debe abrir. Propuesta que conserva la promesa de privacidad:

1. El navegador cifra el PDF con una clave aleatoria y sube **solo el archivo cifrado** a Storage privado.
2. El enlace que se envía al firmante lleva la clave después de `#`, una parte que el navegador nunca envía al servidor. PascalIA no puede leer el documento.
3. El firmante verifica su correo con un código, firma en su navegador y el resultado vuelve cifrado.
4. El archivo cifrado se **borra** al completarse o a los 7 días, lo que ocurra primero. Del firmante externo queda en la base de datos: correo, fecha y hora, tipo y nombre del documento, identificador y huella.

Esto se debe decir explícitamente en la política (pregunta 4).

### 3.7 Pagos con Wompi
- **Web Checkout** de Wompi, con la **firma de integridad** (SHA-256 de referencia + monto + moneda + secreto) calculada en una Edge Function, nunca en el navegador.
- El código promocional se valida **en el servidor**, que calcula el valor final antes de firmar la transacción.
- La activación del plan ocurre **solo** cuando llega el evento `transaction.updated` con estado `APPROVED`, verificado con el secreto de eventos. Nunca por la redirección del navegador.
- **Renovación:** Wompi no tiene suscripciones automáticas sencillas. Fase 1: pagos mensuales o anuales **sin renovación automática**, con aviso por correo 5 días antes. Fase 2 (opcional): tarjeta guardada como *payment source* tokenizada en Wompi y cobro programado, con aceptación expresa y cancelación en un clic.
- Medios: tarjeta, PSE, Nequi, Bancolombia, según lo que tenga activo tu cuenta.
- **Factura electrónica DIAN** por cada venta (ver §5.6).

### 3.8 Empresas
Organización con dueño y miembros invitados por correo. El dueño ve el registro consolidado de firmas de su organización, nunca las firmas en sí, porque esas están en cada dispositivo. Compra de puestos con Wompi o, para entidades públicas, por cotización y factura.

### 3.9 Límites y abuso (uso masivo)
- Límites por plan aplicados en el servidor al crear eventos y envíos.
- Límite de solicitudes por usuario e IP en las Edge Functions; protección contra bots en el envío de códigos.
- Los envíos a firmantes externos tienen tope diario, para que el servicio no se use para spam.

## 4. Fases

| Fase | Contenido | Condición para avanzar |
|---|---|---|
| **0. Limpieza honesta** (hecha el 2 de noviembre de 2026) | Quitar o marcar "Próximamente" todo lo simulado; renombrar "Firma Digital Certificada" a "Firma electrónica"; hoja de evidencia; firmas en IndexedDB cifrado; copia de respaldo. | Revisión tuya. Se puede publicar sin cobrar. |
| **1. Cuentas y registro** | Proyecto Supabase propio, inicio con correo y Google, tabla de eventos, descarga CSV/TXT, verificación pública, política y términos publicados con aceptación registrada. | Aprobar el costo de Supabase y los textos legales. |
| **2. Pagos** | Wompi (sandbox, luego producción), planes, paquetes, códigos promocionales, facturación electrónica, correos de recibo y de vencimiento. | Cuenta Wompi de producción y emisión de factura electrónica resuelta. |
| **3. Suite completa** | Firma por lotes y firmantes externos cifrados. | Fase 2 estable. |
| **4. Empresas** | Organizaciones, puestos y panel consolidado. | Demanda real. |

## 5. Evaluación legal (Colombia)

> Esto es un análisis para orientar decisiones, no una opinión legal. Antes de cobrar conviene que un abogado revise los términos y la política, sobre todo las secciones de responsabilidad, consumidor y transferencia internacional.

### 5.1 Validez de la firma (Ley 527 de 1999, Decreto 2364 de 2012, compilado en el Decreto 1074 de 2015)
- La **firma electrónica** es válida si es **confiable y apropiada** para el fin. Se presume confiable si los datos de creación están bajo el control exclusivo del firmante y permite detectar alteraciones posteriores. Las firmas guardadas solo en el dispositivo, el correo verificado y la huella SHA-256 con verificación pública apoyan ambos requisitos.
- Pero **no es firma digital** (art. 28 de la Ley 527): no lleva certificado de una entidad acreditada ante ONAC y **no tiene la presunción legal** de autenticidad e integridad de la firma digital. En caso de disputa, quien la alega debe probarla con la evidencia (registro, huella, correo).
- **Consecuencia práctica:** algunos trámites exigen firma digital certificada (ciertos actos ante la DIAN, notariales, algunos de contratación estatal o lo que pida cada entidad). Los términos deben decir que el usuario verifica si su trámite acepta firma electrónica. En el caso de los contratistas, la mayoría de entidades aceptan informes firmados electrónicamente en SECOP II, pero eso depende de cada entidad.
- **La app hoy afirma cosas falsas** ("Certificado X.509", "Sello TSA", "Firma Digital Certificada", "Validación criptográfica exitosa", "Cifrado AES-256"). Cobrar con esas afirmaciones sería **publicidad engañosa** (Ley 1480 de 2011, arts. 29–33) y podría dar a entender firma digital certificada sin acreditación. Por eso la Fase 0 va primero.

### 5.2 Protección de datos (Ley 1581 de 2012, Decreto 1377 de 2013)
- Datos tratados: identificación y contacto (correo, nombre), registro de firmas (metadatos de documentos), pagos (sin datos de tarjeta), datos técnicos. El **nombre del documento** puede revelar información sensible (p. ej. "Historia_clinica_Juan.pdf"): la app sugiere nombres genéricos y avisa antes de registrar.
- **La imagen de la firma no llega al servidor.** Es un dato biométrico solo si se captura la dinámica del trazo (presión, velocidad), y aquí no se captura. Aun así, al estar solo en el dispositivo, sale del tratamiento de PascalIA.
- **Firmantes externos:** son titulares distintos del usuario. Se necesita aviso de privacidad para ellos en la página de firma y aceptación antes de firmar.
- **Transferencia internacional:** Supabase (EE. UU./Canadá), Google (inicio de sesión), Resend (correo) y Wompi (Colombia). Se requiere autorización expresa, como ya hace la política de CuentaFacil.
- **Registro Nacional de Bases de Datos (RNBD):** hoy es obligatorio solo para personas jurídicas o naturales con activos superiores a 100.000 UVT. Como persona natural probablemente no aplica, pero **verifícalo**.
- **Retención del registro:** el registro es la evidencia del usuario. Propuesta: se conserva mientras la cuenta esté activa y **5 años** después de la última firma, salvo que el titular pida borrarlo; antes de borrar, la app le ofrece descargarlo (pregunta 5).
- **Seguridad:** RLS en todas las tablas, cifrado en tránsito y reposo, sin datos personales en los registros técnicos, registro de accesos administrativos.
- **Empresas:** frente a los datos de sus empleados, la empresa es responsable y PascalIA es encargado. Hace falta una cláusula de encargo (transmisión) en los términos para empresas.

### 5.3 Consumidor (Ley 1480 de 2011, Decreto 1499 de 2014 sobre comercio electrónico)
- **Derecho de retracto** (art. 47): 5 días hábiles en ventas a distancia. Para contenido digital que empieza a usarse de inmediato, puede excluirse si la persona lo acepta expresamente al pagar ("Quiero usar el plan ya y entiendo que pierdo el retracto"). Hay que ponerlo en el pago.
- **Reversión del pago** (art. 51): aplica a pagos con tarjeta o medios electrónicos por fraude o servicio no prestado. Hay que tener un canal para atenderla.
- **Información previa obligatoria:** precio total con impuestos, condiciones, duración, renovación y forma de cancelar, visible antes de pagar.
- **Renovación automática** (si se usa en la Fase 2): solo con aceptación expresa, aviso previo y cancelación sencilla.
- **Ley 2300 de 2023:** horarios y canales para mensajes comerciales. Los correos promocionales solo con autorización y con opción de darse de baja.

### 5.4 Responsabilidad
- PascalIA no verifica la identidad civil de quien firma; solo verifica que controla el correo. Los términos deben decir que el usuario es responsable de usar solo firmas propias o con autorización, y del contenido que firma, en línea con el principio de CuentaFacil.
- Limitar la responsabilidad al valor pagado en los últimos 12 meses, sin excluir lo que la ley no permite excluir frente a consumidores.
- Prohibir: firmar en nombre de otros sin autorización, falsificar, usar la firma de terceros, cargar documentos ilícitos, spam a firmantes externos.

### 5.5 Uso masivo y entidades públicas
- Las entidades públicas compran por contratación estatal (mínima cuantía o contratación directa), con factura, RUT y, a veces, póliza. Los términos de Empresas deben permitir un **contrato particular** que prevalezca.
- Ante una disputa, la evidencia (registro, huella, hoja de evidencia) debe poder entregarse; hay que definir el procedimiento para responder a requerimientos de autoridades.
- Disponibilidad: sin compromiso de nivel de servicio (SLA) en planes de personas; en Empresas, si lo piden, se negocia.

### 5.6 Tributario
- Vender en línea requiere **factura electrónica DIAN** por cada pago (sistema gratuito de la DIAN o un proveedor tecnológico).
- **IVA 19 %:** los servicios digitales lo causan si eres responsable de IVA. Como persona natural puedes no serlo (topes de ingresos y demás requisitos del art. 437 del Estatuto Tributario) o estar en el Régimen Simple. Esto define si los precios "incluyen IVA" (pregunta 1). Confírmalo con tu contador.
- Wompi practica o informa retenciones según tu perfil tributario.

## 6. Cambios necesarios en la app antes de cobrar

### 6.1 Textos y funciones que hay que corregir
- "Firma Digital Certificada" → "Firma electrónica con evidencia".
- Quitar "Certificado X.509", "Sello TSA RFC 3161", "validación criptográfica", "cifrado AES-256" y "PDF/A", y el contrato de ejemplo con esas menciones.
- OCR, conversiones a Office, comparar versiones, cifrado con contraseña, accesibilidad, preflight y consola JavaScript → "Próximamente", o se retiran del catálogo de "65 funciones".
- "Validar firmas" → la verificación real por huella (§3.4).

### 6.2 Nuevas pantallas
Iniciar sesión · Mis firmas (crear, renombrar, borrar, respaldo, importar) · Mi registro (tabla, filtros, descargar CSV/TXT) · Planes y pago (Wompi + código) · Mi plan (vigencia, recibos) · Verificar documento (pública) · Firma externa (página del firmante) · Empresa (miembros, registro consolidado).

## 7. Preguntas para ti

1. **IVA y facturación:** ¿eres responsable de IVA o estás en el Régimen Simple? ¿Ya emites factura electrónica para CuentaFacil, y con qué sistema?
2. **Renovación:** ¿empezamos con pagos sin renovación automática (más simple y con menos riesgo legal) y la agregamos después?
3. **Huella del documento:** ¿aceptas guardar también la huella SHA-256 del PDF en el registro? No revela el contenido, pero sin ella la evidencia de la firma es mucho más débil.
4. **Firmantes externos:** ¿aceptas que en ese caso el PDF se guarde **cifrado de extremo a extremo** hasta 7 días?
5. **Retención:** ¿5 años para el registro (con borrado a pedido), o prefieres otro plazo?
6. **Precios:** ¿te parecen bien $12.900 Firma Rápida y $29.900 Suite al mes, o tienes otra referencia (p. ej. alinear con CuentaFacil)?
7. **Plan gratis:** ¿3 documentos al mes con hoja de evidencia obligatoria, o sin plan gratis?
8. **Responsable:** ¿PascalPDF lo opera Danilo Orlando Torrado Blanco como persona natural (como CuentaFacil), o habrá una sociedad (S.A.S.)? Para vender a empresas y entidades suele convenir la S.A.S.
9. **Cuenta Wompi:** ¿ya la tienes a tu nombre, en sandbox o en producción?
10. **Supabase:** ¿apruebas crear un proyecto propio para PascalPDF (plan Pro ≈ USD 25 al mes)?
11. **Correo de soporte y atención:** ¿contacto@pascalia.lat y el WhatsApp +57 312 388 5012, como en CuentaFacil?
12. **Integración con CuentaFacil:** ¿una cuenta para ambos servicios y descuento para usuarios de CuentaFacil?
