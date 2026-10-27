# Fase 2 — Clientes y catálogo

Inspección: existen User, Session, AuthToken, Organization, Membership, OrganizationSettings y ActivityLog; no hay Customer ni CatalogItem. Se reutilizan AppShell, PageHeader, EmptyState, LoadingSkeleton, api, React Query, RHF, Zod y la marca original. Las rutas comerciales solo tenían una página de fase pendiente.

1. Añadir Customer y CatalogItem con índices, archivado y SKU único por empresa mediante migración aditiva.
2. Validaciones compartidas de RUT y dinero; DTOs, paginación y filtros; API versionada.
3. Resolver empresa desde X-Organization-Slug y comprobar sesión/membresía antes de cada consulta. Nunca aceptar organizationId en el cuerpo. OWNER/ADMIN escriben; MEMBER consulta.
4. Componentes reutilizables de tabla, búsqueda, filtros, estados y confirmación. Formularios y detalles reales. Precio viaja como string y se persiste en Decimal(18,2).
5. Registrar acciones de creación, actualización y archivo en ActivityLog en la misma transacción.
6. Pruebas unitarias, integración y E2E para CRUD, RUT, precios, filtros, unicidad, roles e IDOR; regresión de autenticación.
7. Ejecutar lint, tipos, tests y build; documentar resultados y guía de prueba. No avanzar a Fase 3.

El tipo de negocio limita los tipos nuevos del catálogo sin ocultar registros históricos. Inactivo y archivado son estados diferentes. El archivado es idempotente; un registro archivado queda de solo lectura y no se elimina físicamente. El SKU queda reservado incluso al archivar.

No se reinicia ni borra la base de datos. Las pruebas usan registros propios y limpieza limitada a sus UUID. No se agregan mocks ni inventario. Verificar el error 500 observado en la instancia de desarrollo mediante regresión HTTP y navegación real con servidores de prueba independientes.
