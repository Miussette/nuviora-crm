# Entrega Fase 3 — 27 de octubre de 2026

## Resultado

Cotizaciones profesionales con PostgreSQL, editor conectado a clientes/catálogo reales, conceptos personalizados, descuentos/IVA, borradores, versiones, numeración transaccional, PDF multipágina, enlaces secretos revocables, aprobación/rechazo, evidencia mínima e historial auditable. Se mantiene la identidad lavanda y los logos originales de la aplicación; el logo de los documentos pertenece al negocio emisor y es opcional.

El módulo no convierte a operaciones ni simula envío de correo o una integración oficial de WhatsApp. La aceptación pública es declarada mediante posesión del enlace; no se presenta como identidad verificada ni firma electrónica avanzada.

## Archivos creados

### Backend y dominio

- `packages/domain/src/quotes.ts`: cálculo exacto con BigInt, límites/rounding, transiciones y fechas chilenas con vencimiento inclusivo.
- `packages/types/src/quotes.ts`: contratos de documentos, líneas, estados, evidencia, eventos y diseño.
- `apps/api/src/modules/quotes/quote.dto.ts`.
- `apps/api/src/modules/quotes/quote.store.ts`.
- `apps/api/src/modules/quotes/quotes.service.ts`.
- `apps/api/src/modules/quotes/quote-writer.service.ts`.
- `apps/api/src/modules/quotes/quote-workflow.service.ts`.
- `apps/api/src/modules/quotes/quote-pdf.service.ts`.
- `apps/api/src/modules/quotes/quote-branding.service.ts`.
- `apps/api/src/modules/quotes/quotes.controller.ts`.
- `apps/api/prisma/migrations/202610270001_quotes/migration.sql`.

### Frontend

- `apps/web/src/features/quotes/quote-list.tsx`, `quote-filters.tsx`, `quote-status.tsx`.
- `apps/web/src/features/quotes/quote-schema.ts`, `quote-editor.tsx`, `quote-form.tsx`, `quote-item-editor.tsx`, `selectors.tsx` (CustomerSelector y CatalogItemSelector).
- `apps/web/src/features/quotes/quote-totals.tsx`, `quote-preview.tsx`, `quote-detail.tsx`, `quote-actions.tsx`, `quote-timeline.tsx`, `quote-share-dialog.tsx`.
- `apps/web/src/features/quotes/quote-approval-page.tsx`, `quote-approval-dialog.tsx` (aprobación y rechazo).
- `apps/web/src/features/quotes/quote-branding-form.tsx`, `customer-quotes.tsx`.
- `apps/web/src/services/quote-pdf.ts`.
- `apps/web/src/components/ui/action-dialog.tsx`.
- `apps/web/src/app/app/[organizationSlug]/cotizaciones/page.tsx`.
- `apps/web/src/app/app/[organizationSlug]/cotizaciones/nueva/page.tsx`.
- `apps/web/src/app/app/[organizationSlug]/cotizaciones/[id]/page.tsx`.
- `apps/web/src/app/app/[organizationSlug]/cotizaciones/[id]/editar/page.tsx`.
- `apps/web/src/app/cotizacion/[publicToken]/page.tsx`.

### Pruebas y documentación

- `apps/api/test/phase3.unit.test.ts`, `phase3.integration.test.ts`, `quote-fixture.ts`.
- `tests/e2e/quotes.spec.ts`.
- `docs/phase-3-plan.md`, `phase-3-guide.md` y este documento.

## Archivos modificados

