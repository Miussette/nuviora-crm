# Diseño de datos — Fase 1

User: UUID, correo único normalizado, nombre, contraseña derivada, verificación y timestamps.
Session: hash único del token, usuario, expiración, timestamp; eliminación física al revocar.
AuthToken: hash único, propósito VERIFY/RESET, expiración y usuario; consumo atómico.
Organization: UUID, slug único, datos comerciales, moneda CLP, país CL y timestamps.
Membership: relación User–Organization única, OWNER/ADMIN/MEMBER e índices por usuario y empresa.
OrganizationSettings: relación 1:1, tipo PRODUCTS/SERVICES/MIXED.
ActivityLog: empresa, actor, acción y timestamp. La creación de empresa, membresía, preferencias y auditoría es transaccional.

Fases posteriores agregarán Customer, CatalogItem, Quote, QuoteItem, QuoteApproval, Operation, Payment y Subscription. Montos Decimal(18,2), cantidades Decimal(18,4), snapshots históricos, referencias compuestas por empresa, pagos con reversos y restricción única de operación por cotización. No se crean CRUD comerciales durante Fase 1.

## Implementado en Fase 2

Customer y CatalogItem ahora están implementados, relacionados con Organization mediante FK restrictiva y UUID. Ambas tablas tienen timestamps, archivedAt e índices compuestos de empresa, nombre y filtros. ActivityLog incorpora resourceId opcional para auditar acciones sobre cada recurso.

Customer incluye tipo PERSON/COMPANY, RUT normalizado con guion, contacto, dirección, comuna, región, país y notas. RUT y correo son opcionales y no se impone unicidad comercial no solicitada.

CatalogItem incluye PRODUCT/SERVICE, SKU opcional normalizado a mayúsculas, descripción, precio Decimal(18,2), unidad, VAT_19/EXEMPT, active y archivedAt. La base exige precio no negativo y unicidad (organizationId, sku). PostgreSQL permite múltiples SKU null; un SKU archivado sigue reservado. Precio entra y sale de la API como string; no hay conversión de dinero a Number.

Migración `202610260002_customers_catalog`: crea tres enums y las dos tablas; añade resourceId a ActivityLog, FK, índices y CHECK de precio. No contiene DROP, DELETE, TRUNCATE ni reinicio de datos. Los registros existentes de Fase 1 se conservan.

## Implementado en Fase 3

Quote guarda empresa/cliente, número único por empresa, estado, versión, hash comercial, clave/hash de idempotencia, fechas, vencimiento UTC correspondiente al fin del día chileno, moneda CLP, totales Decimal(18,2), condiciones y snapshots JSON del emisor/cliente. Al enviar se congelan los datos actuales de emisor, cliente y diseño. Los ítems se guardan como snapshots desde el borrador y no se refrescan silenciosamente desde el catálogo.

QuoteItem incluye empresa, cotización, catálogo opcional, nombre, descripción, unidad, cantidad Decimal(12,4), precio, descuento porcentual, impuesto, importes de línea y posición única por cotización. Las FK compuestas de cliente/catálogo/cotización impiden referencias entre empresas. CHECKs verifican cantidades positivas, descuento 0–100, impuestos configurados, importes no negativos y coherencia de totales.

QuoteSequence reserva números bajo bloqueo de la organización dentro de la transacción de creación. QuoteApproval es única por cotización/versión y guarda decisión, huella comercial, nombre declarado/motivo opcionales, fecha e información técnica mínima. QuoteShareToken solo guarda el hash, versión, expiración, revocación y última visualización agrupada. QuoteEvent registra tipo, fecha, empresa, actor opcional y metadatos mínimos.

QuoteBranding guarda el logo normalizado en PNG, color y pie por empresa, de forma privada en PostgreSQL. Cada documento emitido conserva su propia copia histórica. No hay PDFs expuestos en un directorio público: se generan bajo autorización cuando se solicitan.

La migración `202610270001_quotes` agrega las siete tablas, enums, claves compuestas, índices y CHECKs; no borra datos ni cambia migraciones anteriores. Los IDs comerciales son UUID. La conversión a Operation queda para Fase 4.
