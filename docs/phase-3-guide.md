# Cotizaciones — Uso y API

## Actualización local

Conserva `.env` y el volumen existente. Desde la raíz, con Docker iniciado:

```powershell
pnpm install --frozen-lockfile
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Si ya tenías el proceso de desarrollo iniciado, reinícialo después de generar Prisma. No uses migrate reset, db push destructivo ni borres el volumen. La aplicación sigue en localhost:3000 y la API en 3001. Los enlaces se generan usando APP_ORIGIN: para compartir fuera de este computador necesitarás posteriormente un despliegue HTTPS autorizado; localhost no es accesible desde el teléfono de un cliente.

## Recorrido de uso

1. En Empresa, configura opcionalmente logo propio, color y pie en Diseño de tus cotizaciones. Sin logo, se usa el nombre del negocio, no el logo de Nuviora.
2. En Cotizaciones, pulsa Nueva cotización. Busca y selecciona un cliente real. Completa emisión, vencimiento y referencia opcional.
3. Agrega productos/servicios activos del catálogo o conceptos personalizados. Edita descripción, cantidad, unidad, precio neto, descuento porcentual e IVA/exención. Puedes mover o eliminar líneas.
4. Revisa el resumen y las condiciones. Vista previa muestra el documento preliminar; Guardar borrador recalcula y guarda en servidor. Un borrador puede no tener ítems, pero siempre necesita cliente.
5. En el detalle, edita o descarga el PDF de vista previa. Enviar y compartir exige al menos un ítem, datos válidos, cliente activo y vencimiento futuro. La confirmación congela el documento y cierra la edición.
6. Genera un enlace de 1–90 días y cópialo o abre el mensaje preparado de WhatsApp. El envío es preparación del documento para compartir; no se envía correo comercial automáticamente.
7. El destinatario abre `/cotizacion/[publicToken]` sin sesión y revisa la propuesta. Para decidir, confirma explícitamente la versión; nombre declarado y motivo de rechazo son opcionales.
8. Consulta estado, evidencia e historial desde el detalle. Duplicar crea un documento independiente, otro número y nuevas fechas. Una aprobada queda lista como referencia para una futura operación, sin crearla todavía.

La ficha de cliente muestra sus cotizaciones reales. El listado permite buscar por número/cliente/referencia y filtrar por estado, cliente y fechas de creación chilenas.

## Cálculo financiero

Moneda CLP; importes exactos con hasta 16 dígitos enteros y 2 decimales. Cantidades positivas hasta 8 enteros y 4 decimales. Descuento porcentual por línea entre 0 y 100, hasta 2 decimales. Tasas disponibles: IVA 19% o exento.

Se redondea half-up por línea: cantidad × precio → bruto a 2 decimales; descuento porcentual → descuento a 2 decimales; neto = bruto − descuento; IVA sobre neto → impuesto a 2 decimales. Los totales son sumas de líneas. La base imponible incluye solo netos afectos; el monto exento se muestra aparte.

Ejemplo: 2 × $100, 10% de descuento, IVA 19% → bruto $200, descuento $20, neto $180, IVA $34,20 y total $214,20. Un servicio exento de 1,5 × $50 agrega $75: total de cotización $289,20. Los cálculos usan enteros escalados BigInt y se persisten como Decimal; no pasan por Number.

## Versiones, estados y garantías

- DRAFT admite edición optimista con documentVersion. Cada guardado incrementa versión; guardar sobre una versión obsoleta devuelve 409.
- Enviar incrementa versión, congela emisor/cliente/diseño y calcula el hash del JSON comercial. Los ítems ya son snapshots. SENT es de solo lectura; para cambiar contenido comercial se duplica.
- Transiciones: DRAFT→SENT/CANCELLED; SENT→APPROVED/REJECTED/EXPIRED/CANCELLED. Los demás estados son finales.
- Vencimiento inclusivo al final de expiryDate en America/Santiago, incluidos cambios de horario. El servidor impide decisiones fuera de plazo, aunque no se haya consultado la lista. La materialización de EXPIRED y su evento ocurre al consultar/operar; no hay un cron simulado.
- La aceptación acredita posesión del enlace y decisión declarada. No verifica identidad ni constituye por sí sola firma electrónica avanzada. Se registra versión/huella, decisión, hora, nombre/motivo opcionales y evidencia técnica mínima sin IP/fingerprint persistente.
- Repetir la misma decisión con el mismo enlace válido devuelve el resultado ya registrado; una decisión opuesta se rechaza. Aprobación, estado y evento son atómicos.
- El PDF es una cotización comercial y no una factura electrónica del SII.

## Enlaces

Se guarda únicamente SHA-256 del token aleatorio de 256 bits. La URL secreta se devuelve solo al generar el enlace. Después de cerrar/recargar el diálogo no puede recuperarse desde el hash: genera uno nuevo si no conservas la URL. Generar uno nuevo revoca los anteriores. Revocar no borra el documento ni una decisión histórica.

La vigencia del enlace es independiente de la fecha comercial: un enlace todavía activo puede mostrar una cotización vencida de solo lectura. Tokens expirados/revocados y documentos cancelados devuelven 410. No se exponen UUID comerciales, notas internas de cliente, seguimientos privados, usuarios ni evidencia técnica en la proyección pública. Los campos Observaciones/Notas para el cliente del editor sí forman parte del documento comercial.

La limitación pública es de 20 solicitudes por minuto e IP/handler, además de los límites internos existentes. No index/no cache reducen exposición accidental; la seguridad del documento depende de conservar el secreto del enlace. La interfaz informa de esta capacidad al compartir.

## API interna

Base `/api/v1`. Cookie `nuviora_session`, membresía y `X-Organization-Slug`. Las escrituras requieren Origin=APP_ORIGIN y OWNER/ADMIN; MEMBER consulta documentos, eventos y PDF. organizationId, número, estado y totales no se aceptan en cuerpos del editor.

| Método | Ruta | Uso |
|---|---|---|
| GET | `/quotes` | Listar/paginar/buscar/filtrar |
| POST | `/quotes` | Crear borrador idempotente |
| GET | `/quotes/:id` | Detalle, snapshots y enlaces activos sin secretos |
| PATCH | `/quotes/:id` | Reemplazar contenido editable del borrador con versión |
| POST | `/quotes/:id/send` | Enviar y congelar versión |
| POST | `/quotes/:id/cancel` | Cancelar y revocar enlaces |
| POST | `/quotes/:id/duplicate` | Nuevo borrador idempotente |
| GET | `/quotes/:id/pdf` | PDF autorizado, sin caché |
| POST | `/quotes/:id/share` | Rotar/generar enlace |
| POST | `/quotes/:id/share/revoke` | Revocar todos los enlaces de la cotización |
| GET | `/quotes/:id/events` | Historial completo autorizado |
| POST | `/quotes/:id/follow-ups` | Nota interna de seguimiento, solo SENT |
| GET/PATCH | `/organizations/:slug/quote-branding` | Consultar/guardar logo, color y pie; slug de ruta y encabezado deben coincidir |

Listado: `page`, `pageSize` (máximo 100), `search`, `status`, `customerId`, `from`, `to`. Fechas YYYY-MM-DD; filtran la creación, no la emisión. Respuesta `{data,total,page,pageSize}`. Estados se envían como DRAFT, SENT, APPROVED, REJECTED, EXPIRED, CANCELLED.

Ejemplo de creación (UUID de cliente/catálogo reales de la empresa):

```json
{
  "requestKey": "UUID estable para este intento",
  "customerId": "UUID del cliente",
  "issueDate": "2026-10-27",
  "expiryDate": "2026-11-27",
  "reference": "Propuesta comercial",
  "items": [{
    "catalogItemId": "UUID opcional del catálogo",
    "name": "Servicio",
    "description": "Descripción editable",
    "unit": "Hora",
    "quantity": "2",
    "unitPrice": "100.00",
    "discount": "10",
    "taxMode": "VAT_19"
  }],
  "notes": "Observaciones comerciales",
  "paymentTerms": "Transferencia",
  "deliveryTerms": "5 días",
  "validityTerms": "Hasta el vencimiento",
  "customerNotes": "Notas para el destinatario"
}
```

En conceptos personalizados omite catalogItemId. Hasta 100 líneas. PATCH usa el mismo contenido más documentVersion y sin requestKey. POST send usa `{documentVersion}`. POST duplicate usa `{requestKey}`. Compartir usa `{expiresInDays:7}`. Follow-up usa `{note}`. Todos los importes/cantidades/descuentos viajan como string.

requestKey debe ser UUID. Reutiliza exactamente la misma clave y cuerpo al reintentar la creación; otro contenido con esa clave devuelve 409. La clave de duplicación también es UUID estable por intento. La numeración es transaccional y única por empresa. La base también valida pertenencia de cliente/catálogo/cotización mediante FK compuestas.

## API pública

| Método | Ruta |
|---|---|
| GET | `/api/v1/public/quotes/:token` |
| POST | `/api/v1/public/quotes/:token/approve` |
| POST | `/api/v1/public/quotes/:token/reject` |

Cuerpo de decisión: `{documentVersion:2,confirmed:true,approverName:"Nombre opcional",reason:"Motivo opcional"}`. reason se conserva solo al rechazar. No se exige sesión; sí un enlace vigente y una cotización apta. Los POST del navegador están protegidos por el origen de la aplicación. HTTP 400: entrada inválida; 401: falta sesión interna; 403: rol/origen; 404: recurso interno ajeno/inexistente; 409: estado/versión/conflicto idempotente; 410: enlace no disponible; 429: límite de solicitudes.

## Pruebas y límites

`pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck`, `pnpm build`. Para navegador: `$env:PLAYWRIGHT_CHANNEL='msedge'; pnpm exec playwright test`. Se usan PostgreSQL y Mailpit locales; puertos E2E 3100/3101 y compilación aislada `.next-e2e`.

No hay envío automático por email, integración oficial de WhatsApp, firma avanzada, inventario ni conversión a operación. No se han contratado servicios, publicado la aplicación ni verificado un despliegue de producción. Un despliegue futuro necesita HTTPS, configuración de proxy/logs que no exponga tokens, rate limiting distribuido, políticas de retención/respaldo y revisión de seguridad/accesibilidad. La caducidad se evalúa en las peticiones y las visualizaciones se agrupan cada 15 minutos por enlace.
