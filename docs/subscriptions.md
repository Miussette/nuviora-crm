# Suscripciones SaaS — estado actual y diseño de 6.3

## Estado actual

Fase 5 implementa límites centrales EMPRENDE=1, NEGOCIO=3 y EQUIPO=8, cupos reservados por invitaciones y disponibilidad de módulos. Sin fila Subscription, se conserva una asignación local EQUIPO/UNCONFIGURED para no retirar funcionalidades del desarrollo. `billingEnabled` es false y `renewalAt` es null. El propietario puede configurar acceso local, no contratar ni pagar. Esta política **no es apta como política de acceso de un SaaS comercial**.

No existen trial comercial, período de gracia, cargos SaaS, historial de facturación real ni webhooks implementados. `Payment` corresponde exclusivamente a los abonos que una pyme registra de sus clientes.

## Modelo que debe implementarse

Separar catálogo/versiones de planes y precios; contrato de suscripción de la organización; estado de acceso derivado; cargos/eventos del proveedor; documentos tributarios y su emisor. Crear tablas SaaS propias, sin reutilizar Operation/Payment del negocio cliente.

Hipótesis entregadas por el producto: EMPRENDE 9.990, NEGOCIO 19.990 y EQUIPO 34.990 CLP netos mensuales, más IVA. Aún no son precios configurados en el sistema. Persistir versiones editables con vigencia y moneda; no cambiar retroactivamente lo contratado. Acordar redondeo CLP e impuestos con el proveedor y la revisión tributaria, sin confundir un recibo de pasarela con un DTE del SII.

Estados previstos: TRIALING, ACTIVE, PAST_DUE, CANCELED y EXPIRED. Trial inicial configurable de 14 días y gracia configurable; fechas calculadas por el servidor y persistidas, nunca simuladas en el cliente. Definir explícitamente cancelación inmediata o al cierre del período, reactivación, cambios de plan, cupos existentes y acceso durante gracia. Conservar lectura/exportación de datos según política y derechos aplicables; una deuda SaaS no borra movimientos de la pyme.

## Proveedores a evaluar

[Flow](https://developers.flow.cl/api) documenta clientes/cargos recurrentes y suscripciones. [Mercado Pago Chile](https://www.mercadopago.cl/developers/es/reference/online-payments/subscriptions/overview) documenta suscripciones/preapproval. Son candidatos, no proveedores seleccionados ni integraciones verificadas. Confirmar elegibilidad del comercio, contratos, medios admitidos, moneda, sandbox, tarifas, devoluciones y documentos tributarios. Cada adaptador debe usar el mecanismo de autenticidad oficialmente soportado; no asumir firmas de webhook equivalentes entre proveedores.

## Procesamiento fiable pendiente

1. Validar autenticidad con el mecanismo oficial y, cuando corresponda, consultar estado por API autenticada. Preservar raw body si la firma lo exige; un retorno del navegador nunca confirma un cargo.
2. Resolver la organización desde una correlación interna persistida, no desde un organizationId arbitrario del payload.
3. Guardar inbox con clave única proveedor/evento, hash, estado, intentos y errores saneados. Payloads/retención requieren protección de datos.
4. Bajo transacción/lock, aplicar únicamente transiciones coherentes con el estado confirmado. Un evento tardío no debe revertir una cancelación válida ni duplicar un cargo.
5. Acusar recibo después de persistir; reintentar de forma acotada e idempotente; conciliar periódicamente con el proveedor.
6. Mostrar pendiente/exitoso/fallido/trial vencido/cancelado solo a partir del estado del servidor. Sin proveedor configurado, no ofrecer un checkout real.

Pruebas pendientes: firma falsa, duplicado, replay, importe/moneda alterados, evento fuera de orden, timeout, reconciliación, gracia, vencimiento exacto, cancelación y cambio de plan bajo concurrencia. La activación de credenciales y cobros reales requiere autorización explícita.
