# Observabilidad — diseño operativo

Implementado: Pino estructurado con identificador de petición y redacción de cookies/autorización/tokens públicos de cotización. No hay aún un dashboard operativo, recolector de errores, métricas exportadas o alertas configuradas y verificadas. El dashboard comercial no sustituye monitoreo técnico.

## Señales a implementar

| Área | Señales propuestas | Protección |
|---|---|---|
| HTTP | tasa, latencia por ruta normalizada, 4xx/5xx, saturación | Sin UUID/email/token/importe como etiqueta |
| Runtime | CPU, heap/RSS, reinicios y trabajos PDF/Sharp | Acceso administrativo |
| PostgreSQL | conexiones/pool, espera, slow queries, locks, almacenamiento | No volcar parámetros sensibles |
| Correo | fallo/entrega/reintentos y antigüedad de cola | Evitar destinatarios en métricas |
| Backups | último éxito, tamaño, checksum, edad de restore | Buckets y evidencias privados |
| Suscripciones | error/reintento/conciliación de eventos SaaS | IDs internos y payload protegido; nunca tarjetas |

Dashboard operativo propuesto: disponibilidad, errores/latencia, recursos, DB, correo, backups y eventos pendientes. Diferenciar liveness, readiness y salud funcional. Las sondas no deben escribir datos ni generar pagos.

## Alertas y objetivos

Los umbrales se fijarán con mediciones. Candidatos para acordar: indisponibilidad sostenida, aumento de 5xx, pool agotado, backup vencido, espacio escaso y webhook sin reconciliar. No declarar un SLO o disponibilidad alcanzados antes de medirlos. Documentar canal, responsable, escalamiento y acuse de recibo.

Verificación pendiente: cortar DB en staging, provocar un error controlado y una tarea fallida; comprobar alerta recibida, trazabilidad por request ID y ausencia de secretos canarios. Registrar resultado y fecha del ensayo. Retención, costos y proveedor de observabilidad siguen sin acordarse.
