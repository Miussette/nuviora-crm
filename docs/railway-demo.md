# Demo en Railway

Esta configuración publica una demostración con datos ficticios. No habilita facturación de suscripciones ni constituye un lanzamiento comercial.

## Servicios

Crear un proyecto de Railway con PostgreSQL y un servicio conectado a este repositorio, rama `demo/railway`. Usar la raíz del repositorio, sin configurar una carpeta raíz de monorepo. `railway.json` selecciona `Dockerfile.demo`; la aplicación contiene Next.js y la API, que solo escucha dentro del contenedor. PostgreSQL debe permanecer en la red privada.

## Variables del servicio de aplicación

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | Referencia a la conexión privada de PostgreSQL, por ejemplo `${{Postgres.DATABASE_URL}}` si el servicio se llama Postgres |
| `DEMO_MODE` | `true` |
| `DEMO_EMAIL` | `demo@nuviora.example` |
| `DEMO_PASSWORD` | Secreto nuevo de 16 a 128 caracteres, configurado únicamente en Railway |
| `PORT` | `3000` |

Generar un dominio público de Railway con puerto 3000. El arranque utiliza `RAILWAY_PUBLIC_DOMAIN` para determinar el origen HTTPS. Si se usa otro dominio, configurar `APP_ORIGIN` con su origen HTTPS exacto. No copiar `.env` local ni configurar SMTP externo.

Las migraciones y la carga inicial se ejecutan antes del despliegue. Cualquier error detiene la nueva versión. El healthcheck es `/api/v1/health`.

## Datos y acceso

El seed requiere una base dedicada vacía y crea una cuenta verificada, tres clientes, dos artículos, dos cotizaciones y tres operaciones con cobros de ejemplo. No imprime la contraseña. Iniciar sesión con `DEMO_EMAIL` y el secreto configurado en `DEMO_PASSWORD`, compartido por un canal privado.

Repetir el despliegue conserva los datos existentes. Cambiar `DEMO_PASSWORD` actualiza la contraseña de la cuenta demo y revoca sus sesiones en el siguiente predeploy. Cambiar el correo requiere una base nueva o una migración explícita; no modifica cuentas existentes por coincidencia de slug.

El modo demo muestra un aviso, bloquea el registro público, recuperación por correo, invitaciones y transferencia de propiedad. Los visitantes con acceso comparten la misma cuenta y pueden modificar los datos ficticios. No ingresar información personal o comercial real. No hay reinicio automático de datos.

## Verificación tras publicar

1. Abrir `/login` por HTTPS y comprobar el aviso de demo.
2. Iniciar sesión y entrar a Empresa de demostración.
3. Revisar clientes, catálogo, cotizaciones, operaciones y cobros.
4. Descargar una cotización PDF y un reporte CSV.
5. Comprobar que el registro público no permite crear cuentas.

El proyecto todavía requiere conectar una cuenta de Railway y desplegar para disponer de URL pública. La compilación y las verificaciones locales no equivalen a un despliegue en Railway.

## Evidencia local

El 27 de octubre de 2026 se construyó la imagen final, se aplicaron las ocho migraciones a una base temporal aislada y se comprobó el arranque de Next/API. Repetir el seed conservó exactamente una cuenta, tres clientes, dos cotizaciones, tres operaciones y dos pagos. El dashboard devolvió ventas de $269.000, cobros de $125.000 y saldo de $144.000.

`deploy/check-demo.mjs` comprobó acceso, dashboard autenticado sin caché, PDF, CSV y bloqueo de registro/invitaciones. Requiere `DEMO_CHECK_URL`, `DEMO_PASSWORD` y opcionalmente `DEMO_EMAIL`; no imprime credenciales. En Railway, usar la URL HTTPS como `DEMO_CHECK_URL`.

Lint, tipos de API/web, 28 pruebas unitarias, las 16 pruebas de integración completas y los 10 E2E de navegador pasaron. Las verificaciones de datos sintéticos no sustituyen las pruebas operativas necesarias para empresas reales.