- `apps/api/prisma/schema.prisma`: siete modelos, enums, relaciones/índices compuestos de empresa.
- `apps/api/src/app.module.ts`: controladores/proveedores y enmascarado de URLs públicas en logs.
- `apps/api/src/bootstrap.ts`: JSON acotado a 1 MB y cabeceras públicas de privacidad, también en errores.
- `apps/api/src/common/validation.ts`: mensajes en español y validación anidada.
- `apps/api/src/database/prisma.service.ts`: espera de admisión de transacciones 10 s y timeout 15 s.
- `apps/api/package.json`: PDFKit 0.20.2, Sharp 0.35.5; tipos PDFKit 0.17.7 y pdf-parse 2.4.5 para pruebas; scripts incorporan Fase 3.
- `packages/domain/src/index.ts`, `packages/types/src/index.ts`, `packages/types/package.json`.
- `pnpm-lock.yaml`: dependencias fijadas y verificadas con instalación congelada.
- `apps/web/next.config.ts`: noindex/no-store/no-referrer y exclusión de URLs secretas en logs de desarrollo.
- `apps/web/src/services/api.ts`: errores de conexión comprensibles en español.
- `apps/web/src/components/layout/app-shell.tsx`: navegación de cotizaciones.
- `apps/web/src/features/organizations/settings.tsx`: personalización documental.
- `apps/web/src/features/organizations/workspace.tsx`: actividad de cotizaciones con textos de negocio.
- `apps/web/src/features/resources/resource-detail.tsx`: cotizaciones reales en la ficha de cliente.
- `tests/e2e/resource-fixture.ts`: limpieza de nuevos registros limitada a las empresas de prueba.
- `README.md`, `docs/architecture.md`, `docs/database-design.md`, `docs/permissions.md`.

No se modificaron PNG de marca, `.env`, las migraciones anteriores ni registros existentes del negocio. No existe repositorio Git en esta carpeta, por lo que esta lista identifica los archivos trabajados; no se afirma que haya commits o un despliegue.

## Migración aplicada

`202610270001_quotes` crea Quote, QuoteItem, QuoteApproval, QuoteShareToken, QuoteEvent, QuoteSequence y QuoteBranding, más enums. Añade claves únicas compuestas a Customer/CatalogItem y FK de cotización por empresa. Impone número y clave de petición únicos por organización, una decisión por documento/versión, posiciones de línea únicas y tokenHash único.

CHECKs verifican moneda CLP, versión positiva, orden de fechas, cantidades positivas, descuento 0–100, impuestos válidos y coherencia/no negatividad de importes. Se aplicó con `prisma migrate deploy`, sin reset, DROP, TRUNCATE ni borrado de datos. Los únicos borrados ejecutados en pruebas corresponden a fixtures identificados por sus UUID, no a información del usuario.

## API

Se implementaron los **14 endpoints solicitados** y tres auxiliares (seguimiento, GET/PATCH de diseño). La tabla completa, cuerpos y parámetros están en [la guía](phase-3-guide.md) y los DTOs/rutas en Swagger `/api/docs`.

Internos: GET/POST `/api/v1/quotes`; GET/PATCH `/api/v1/quotes/:id`; POST `/:id/send`, `/:id/cancel`, `/:id/duplicate`, `/:id/share`, `/:id/share/revoke`; GET `/:id/pdf`, `/:id/events`. Adicional POST `/:id/follow-ups` y GET/PATCH `/api/v1/organizations/:slug/quote-branding`.

Públicos: GET `/api/v1/public/quotes/:token`; POST `/:token/approve` y `/:token/reject`. Todos aplican las reglas del token. No se expone un PDF mediante una ruta de archivo pública; el PDF interno exige membresía.

## Resultados ejecutados

| Comprobación | Resultado |
|---|---|
| Regresión previa Fases 1/2 | 12 unitarias y 2 pruebas de integración aprobadas antes de implementar |
| `pnpm install --frozen-lockfile` | Correcto |
| `pnpm db:generate` | Cliente generado con los nuevos modelos |
| `pnpm db:migrate` | Migración aditiva aplicada |
| `pnpm lint` | Correcto |
| `pnpm typecheck` | Correcto en API, web y dominio |
| `pnpm test` | 20 pruebas aprobadas |
| `pnpm test:integration` | 8 pruebas aprobadas sobre PostgreSQL/HTTP reales |
| `PLAYWRIGHT_CHANNEL=msedge pnpm exec playwright test` | 5 recorridos aprobados, con regresión de fases anteriores |
| `pnpm build` | Dominio, NestJS y Next.js compilados correctamente |
| `pnpm audit --prod --audit-level high` | Sin vulnerabilidades conocidas reportadas |
| PDF real y capturas | Documento de ocho páginas extraído/renderizado y capturas de app/portal revisadas |

