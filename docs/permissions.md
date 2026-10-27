# Permisos

| Acción | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| Ver empresa propia y su inicio | Sí | Sí | Sí |
| Ver miembros | Sí | Sí | No |
| Editar datos comerciales | Sí | Sí | No |
| Consultar clientes y catálogo propios | Sí | Sí | Sí |
| Crear o editar clientes y catálogo | Sí | Sí | No |
| Archivar clientes y catálogo | Sí | Sí | No |
| Ver cotizaciones, historial y PDF de la empresa | Sí | Sí | Sí |
| Crear/editar borradores y duplicar cotizaciones | Sí | Sí | No |
| Enviar/cancelar y registrar seguimiento | Sí | Sí | No |
| Generar/revocar enlaces y personalizar documentos | Sí | Sí | No |
| Cambiar propietario / suscripción | Reservado | No | No |
| Leer cualquier empresa ajena | No | No | No |

Crear empresa requiere sesión y genera OWNER. Las membresías se leen desde la base en cada petición. No hay endpoint para autoconcederse roles. Gestión de invitaciones y cambios de rol queda pendiente; no se muestran controles sin implementación.

Clientes y catálogo requieren `X-Organization-Slug`. Este encabezado identifica la empresa solicitada y se valida contra la membresía de la sesión: nunca autoriza por sí solo. Cada consulta incluye el organizationId resuelto en el servidor. No se acepta organizationId en DTOs, ni escrituras de MEMBER. Los UUID ajenos reciben 404 incluso cuando el solicitante es propietario de otra empresa.

Cotizaciones aplica la misma resolución y autorización a sus consultas, PDFs, eventos y relaciones comerciales. Quote, Customer y CatalogItem incorporan claves compuestas para validar también en PostgreSQL que las relaciones pertenezcan a la misma organización. La personalización de documentos exige que el slug del encabezado coincida con el slug de la ruta.

La página pública usa exclusivamente un token bearer válido y vigente, sin sesión. Solo permite leer la proyección comercial y aprobar/rechazar una cotización enviada y vigente. No permite editar, conocer UUID internos, leer seguimientos privados ni cambiar una decisión final. La identidad del aprobador es declarada y no verificada. Cada decisión exige confirmación y la versión del documento vista.
