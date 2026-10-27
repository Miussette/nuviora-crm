# Fase 3 — Cotizaciones profesionales

## Inspección y alcance

Fases 1/2 implementadas: sesiones seguras, organizaciones, OWNER/ADMIN/MEMBER, TenantService, clientes, catálogo, archivado, auditoría y componentes Nuviora. No existen modelos Quote ni endpoints PDF/públicos. Se conserva la marca aprobada y no se implementan operaciones de Fase 4.

## Tareas y decisiones

1. Ejecutar regresión unitaria e integración previas con PostgreSQL existente. Revisar la guía Next.js local exigida por apps/web/AGENTS.md.
2. Añadir Quote, QuoteItem, QuoteApproval, QuoteShareToken, QuoteEvent, QuoteSequence y QuoteBranding con migración aditiva, UUID, FK compuestas por empresa e índices.
3. Cálculo compartido con enteros escalados BigInt. Cantidad hasta 4 decimales, precios hasta 2, descuento porcentual por línea hasta 2. Redondeo half-up por línea: bruto, descuento y luego impuesto sobre neto. El servidor persiste y verifica todos los totales. IVA 19%/exento según la configuración del ítem.
4. Numeración y creación idempotente serializadas por empresa; edición optimista por versión; estados y aprobación bajo bloqueo transaccional de cotización. Solo se edita DRAFT. Al enviar se congelan emisor/cliente/logo, se incrementa versión y se calcula una huella del documento.
5. PDF backend con logo opcional propio del emisor, contactos, snapshots históricos, filas y textos paginados y aviso de cotización no tributaria. Personalización limitada a logo, color y pie de documento; sin descargar URLs de terceros.
6. Tokens aleatorios de 256 bits, solo hash en base, expiración configurable, rotación/revocación y limitación de solicitudes. No registrar tokens en logs, ni indexar o cachear páginas públicas. Proyección pública sin UUID, notas internas, datos de membresía ni evidencia técnica.
7. Aprobación/rechazo únicos por versión, confirmación y nombre declarado opcional. Evidencia mínima: método bearer, versión/huella, ID de interacción y consentimiento. El enlace demuestra posesión del enlace, no identidad verificada ni firma electrónica avanzada. Sin IP o fingerprint persistente.
8. Listado, filtros, editor con clientes/catálogo reales, conceptos libres, vista previa, detalle/acciones/historial y página pública. Reutilizar componentes pequeños y accesibles.
9. Pruebas de cálculos y redondeo, PDF multipágina, idempotencia/concurrencia, expiración/revocación, snapshots, permisos e IDOR; E2E con regresión de fases anteriores y móvil. Lint, tipos, tests y build.

## Reglas concretas

- OWNER/ADMIN escriben; MEMBER consulta cotizaciones y PDF internos.
- Vencimiento inclusivo al final del día en America/Santiago, evaluado en servidor y persistido como expiryAt. La expiración se materializa al consultar u operar; no se requiere cron para impedir aprobación tardía.
- Creación exige cliente; borrador puede no tener ítems. Enviar exige al menos un ítem válido, cliente activo y fecha vigente. Total cero es válido si el resto está completo.
- DRAFT→SENT/CANCELLED; SENT→APPROVED/REJECTED/EXPIRED/CANCELLED. Estados finales de solo lectura; duplicar crea borrador con nuevo número y nuevas fechas. No se crea una operación todavía.
- Cada envío congela el documento. Los catálogos posteriores no cambian snapshots. Un enlace nuevo rota el anterior; solo se devuelve el secreto al generarlo. Las visualizaciones se agrupan por token en intervalos de 15 minutos para no saturar la auditoría.
- No se borra ni reinicia la base; no se despliega ni se contratan servicios. Los datos de prueba se limpian por UUID propios.
