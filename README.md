# Nuviora Gestión

SaaS B2B para Chile. Implementa las fundaciones de Fase 1, **Clientes y Catálogo de Fase 2** y **Cotizaciones profesionales de Fase 3**, con PDF y decisiones por enlace. No es una versión comercial lista para lanzamiento.

## Requisitos

Node.js 24, pnpm 10.34.9 y Docker Desktop con motor Linux iniciado. Los servicios PostgreSQL y SMTP están limitados a loopback.

## Ejecutar localmente (PowerShell)

```powershell
Copy-Item .env.example .env
pnpm install --frozen-lockfile
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

No sobrescribas un `.env` existente. Las credenciales de ejemplo son solo para el contenedor local. PostgreSQL escucha en **55432** para evitar conflictos con otros proyectos. Las migraciones versionadas crean tablas e incorporan campos de forma aditiva; no borran datos. `pnpm dev` compila primero el paquete compartido de validaciones.

Si actualizas desde una fase anterior: detén solo tu proceso `pnpm dev`, ejecuta `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm db:migrate` y vuelve a iniciar `pnpm dev`. No uses reset ni borres el volumen de PostgreSQL.

- Aplicación: http://localhost:3000
- API: http://127.0.0.1:3001/api/v1
- Swagger: http://127.0.0.1:3001/api/docs
- Health: http://127.0.0.1:3001/api/v1/health
- Bandeja de correos local: http://localhost:8025

Usa `localhost:3000` como origen del navegador; `127.0.0.1:3000` es otro origen y las escrituras se rechazan por diseño. El proxy apunta por defecto al puerto API 3001. `API_INTERNAL_ORIGIN` permite ajustar su destino en el servidor de Next; actualiza también PORT y APP_ORIGIN al cambiar puertos.

## Qué probar

1. Abre `/registro`, usa una contraseña de al menos 12 caracteres y acepta los términos del entorno local.
2. Registra una empresa con su correo y tipo de negocio. Los datos opcionales no bloquean el acceso.
3. Revisa inicio, actividad real, perfil, empresa y usuarios. Los roles OWNER/ADMIN pueden editar empresa; MEMBER solo puede verla.
4. Abre Mailpit y el enlace de verificación. El token viaja en el fragmento de URL y se consume al confirmar.
5. Cierra sesión e ingresa de nuevo. Crea otra empresa y usa el selector para cambiar de espacio.
6. Prueba recuperación de contraseña desde `/recuperar-contrasena`; el correo aparece en Mailpit. Cambiar contraseña revoca todas las sesiones anteriores.
7. En otro navegador crea otra cuenta y pega el enlace de la empresa anterior: el servidor rechaza el acceso.

No existen usuarios predeterminados ni un seed con información ficticia. Las pruebas crean registros temporales identificados y los eliminan al terminar.

## Clientes y catálogo

Desde el menú lateral abre **Clientes**: crea una persona o empresa, ingresa opcionalmente un RUT válido (por ejemplo `12.345.678-5`, exclusivamente para pruebas), guarda, edita y busca. Filtra por tipo o estado, cambia el orden y pagina. Archivar pide confirmación; el registro permanece disponible con el filtro Archivados y queda de solo lectura.

Abre **Catálogo** y agrega un producto o servicio según el tipo de negocio habilitado. Introduce un precio neto como `19990.25`, unidad, IVA 19% o exención, SKU opcional y estado activo/inactivo. El SKU se normaliza a mayúsculas y es único por empresa, incluso archivado. Los precios viajan como texto decimal y se guardan con precisión exacta. Inactivo no equivale a archivado.

OWNER y ADMIN pueden crear, editar y archivar; MEMBER solo consulta. Cambiar de empresa mantiene los datos separados. Las secciones comerciales futuras de la ficha de cliente indican que están pendientes sin mostrar datos inventados.

API y ejemplos: [guía de Fase 2](docs/phase-2-guide.md). Archivos y resultados: [entrega de Fase 2](docs/phase-2-delivery.md).

## Cotizaciones

En **Cotizaciones**, crea un borrador con un cliente real, agrega catálogo o conceptos personalizados, ajusta cantidades/precios/descuentos/impuestos y revisa la vista previa. Los importes se recalculan en servidor con aritmética exacta. Solo se editan borradores; enviar congela la versión comercial, incluyendo datos históricos de empresa y cliente.

Descarga el PDF multipágina, genera un enlace con expiración y compártelo por copia o mensaje preparado de WhatsApp. El cliente puede aprobar o rechazar con confirmación explícita; la decisión, versión y evidencia quedan en el historial. La aprobación por enlace usa identidad declarada, no verificación de identidad ni firma electrónica avanzada. El PDF no es una factura electrónica del SII.

En **Empresa → Diseño de tus cotizaciones** puedes configurar logo propio (PNG/JPEG, 256 KB), color y pie. No se impone el logo de Nuviora como emisor. Las cotizaciones enviadas conservan su diseño aunque cambies la configuración después.

La numeración es única por empresa y transaccional. Los enlaces pueden rotarse o revocarse, y solo se guarda su hash. Una cotización aprobada se puede duplicar como otro borrador; la conversión a operación queda para la Fase 4. La ficha del cliente muestra sus cotizaciones reales.

Uso, cálculos, endpoints y garantías: [guía de Fase 3](docs/phase-3-guide.md). Archivos, migración y resultados: [entrega de Fase 3](docs/phase-3-delivery.md). Los enlaces de un entorno localhost funcionan solo en ese equipo hasta que se autorice y configure un despliegue HTTPS.

## Verificación

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm exec playwright install chromium
pnpm exec playwright test
```

