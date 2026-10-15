---
target: página de CuentaFacil
total_score: 24
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:/home/user/pascalia-web/cuentafacil/index.html"
target_fingerprint: "sha256:319596c8bf584de45bc39772aa229b7f5f1ddec7840ec2eb5460fbf9de64a965"
target_path: /home/user/pascalia-web/cuentafacil/index.html
timestamp: 2026-10-15T06-04-37Z
slug: cuentafacil-index-html
---
# Crítica: CuentaFacil (cuentafacil/index.html)
Method: dual-agent (A: revisión de diseño · B: detector y navegador)

## Salud del diseño (24/32, 75 %, Bien)
1 Estado del sistema 3: no dice qué significa la lista de espera ni cuándo se podrá usar.
2 Lenguaje del usuario 4: vocabulario exacto del contratista.
3 Control y libertad 3: sin menú en celular; el número no se puede tocar.
4 Consistencia 3: tres nombres para una acción; formulario beige de PascalIA en página verde.
5 Prevención de errores 2: se puede elegir otra solución entre 9; correo obligatorio y WhatsApp opcional.
6 Reconocer en vez de recordar 3: el precio solo está en la última pregunta frecuente, cerrada.
7 n/a (página de venta). 8 Estética 3: muy larga en celular. 9 Recuperación de errores 3: si falla la red solo se ofrece el correo. 10 n/a.

## ¿Hecha para CuentaFacil?
Los textos y el chat simulado sí; la estructura es una plantilla genérica de producto de software; el cierre (formulario de PascalIA) es lo menos propio.
Detector: 16 hallazgos de 5 tipos. Real y grave: el enlace a la política de datos en .card.dark (contraste de 1,1 a 1,2:1). Real, de poca prioridad: horas del chat (10,9 px, 3,4:1). Falsas alarmas: borde del PDF (adjunto), tarjetas anidadas (globos del chat), contraste del título verde (texto grande). Gusto: Plus Jakarta Sans.

## Problemas prioritarios
- [P1] Enlace a la política de datos invisible en la franja «Tú firmas, tú decides»: enlaces blanco o crema, subrayados, con foco visible; una línea sobre cómo se guardan y borran los documentos de WhatsApp. (harden, clarify)
- [P1] El cierre es el formulario genérico de 8 campos: ocultar «¿Qué te interesa?» y «¿Cómo nos conociste?»; WhatsApp obligatorio con teclado numérico y correo opcional; «Entidad contratante» en vez de «Mensaje»; botón «Unirme a la lista de espera». (distill, adapt)
- [P1] Precio y condiciones del piloto escondidos: bloque de precio tras «Qué recibes»; botones que digan lo que pasa y el siguiente paso. (clarify, layout)
- [P2] Recorrido largo en celular: unos 8.100 px, sin menú, número que no se toca, objetivos de 40 y 20 px, falta scroll-padding-top. (adapt)
- [P2] Foco y bordes débiles: anillo ámbar de 2:1, bordes de campo de 1,45:1. (harden)

## Señales de alerta
Jordan: piloto o probar ya; no sabe si su entidad está incluida; ve Flota y SI-APS en el formulario. Casey: 7,5 pantallas, 8 campos, casilla de 20 px. Riley: puede cambiar de solución; mínimo de 5 caracteres; errores genéricos del servidor; sin datos de almacenamiento. Marcela (CPS de una ESE): le piden primero el correo, no ve el precio, no tiene garantías sobre sus documentos.

## Menores
Pregunta frecuente con «Norte de Santander» y «vereda El Tarra» (por confirmar); el chat no tiene transcripción para lectores de pantalla; íconos con emoji; «Varios contratos» repetido; el mensaje de éxito promete correo; el mensaje sin JavaScript solo ofrece el correo.

## Preguntas
1. ¿Que el botón principal sea el primer mensaje de WhatsApp? 2. ¿Que el chat sea la página entera? 3. ¿Por qué esconder los $50.000?
