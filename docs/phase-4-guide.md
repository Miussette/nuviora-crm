# Operaciones y Cobros — Fase 4

## Actualización local

Conservar `.env` y el volumen existente. Ejecutar desde la raíz:

```powershell
pnpm install --frozen-lockfile
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Si el desarrollo ya estaba iniciado, reiniciarlo después de generar Prisma. No ejecutar `migrate reset`, borrar el volumen ni usar `db push` para reemplazar migraciones. La aplicación continúa en localhost:3000 y Swagger en localhost:3001/api/docs.

En PowerShell, si la política de ejecución bloquea el lanzador `.ps1`, usar `pnpm.cmd` en lugar de `pnpm`; no hace falta cambiar la política del sistema.

## Flujo completo

1. Crear o seleccionar un cliente y conceptos del catálogo.
2. En **Operaciones → Nueva operación**, elegir Pedido o Trabajo, cliente, fechas, responsable y descripción. Agregar conceptos del catálogo o personalizados, cantidad, precio neto, descuento porcentual e IVA/exención. Guardar confirma los importes.
3. Como alternativa, aprobar una cotización por su enlace y entrar a su detalle: **Crear operación**. Elegir tipo, descripción y datos operativos. Se copia el cliente histórico y cada concepto e importe aprobado, incluso si el catálogo cambió o se archivó después.
4. En el detalle consultar Resumen, Detalle, Cobros e Historial. Asignar responsables y editar información operativa antes del cierre. Iniciar una operación pendiente y completarla cuando corresponda.
5. En **Cobros → Registrar pago**, buscar la operación. El cliente y saldo se derivan de ella. Registrar monto, fecha, método, referencia y observaciones. Un abono deja el cobro Parcial; cubrir el saldo lo deja Pagado.
6. En la pestaña Cobros de la operación, **Revertir pago**, ingresar motivo y confirmar. El movimiento permanece visible, con actor y fecha en el historial, y vuelve a incrementar el saldo.
7. Consultar los indicadores y filtros de Cobros y las operaciones asociadas desde el detalle de cliente. Las tarjetas móviles muestran la misma información que la tabla de escritorio.

## Reglas del MVP

- Una operación principal por cotización; `quoteId` único y conversión transaccional. Un reintento devuelve la ya existente sin duplicar conceptos, números ni eventos. No se permite convertir borradores, enviadas, rechazadas, vencidas o canceladas.
- El total comercial queda confirmado al crear. No hay endpoint para editar cliente, conceptos o importes después; PATCH admite únicamente información operativa, responsable, fecha comprometida y versión. Correcciones comerciales requieren cancelar sin pagos vigentes y crear una nueva operación; la cancelada permanece en el historial. No hay notas de crédito ni ajustes contables en esta fase.
- Pendiente → En proceso o Cancelado. En proceso → Completado o Cancelado. Completado y Cancelado son finales. Se permite crear manualmente en Pendiente o En proceso; desde cotización comienza Pendiente.
- Completar no paga la operación y pagar no la completa. Para cancelar se deben revertir todos los pagos vigentes; no se borran movimientos. No se admiten pagos nuevos sobre operaciones canceladas. Las completadas sí pueden recibir pagos.
- Total abonado = suma de pagos no revertidos; saldo = total confirmado menos abonado. Estado derivado, nunca editable: Pendiente si abonado=0 y total>0, Parcial entre cero y total, Pagado al cubrir el total. Una operación de total cero se considera Pagada, sin admitir pagos positivos.
- Dinero exacto: BigInt en el cálculo compartido, NUMERIC/Decimal en PostgreSQL y strings decimales en API; no se usa coma flotante para dinero. Descuento porcentual por línea; IVA 19% o exento, como las cotizaciones.
- Fecha comprometida no anterior a creación; fecha de pago entre la creación y el día actual chileno. Fechas comerciales DATE; eventos y reversos conservan instantes UTC y se muestran en America/Santiago.
- Creaciones manuales y pagos requieren UUID `requestKey` estable por intento. El mismo UUID con otro contenido devuelve 409. No se deduplican pagos distintos solo por compartir monto o referencia: dos abonos legítimos pueden coincidir.
- Operaciones/pagos solo son modificables por OWNER o ADMIN. MEMBER consulta. Responsables pueden ser miembros de cualquier rol de la misma empresa. No se implementa edición de membresías en esta fase.
- Pagos manuales y reversos administrativos: no se confirma recepción bancaria, no hay pasarela y un reverso no transfiere ni devuelve dinero.

## API

Todas las rutas parten de `/api/v1`, requieren cookie de sesión y `X-Organization-Slug`. Escrituras exigen Origin permitido y rol OWNER/ADMIN. `organizationId` se obtiene de la membresía y no se acepta desde el cliente. UUIDs ajenos reciben 404.

| Método | Ruta | Uso |
|---|---|---|
| GET | `/operations` | Listado y saldos derivados, paginado en PostgreSQL |
| POST | `/operations` | Crear pedido/trabajo manual confirmado |
| GET | `/operations/assignees` | IDs y nombres de miembros asignables |
| GET | `/operations/:id` | Detalle, conceptos, movimientos y saldos |
| PATCH | `/operations/:id` | Editar datos operativos con `version` |
| POST | `/operations/:id/status` | Transición con `status` y `version` |
| GET | `/operations/:id/events` | Eventos persistentes con actor y metadata |
| POST | `/quotes/:id/convert-to-operation` | Convertir aprobada; cuerpo: type, issueDate, description y datos operativos opcionales |
| GET | `/payments` | Movimientos paginados, incluidos reversos |
| POST | `/payments` | Registrar monto string, operationId, requestKey, paidAt, method y campos opcionales |
| GET | `/payments/:id` | Pago y evidencia del reverso |
| POST | `/payments/:id/reverse` | `{ confirmed: true, reason: "motivo" }`; actor de sesión |
| GET | `/receivables/summary` | Totales y conteos calculados en PostgreSQL |

`operations`: page, pageSize (máximo 100), search, status, type, customerId, operationId, paymentStatus, from, to. Orden estable por creación e ID descendentes. Búsqueda por número, cliente histórico y descripción; fechas filtran `issueDate`. `payments`: mismos filtros comerciales y fechas sobre `paidAt`; incluye movimientos revertidos para auditoría. `summary`: filtros comerciales; saldos y conteos vigentes excluyen Cancelado, y `collectedInPeriod` suma pagos vigentes por su fecha de pago dentro del período. Las fechas no ocultan deuda antigua del indicador total por cobrar. Swagger documenta DTOs, métodos, fechas e importes.

Los selects muestran resultados acotados y admiten búsqueda para localizar otras cotizaciones, clientes u operaciones. Los listados principales tienen paginación real.

## Migraciones y concurrencia

`202610270002_operations_payments` agrega Operation, OperationItem, Payment, OperationEvent y OperationSequence, enums y evento CONVERTED, índices y claves compuestas de tenant. `202610270003_operation_constraints` agrega CHECKs monetarios, reversos completos, fechas y FK del responsable contra su membresía. `202610270004_payment_reversal_reason` exige motivo no nulo al revertir, ya que PostgreSQL acepta expresiones NULL en un CHECK. Las tres son aditivas: no eliminan tablas ni datos anteriores.

Conversión: bloqueo de organización y cotización, comprobación de aprobado, unicidad de quoteId y copia histórica en una transacción. Creación y pagos: bloqueo de organización para requestKey/numeración; bloqueo de la operación para validar saldo antes de insertar. Reversos, cambios de estado y edición bloquean la misma operación. Saldo y pago se comprueban dentro del bloqueo; dos pagos simultáneos no pueden consumir el mismo saldo. Indicadores/listados usan una instantánea Repeatable Read. SQL usa parámetros Prisma, nunca interpola texto del navegador como SQL.

## Verificación

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
$env:PLAYWRIGHT_CHANNEL='msedge'
pnpm exec playwright test
```

Integración requiere PostgreSQL migrado. E2E también usa Mailpit y servidores aislados en 3100/3101. Las fixtures borran únicamente sus propios UUIDs al finalizar. No hay despliegue ni fase 5.

Limitaciones deliberadas: una operación por cotización, CLP, pagos manuales, sin ajustes del total confirmado, reapertura, devoluciones bancarias, inventario, conciliación o comprobantes tributarios. El bloqueo de organización prioriza integridad en el MVP y serializa sus escrituras financieras; puede afinarse si aumenta el volumen. Consultar la entrega para resultados reales de validación.
