# Entrega de Fase 2 — 26 de octubre de 2026

## Resultado

Clientes y Catálogo operan con PostgreSQL, API REST y validación de sesión, membresía y rol. Se implementaron creación, listado, búsqueda, filtros, ordenamiento, paginación, detalle, edición parcial y archivado lógico. La interfaz conserva la marca original y la paleta Nuviora; el isotipo retirado del panel de acceso sigue retirado.

OWNER y ADMIN escriben; MEMBER consulta. Todos los accesos comerciales usan la empresa resuelta por membresía, nunca un organizationId recibido en el cuerpo. Los textos no se interpretan como HTML. Las escrituras y su auditoría son transaccionales; repetir el archivado no duplica su evento.

## Archivos creados

- `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/index.ts`: validación de RUT, normalización y dinero exacto.
- `apps/api/src/common/tenant.ts`, `list.dto.ts`, `validation.ts`: resolución de empresa, paginación, filtros y mensajes de validación en español.
- `apps/api/src/modules/customers/customer.dto.ts`, `customers.service.ts`, `customers.controller.ts`.
- `apps/api/src/modules/catalog/catalog.dto.ts`, `catalog.service.ts`, `catalog.controller.ts`.
- `apps/api/prisma/migrations/202610260002_customers_catalog/migration.sql`.
- `apps/web/src/services/resources.ts`: transporte con encabezado de empresa.
- `apps/web/src/components/ui/data-table.tsx`, `resource-controls.tsx`, `confirm-dialog.tsx`, `form-field.tsx`.
- `apps/web/src/features/resources/customer-form.tsx`, `catalog-item-form.tsx`, `schemas.ts`, `use-resource-form.ts`, `resource-list.tsx`, `resource-columns.tsx`, `resource-detail.tsx`, `resource-editor.tsx`.
- Ocho páginas en `apps/web/src/app/app/[organizationSlug]/clientes/` y `catalogo/`: listado, nuevo, `[id]` y `[id]/editar` para cada recurso.
- `apps/api/test/phase2.unit.test.ts`, `phase2.integration.test.ts`.
- `tests/e2e/resource-fixture.ts`, `resources.spec.ts`.
- `.prettierignore`, `docs/phase-2-plan.md`, `docs/phase-2-guide.md` y este documento.

## Archivos modificados

- `apps/api/prisma/schema.prisma`, `apps/api/src/app.module.ts`, `apps/api/src/bootstrap.ts`, `apps/api/package.json`.
- `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/src/styles/globals.css`.
- `apps/web/src/components/layout/app-shell.tsx`: navegación de Clientes/Catálogo, selección activa en subrutas y menú móvil cerrado fuera de la navegación por teclado.
- `apps/web/src/features/organizations/workspace.tsx`: mensajes comprensibles de la actividad auditada y referencia a la fase actual.
- `packages/types/src/index.ts`: contratos Customer, CatalogItem y Paginated.
- `package.json`, `pnpm-lock.yaml`: workspace de dominio y scripts; Prettier 3.9.10 como herramienta de desarrollo.
- `playwright.config.ts`, `tests/e2e/foundations.spec.ts`: puertos/compilación aislados y enlaces de correo compatibles con el origen de prueba.
- `.gitignore`, `eslint.config.mjs`: excluir la compilación E2E.
- `README.md`, `docs/architecture.md`, `docs/database-design.md`, `docs/permissions.md`.

No se sobrescribieron los PNG de marca, las credenciales del usuario ni registros de negocio. Los cambios de esquema se aplicaron con migrate deploy, sin reset.

## Endpoints implementados

| Recurso | Listar | Detalle | Crear | Editar | Archivar |
|---|---|---|---|---|---|
| Clientes | GET `/api/v1/customers` | GET `/api/v1/customers/:id` | POST `/api/v1/customers` | PATCH `/api/v1/customers/:id` | DELETE `/api/v1/customers/:id` |
| Catálogo | GET `/api/v1/catalog-items` | GET `/api/v1/catalog-items/:id` | POST `/api/v1/catalog-items` | PATCH `/api/v1/catalog-items/:id` | DELETE `/api/v1/catalog-items/:id` |