Si ya tienes Microsoft Edge, puedes usarlo sin descargar otro navegador: `$env:PLAYWRIGHT_CHANNEL='msedge'; pnpm exec playwright test`.

E2E usa por defecto **3100 y 3101**, con Next en `.next-e2e`, sin interferir con el desarrollo en 3000/3001. Cambia `E2E_WEB_PORT` / `E2E_API_PORT` si están ocupados. La opción `PLAYWRIGHT_REUSE_SERVER=1` reutiliza servidores de prueba que ya estén preparados en esos puertos.

Las pruebas de integración requieren PostgreSQL migrado. E2E requiere también Mailpit y arranca su API compilada y Next en modo desarrollo aislado. Prueba autenticación, correo, Clientes, Catálogo y Cotizaciones, incluidos PDF, enlace, aprobación/rechazo, revocación, expiración, roles y móvil. La conversión a operación y los cobros quedan para las fases posteriores.

CI ejecuta lint, tipos, unitarias, integración y build con PostgreSQL. E2E local se documenta por separado; todavía no está agregado a CI.

## Estructura

`apps/web`: Next.js App Router, React, Tailwind, React Query, React Hook Form, Zod y TanStack Table con tarjetas móviles. `apps/api`: NestJS, Prisma, DTOs, Swagger, logging JSON, PDFKit y Sharp para logos. `packages/domain`: validación de RUT, cálculo exacto y fechas chilenas de cotizaciones. `packages/ui`: base shadcn/ui personalizada. `packages/types`: contratos. `packages/config`: TypeScript estricto compartido. Recharts queda reservado para los indicadores futuros.

## Alcance y límites

Clientes, Catálogo y Cotizaciones funcionan con API y PostgreSQL. Operaciones, pagos y suscripciones siguen pendientes. No hay control de inventario, restauración de archivados ni eliminación física de registros comerciales. Los documentos comerciales enviados son de solo lectura; para una nueva emisión se duplican como borradores.

SMTP local no entrega correos reales. Invitaciones, edición de roles, búsqueda contextual y notificaciones quedan pendientes. Roles existentes y su aplicación en servidor sí están implementados. La moneda y país se fijan a CLP/Chile para esta fase.

Antes de producción: revisión de seguridad y accesibilidad, términos y privacidad definitivos, versiones soportadas y auditoría de dependencias, HTTPS y proxy, SMTP real, limitador distribuido, respaldo/restauración y limpieza periódica de sesiones/tokens vencidos. La base y la entrega local no equivalen a una certificación de producción.

Decisiones: [arquitectura](docs/architecture.md), [datos](docs/database-design.md), [permisos](docs/permissions.md) y [plan](docs/implementation-plan.md).

Detener servicios conservando datos: `docker compose stop`. No se ejecuta despliegue ni se habilitan servicios pagos.