### Reglas verificadas

Las pruebas cubren creación con múltiples ítems, bases gravadas/exentas, descuentos, IVA, redondeo half-up, límites, valores por encima de MAX_SAFE_INTEGER y cantidades de cuatro decimales. Vencimiento con horario de Chile en invierno/verano/cambio de hora, incluido el último milisegundo de la fecha y la expiración en el siguiente.

Se probaron reintentos de creación simultáneos sin duplicar documento/número, numeración concurrente, edición obsoleta, duplicación idempotente, cinco aprobaciones simultáneas con una sola decisión/evento, carreras aprobar/rechazar y aprobar/cancelar, documentos vencidos, tokens expirados, rotación/revocación y rate limit público de 20 lecturas seguido por 429.

Se verificaron FK/referencias entre empresas, IDOR en detalle/PDF/eventos/acciones, OWNER/ADMIN/MEMBER, rechazo de totales/organizationId del navegador y ausencia de identificadores/notas internas en la proyección pública. El documento aprobado y su huella permanecen inmutables por API. Los cambios posteriores de catálogo, emisor, cliente y diseño no alteran snapshots emitidos.

El PDF de prueba usa un logo propio del emisor, una descripción de línea extensa que debe continuar entre páginas, 28 ítems y una condición final. Se extrajeron y comprobaron los marcadores inicial/final y condiciones, y se renderizaron primera/última página. No aparece información interna ni datos cambiados después del envío.

E2E verifica logo, selección real de cliente/catálogo, cantidades/descuentos/impuestos, reordenamiento y eliminación de conceptos, vista previa, edición, envío, PDF, enlace/WhatsApp preparado, aprobación con confirmación, evidencia, cotizaciones en ficha de cliente, filtros, duplicación, rechazo, revocación, expiración, roles, acceso ajeno y móvil sin desbordamiento horizontal.

### Incidencias resueltas

- La admisión de transacciones concurrentes agotaba el valor por defecto de 2 s: ajustada a 10 s, sin retirar bloqueos, idempotencia ni integridad. Las pruebas concurrentes se repitieron con éxito.
- Una aserción E2E coincidía con dos encabezados del mismo documento: se acotó al h1 público, y el recorrido completo pasó.
- Se revisó el límite exacto de expiración para conservar el último milisegundo del día elegido; la regla está compartida y cubierta por una prueba de frontera.

## Uso, evidencia y límites

Abre Cotizaciones en la aplicación local. Sigue [la guía de uso](phase-3-guide.md) para crear, previsualizar, enviar, compartir, aprobar/rechazar y duplicar. Artefactos de prueba en `test-results/` (ignorados), incluidos `quote-multipage.pdf`, sus páginas PNG, PDF aprobado y capturas de editor, documento, portal y lista móvil.

El logo de prueba coloreado de las capturas es un fixture temporal, no un logo obligatorio ni un dato de producción. Las URLs públicas se prueban anónimamente en servidores locales independientes; no se ha desplegado una URL accesible desde Internet. No se ejecutó GitHub Actions, aunque sí sus comprobaciones locales; E2E continúa siendo local.

No hay conversión a operación, cobros, email comercial automático, firma avanzada, inventario ni proveedor de publicación. El limitador es por proceso; un despliegue con varias réplicas requerirá almacenamiento compartido de rate limiting. No se certifica WCAG/producción ni identidad del aprobador. PDF usa tipografía estándar con caracteres españoles; personalización limitada a logo, cuatro colores y pie. No se almacenan ni sirven PDFs estáticos, y la huella comercial no promete identidad binaria de PDFs generados por motores futuros.

No se detectaron errores bloqueantes en los recorridos verificados. **No se inició Fase 4.**
