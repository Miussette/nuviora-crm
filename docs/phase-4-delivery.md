# Entrega — Fase 4: Operaciones y Cobros

## Funcionalidad entregada

- Pedidos y trabajos manuales con cliente, catálogo o conceptos personalizados, importes exactos, fechas, estado inicial, instrucciones y notas internas.
- Conversión de cotizaciones aprobadas con copia histórica y una operación principal por cotización. Reintentos y doble clic no duplican operaciones ni eventos.
- Listado paginado con búsqueda, filtros por cliente, fechas, tipo y estado; detalle con Resumen, Detalle, Cobros e Historial. Asignación de miembros y edición operativa con versión optimista.
- Transiciones operativas controladas e independientes del cobro. Completadas pueden quedar impagas; pagadas pueden seguir en proceso. Cancelar requiere revertir abonos vigentes.
- Cobros con indicadores SQL, saldos derivados, abonos manuales, pago total, prevención de sobrepago y reintentos. Protección transaccional frente a pagos concurrentes.
- Reversos con confirmación, motivo, actor y fecha. Movimiento original conservado y saldo recalculado; no se ejecutan devoluciones bancarias.
- Historial persistente, operaciones desde cliente, integración en cotizaciones y navegación, permisos OWNER/ADMIN frente a MEMBER e aislamiento multi-tenant.
- Formularios accesibles, tarjetas móviles y pestañas navegables con teclado, conservando la identidad lavanda.

## Archivos

Inventario completo: [phase-4-files.txt](phase-4-files.txt). Áreas principales:

- `apps/api/prisma/schema.prisma` y migraciones `202610270002`, `202610270003`, `202610270004`.
- `apps/api/src/modules/operations/`: DTOs, controladores Swagger, servicio transaccional y consultas SQL parametrizadas.
- `apps/api/src/app.module.ts`, `common/validation.ts`, `package.json`, `pnpm-lock.yaml`: registro de endpoints, mensajes y dependencia directa Express ya importada por el arranque existente.
- `packages/domain/src/operations.ts` y `packages/types/src/operations.ts`: cálculo exacto de saldos, transiciones y contratos compartidos.
- `apps/web/src/features/operations/` y rutas `/operaciones`, `/operaciones/nueva`, `/operaciones/[id]`, `/cobros`, `/cobros/nuevo`.
- Integraciones en `quote-detail.tsx`, `quote-timeline.tsx`, `resource-detail.tsx` y `app-shell.tsx`; hook de búsqueda con espera breve.
- Pruebas unitarias, integración, E2E y limpieza de fixtures extendida a las tablas nuevas.
- README, permisos, esta entrega y guía de uso/API.

## API y migraciones

[Guía detallada](phase-4-guide.md): enumera los trece endpoints, contratos, permisos, filtros, reglas y pasos del flujo completo. Swagger disponible en `/api/docs`.

Se aplicaron las tres migraciones nuevas en PostgreSQL local, de forma aditiva, conservando las tres de fases anteriores. No hubo reset ni eliminación de datos comerciales. Las tablas nuevas mantienen índices de tenant, unicidad de números/requestKey/cotización, claves compuestas y restricciones monetarias, de fechas, responsable y reversos.

## Validación

Resultados reales del 27 de octubre de 2026:

| Comprobación | Resultado |
|---|---|
| `pnpm lint` | Aprobado |
| `pnpm typecheck` | Aprobado en todos los paquetes |
| `pnpm test` | 22 aprobadas |
| `pnpm test:integration` | 11 aprobadas con PostgreSQL local |
| Integración fase 4 después del ajuste final de requestKey | 3 aprobadas |
| `pnpm build` | Aprobado, API y Next con las cinco rutas nuevas |
| Playwright completo, Edge | 7 aprobadas en una ejecución final de 2,3 minutos |
| Instalación con lockfile congelado, offline y lockfile-only | Aprobada; sin resolver versiones nuevas |
| Migraciones locales | Las 6 migraciones versionadas aplicadas: 3 anteriores y 3 nuevas |

Los casos cubren creación manual de ambos tipos, conversión y duplicados, snapshots históricos tras cambios/archivado del catálogo, transición y edición obsoleta, conservación de campos no enviados en PATCH, pagos parciales/totales/concurrentes, saldo y reversos, sobrepago, cancelación con pagos, roles, IDOR, indicadores SQL, filtros y responsive. Se verificó además la restricción SQL que impide un reverso sin motivo y la independencia de las claves de creación manual frente a UUIDs de cotización.

Capturas locales de revisión visual: `test-results/phase4-cobros-mobile.png` y `test-results/phase4-operation-desktop.png`. Los resultados de Playwright permanecen en `test-results/.last-run.json`; los artefactos de pruebas se excluyen de Git. Sin errores bloqueantes conocidos en los flujos verificados.

## Límites

Una operación principal por cotización; CLP; IVA 19% o exento; pagos y reversos administrativos manuales. Sin cambios al total confirmado, reapertura de operaciones cerradas, ajustes contables, conciliación, pasarela, devoluciones bancarias, inventario ni fase 5. Operaciones canceladas conservan sus movimientos y quedan fuera de indicadores activos. El bloqueo por organización serializa las escrituras financieras para priorizar integridad en este MVP. E2E se ejecuta localmente con Edge; CI conserva lint, tipos, unitarias, integración y build, sin añadir despliegues.

Para revisar: iniciar sesión, crear un pedido manual, iniciar el trabajo, registrar dos abonos, revertir uno con motivo y comprobar saldo e historial en Cobros; después aprobar una cotización y convertirla. El detalle de cliente permite localizar ambas operaciones. La guía incluye los comandos de actualización local.
