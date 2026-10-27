# Seguridad — estado y plan

La evaluación inicial está en [production-readiness.md](production-readiness.md). Este documento distingue controles implementados de controles operativos pendientes.

## Implementado localmente

- Contraseñas derivadas con scrypt y sal aleatoria; comparación constante. Sesiones opacas y tokens de verificación/reset/invitación de 256 bits, persistidos con hash.
- Cookies HttpOnly/SameSite=Lax y Secure en producción. Reset elimina sesiones; logout revoca la sesión actual.
- Membresía activa y rol comprobados en el servidor; DTOs no aceptan organizationId. Roles/deactivación/transferencia y límites de cupos bajo bloqueo de organización.
- Origin estricto en escrituras de sesión, CORS acotado, cuerpo JSON de 1 MB, whitelist y rechazo de campos desconocidos, Helmet.
- PDFs internos autenticados, enlaces públicos con token hash/vencimiento/revocación; imágenes PNG/JPEG redecodificadas por Sharp con tamaño/píxeles limitados.
- Dinero exacto, restricciones de integridad, idempotencia y locks financieros; CSV con escape de fórmulas y UTF-8/BOM.
- Logs estructurados con redacción de cookies, autorización y tokens públicos de cotización; no imprimir cuerpos de invitación ni contraseñas.
- Límite de consultas por sesión/usuario; acceso y enlaces públicos conservan límites por IP. Su aislamiento pasó una prueba de integración específica.

## Pendiente antes de producción

Auditoría actual de dependencias y secretos históricos; almacenamiento distribuido del limitador; política de proxy que no confíe en encabezados arbitrarios; control de Swagger; probes separados; política de rotación y limpieza de sesiones; configuración SMTP/TLS; manejo de errores con request ID verificable; revisión de CSP compatible con Next; controles de infraestructura, monitoreo y restore.

No habilitar webhooks eliminando CSRF global. Cada ruta de proveedor necesitará raw body, autenticidad según documentación oficial, idempotencia y protección de replay. Un retorno exitoso del navegador no prueba un pago.

## Pruebas de cierre

Dos organizaciones con UUIDs cruzados; usuario desactivado; administrador intentando promoverse; propietario final; invitación reenviada/revocada/vencida; Origin incorrecto; token público inválido; sobrepago concurrente; reverso repetido; archivo con MIME falso; fórmula CSV; secreto canario no presente en logs; límite compartido entre réplicas; verificación de cabeceras sobre HTTPS real. Registrar artefacto, entorno, comandos y resultados, incluidos fallos.
