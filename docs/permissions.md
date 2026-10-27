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

Crear empresa requiere sesión y genera OWNER. Las membresías activas se leen desde la base en cada petición. La administración de roles e invitaciones aplica las restricciones de fase 5 descritas a continuación; ningún usuario puede elevar su propio rol.

Clientes y catálogo requieren `X-Organization-Slug`. Este encabezado identifica la empresa solicitada y se valida contra la membresía de la sesión: nunca autoriza por sí solo. Cada consulta incluye el organizationId resuelto en el servidor. No se acepta organizationId en DTOs, ni escrituras de MEMBER. Los UUID ajenos reciben 404 incluso cuando el solicitante es propietario de otra empresa.

Cotizaciones aplica la misma resolución y autorización a sus consultas, PDFs, eventos y relaciones comerciales. Quote, Customer y CatalogItem incorporan claves compuestas para validar también en PostgreSQL que las relaciones pertenezcan a la misma organización. La personalización de documentos exige que el slug del encabezado coincida con el slug de la ruta.

La página pública usa exclusivamente un token bearer válido y vigente, sin sesión. Solo permite leer la proyección comercial y aprobar/rechazar una cotización enviada y vigente. No permite editar, conocer UUID internos, leer seguimientos privados ni cambiar una decisión final. La identidad del aprobador es declarada y no verificada. Cada decisión exige confirmación y la versión del documento vista.
## Operaciones y Cobros

OWNER y ADMIN crean operaciones, convierten cotizaciones aprobadas, editan información operativa, asignan responsables, cambian estados, registran pagos y revierten con confirmación y motivo. MEMBER consulta listados, indicadores, detalles, pagos e historiales, sin escrituras. Ningún rol accede a empresas ajenas.

El responsable debe tener membresía en la misma organización, comprobada en API y FK de PostgreSQL. Cliente, cotización, conceptos y pagos mantienen relaciones compuestas de tenant. Un pago deriva su cliente de la operación: no acepta customerId independiente ni organizationId. No existen endpoints de eliminación de pagos ni edición de importes confirmados.
## Dashboard, reportes y administración — Fase 5

| Acción | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| Consultar dashboard y módulos comerciales habilitados por el plan | Sí | Sí | Sí, lectura |
| Consultar reportes incluidos en el plan | Sí | Sí | Sí, lectura |
| Exportar CSV de la empresa | Sí | Sí | No |
| Consultar miembros e invitaciones | Sí | Sí | No |
| Invitar/revocar/reenviar invitaciones MEMBER | Sí | Sí | No |
| Invitar o administrar ADMIN | Sí | No | No |
| Cambiar rol de otros miembros | ADMIN o MEMBER | Mantiene MEMBER, sin promoción | No |
| Desactivar/reactivar otros accesos MEMBER | Sí | Sí | No |
| Desactivar el último OWNER o editar el propio rol | No | No | No |
| Transferir propiedad con contraseña y aceptación por correo | Sí | No | No |
| Configurar datos, logo y módulos | Sí | Sí | No |
| Consultar o configurar plan/suscripción | Sí | No | No |

Las invitaciones no pueden otorgar OWNER: esa transición usa el flujo de transferencia. Aceptar exige sesión con el correo invitado verificado, token vigente no revocado y permisos actuales del emisor. Al desactivar una membresía no se elimina al usuario global ni su acceso a otras empresas, y se conservan sus relaciones históricas. Las invitaciones pendientes reservan cupos del plan. Ocultar un módulo conserva lectura histórica y bloquea escrituras nuevas; la configuración impide retirar módulos necesarios para flujos activos.