Los diez endpoints requieren cookie y `X-Organization-Slug`. Los parámetros, cuerpos y códigos de error se explican en [la guía](phase-2-guide.md) y Swagger local.

## Migración aplicada

`202610260002_customers_catalog` crea Customer y CatalogItem, tres enums, índices y FK a Organization. Agrega resourceId nullable a ActivityLog. unitPrice es Decimal(18,2) y tiene CHECK no negativo. SKU tiene unicidad por empresa; null permite múltiples elementos sin SKU. No incluye borrados, DROP ni TRUNCATE. Las migraciones de Fase 1 permanecen sin modificaciones.

## Comprobaciones ejecutadas

| Comando / revisión | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | Correcto |
| `pnpm db:generate` | Correcto |
| `pnpm db:migrate` | Migración aditiva aplicada |
| `pnpm lint` | Correcto |
| `pnpm typecheck` | Correcto en dominio, API y web |
| `pnpm test` | 12 pruebas aprobadas |
| `pnpm test:integration` | 2 suites aprobadas sobre PostgreSQL y HTTP reales |
| `pnpm build` | Next.js, NestJS y dominio compilados |
| `PLAYWRIGHT_CHANNEL=msedge pnpm exec playwright test` | 3 recorridos aprobados en Chromium/Edge |
| `pnpm audit --prod --audit-level high` | Sin vulnerabilidades conocidas reportadas |
| `/auth/me` en API 3001 y proxy 3000 con sesión temporal válida | 200 en ambos |
| Capturas escritorio/móvil | Revisadas; tarjetas móviles sin desbordamiento horizontal |

Las unitarias cubren RUT con módulo 11/K, límites monetarios, formato por encima de Number.MAX_SAFE_INTEGER, DTOs y schemas de formularios, además de la seguridad previa. La integración prueba creación/edición/búsqueda/paginación/archivo, archivo idempotente, conservación física, SKU único por empresa, tipos habilitados, entradas inválidas, inyección de organizationId, UUID ajenos y OWNER/ADMIN/MEMBER. La prueba de regresión verifica perfil sin datos sensibles, tokens de un solo uso, CSRF y revocación de sesiones.

E2E prueba autenticación y correo de la fase previa, CRUD desde formularios reales, validación de RUT y precio, búsqueda sin resultados, filtros, paginación, cancelar/confirmar archivo, precio exacto, inactivo frente a archivado, texto malicioso sin ejecutar, roles, acceso ajeno, advertencia de cambios y móvil de 390 px. Los fixtures de esta ejecución se eliminan por sus UUID al terminar. Capturas y log de integración quedan en test-results, ignorados por el repositorio.

El error 500 de sesión observado anteriormente no se reprodujo en las instancias probadas; no se atribuye a una causa que no haya sido demostrada. El perfil y el recorrido de registro/onboarding se verificaron de nuevo, incluida la instancia de desarrollo actual.

## Cómo probar y pendientes

Consulta [README](../README.md) para instalación/actualización y [guía](phase-2-guide.md) para ejemplos de clientes y productos/servicios. Desde el menú, crea registros, edita, busca, filtra, pagina y archiva; revisa Archivados para confirmar conservación. La actividad aparece en Inicio con textos de negocio.

No se implementó inventario, cotizaciones, PDF, operaciones, cobros, importación/exportación, restauración de archivados, invitaciones ni cambios de rol. Los impuestos son preferencias del catálogo; no se emiten documentos tributarios ni se calcula una cotización en esta fase. E2E se ejecutó localmente, no en GitHub Actions; CI conserva unitarias, integración, lint, tipos y build. No hay certificación de accesibilidad/producción, ni despliegue o servicios pagos.

No se detectaron errores bloqueantes en los recorridos ejecutados. Fase 2 queda entregada para revisión; no se inició Fase 3.
