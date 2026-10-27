# Fase 5 — indicadores, API y uso

## Fórmulas y tiempo

Dinero: BigInt/Decimal y strings exactos en API; Number se usa únicamente para coordenadas de gráficos, con valores exactos disponibles en tablas/tooltips. Períodos: hoy, siete fechas inclusivas, mes hasta hoy, mes anterior completo, año hasta hoy o rango personalizado de hasta 731 días. Comparación contra el intervalo inmediatamente anterior de la misma cantidad de fechas. Los límites de timestamps usan la zona IANA de la empresa, inicialmente America/Santiago, y contemplan DST.

| Indicador | Regla |
|---|---|
| Ventas registradas | Suma de totales confirmados de operaciones no canceladas cuya issueDate está en el período. No se suman cotizaciones, estén convertidas o no |
| Cobros recibidos | Suma de pagos manuales no revertidos por paidAt dentro del período, de operaciones no canceladas |
| Saldo pendiente | Suma de total menos pagos vigentes de operaciones no canceladas, a la consulta; no se oculta deuda anterior al período |
| Clientes activos | Clientes no archivados a la consulta |
| Cotizaciones pendientes | SENT, vigentes y sin decisión, a la consulta |
| Cotizaciones aprobadas | Estado actual APPROVED entre las cotizaciones emitidas (sentAt) en el período |
| Operaciones abiertas | PENDING o IN_PROGRESS a la consulta |
| Operaciones completadas | Estado actual COMPLETED entre operaciones cuya issueDate está en el período |

Cambio porcentual = (actual − anterior) × 100 / anterior, con dos decimales. Si anterior=0, no se publica porcentaje. Los stocks se identifican como «Estado actual». Las cotizaciones SENT con expiración pasada se presentan como EXPIRED sin depender de abrir su detalle.

## Endpoints nuevos

Todos parten de `/api/v1`, requieren sesión y, salvo aceptación de invitación, `X-Organization-Slug`. Swagger documenta DTOs. Se mantiene autorización/tenant en servidor.

| Método | Ruta |
|---|---|
| GET | `/dashboard/summary`, `/dashboard/revenue`, `/dashboard/payments`, `/dashboard/quotes`, `/dashboard/operations`, `/dashboard/activity` |
| GET | `/reports/sales`, `/reports/quotes`, `/reports/operations`, `/reports/payments`, `/reports/export` |
| GET / PATCH | `/organizations/current` |
| GET | `/organizations/current/members`, `/organizations/current/invitations` |
| PATCH / DELETE | `/organizations/current/members/:id` — DELETE desactiva, no elimina |
| POST | `/organizations/current/invitations` |
| POST | `/organizations/current/invitations/:id/revoke`, `/organizations/current/invitations/:id/resend` |
| POST | `/organizations/current/transfer-ownership` |
| POST | `/invitations/accept` — sesión del correo invitado verificado |
| GET / PATCH | `/organizations/current/modules` |
| GET | `/subscriptions/current` — OWNER |
| PATCH | `/subscriptions/current/plan` — asignación de acceso local, no compra |

Analítica: preset/from/to; reportes añaden page/pageSize, customerId, search y estado/tipo donde corresponda. CSV admite hasta 10.000 filas, respeta filtros, usa UTF-8/BOM y separador `;`, importes con coma decimal para Excel chileno y neutralización de fórmulas. Solo OWNER/ADMIN exportan.

Invitaciones: expiración de 48 horas, tokens hash, rotación al reenviar, revocación y aceptación transaccional. Los pendientes reservan cupos. ADMIN gestiona MEMBER; OWNER gestiona administradores y planes. No hay elevación del propio rol ni desactivación del último propietario. Transferencia: contraseña del emisor y aceptación verificada del destinatario.

Migraciones aditivas: `202610270005_dashboard_administration` agrega campos/configuración, Invitation, Subscription y auditoría; `202610270006_analytics_integrity` agrega índices de fechas y restricciones. Se aplicaron localmente, conservando datos anteriores.

## Cómo probar las pantallas

Inicio: crear una operación y pago manual, seleccionar Hoy y comprobar ventas/cobros/saldo; cambiar rango y abrir tablas accesibles de gráficos. Reportes: alternar los cuatro tipos, filtrar y exportar con OWNER/ADMIN. Usuarios: invitar otra cuenta, verificarla, aceptar desde Mailpit, cambiar rol y desactivar; comprobar acceso inmediato. Empresa: guardar dirección/zona/logo y comprobar que una cotización enviada no cambia. Módulos: ocultar/restaurar catálogo; verificar bloqueo si se intenta retirar un módulo con flujos activos. Suscripción: consultar cupos y configurar un plan compatible; no esperar un pago ni renovación.

La [entrega](phase-5-delivery.md) registra resultados y la verificación final pendiente. No se declara cerrada la fase únicamente por estar presentes las pantallas.
