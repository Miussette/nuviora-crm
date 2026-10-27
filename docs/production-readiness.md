# Auditoría de preparación para producción

Fecha: 27 de octubre de 2026. Alcance: repositorio local, código, migraciones, configuración y evidencia de pruebas de fases 1–5. No se inspeccionó infraestructura de producción ni se realizaron despliegues. Este documento inicia la fase 6; no certifica su implementación completa.

## Dictamen actual: NO-GO

No habilitar empresas reales ni cobros de suscripción hasta cerrar los bloqueantes y verificar las puertas de lanzamiento. La aplicación sigue siendo un entorno de desarrollo con una asignación local de planes, sin suscripción comercial activa.

## Estado real de las fases anteriores

| Área | Evidencia disponible | Estado |
|---|---|---|
| Autenticación y empresas | scrypt con sal; sesiones opacas; tokens hash; cookies HttpOnly/SameSite y Secure en producción; reset revoca sesiones; verificación de correo | Implementado localmente; falta endurecimiento/validación de producción |
| Roles y tenant | Membership activa por petición; OWNER/ADMIN/MEMBER; DTO sin organizationId; relaciones compuestas y pruebas de IDOR | Implementado y probado en integración |
| Clientes y catálogo | CRUD, archivo lógico, validación de RUT, precios exactos y filtros | Implementado; regresiones previas aprobadas |
| Cotizaciones y aprobaciones | snapshots, PDF protegido, token público, aprobación/rechazo atómicos, expiración y evidencias | Implementado; E2E completo aprobado después del ajuste del limitador |
| Operaciones y cobros | conversión idempotente, importes confirmados, bloqueos de fila/organización, abonos, reversos y CHECKs | Implementado y probado en integración |
| Dashboard/reportes | SQL/Prisma reales, períodos por zona, comparaciones, Recharts, CSV protegido | Implementado; pruebas nuevas aprobadas |
| Usuarios/configuración | invitaciones SMTP, aceptación verificada, roles, desactivación, transferencia con contraseña y aceptación | Implementado; pruebas nuevas aprobadas |
| Suscripciones | límites 1/3/8 y módulos centrales; `Subscription.status=UNCONFIGURED`; interfaz de proveedor sin implementación | Preparación local, NO facturación comercial |

### Evidencia de verificación, sin extrapolar resultados

- Última corrida completa de unitarias: **28 aprobadas**. Lint, tipos API/web y build completo de la imagen de demo pasaron después del ajuste del guard global de rate limiting.
- Última corrida completa de integración: **16 aprobadas**, incluyendo el aislamiento del limitador por usuario.
- Última corrida completa E2E: **10 aprobadas**, usando Microsoft Edge. Se cerró el fallo previo de cotizaciones por cupo compartido entre usuarios de una misma IP.
- Se construyó y arrancó la imagen de demo, se aplicaron ocho migraciones en PostgreSQL aislado y se probaron seed idempotente, login, dashboard, PDF, CSV y bloqueos de registro/invitaciones. Railway aún no está conectado ni desplegado.
- No hay prueba de restauración de backup, carga en staging, auditoría actual de dependencias ni simulacro operativo realizados en fase 6.
- Los artefactos E2E son locales e ignorados por Git; `.last-run.json` lo genera Playwright.

## Hallazgos

Cada estado describe lo observado, no una promesa de que un control esté desplegado.

| ID / severidad | Problema e impacto | Evidencia | Solución requerida | Verificación de cierre | Estado |
|---|---|---|---|---|---|
| PR-01 Bloqueante | Sin respaldo/restauración demostrados: pérdida financiera o comercial no recuperable | `docker-compose.yml` usa un volumen local; no hay jobs ni acta de restore | Backup cifrado externo y restauración aislada con conciliación de datos | Restaurar un dump/PITR, ejecutar invariantes y registrar tiempos y checksums | Abierto |
| PR-02 Bloqueante comercial | Falta validar infraestructura y release públicos | Existe imagen no root y configuración Railway para demo, con API interna en loopback; no hay despliegue público ni pipeline comercial | Validar redes/proxy, TLS, readiness, migración y rollback en infraestructura autorizada | Desplegar el mismo digest y verificarlo en staging | Abierto; demo verificada localmente |
| PR-03 Verificación local | Fallo anterior de cotizaciones por limitador compartido | 28 unitarias, 16 integraciones y 10 E2E aprobados después del guard corregido; imagen construida | Conservar resultados asociados a la versión | Suite completa verde después del guard corregido | Cerrado localmente; repetir smoke en despliegue público |
| PR-04 Bloqueante para venta recurrente | La asignación local de plan no equivale a suscripción, trial ni pago | `plan.service.ts` devuelve `billingEnabled:false`, fallback EQUIPO/UNCONFIGURED | Estados, trial, gracia, acceso derivado, ledger SaaS, adaptador y webhooks verificados | Sandbox autorizado con duplicados, eventos fuera de orden y conciliación; no activar dinero real | Abierto |
| PR-05 Bloqueante para lanzamiento comercial | Términos locales y aceptación sin versión/fecha persistidas; no hay política comercial revisada | `auth/dto.ts` exige `terms=true`; User no guarda aceptación; `/terminos` indica desarrollo | Registro versionado de consentimiento, privacidad, retención y revisión jurídica | Evidencia de aceptación inmutable y aprobación legal de textos/procesos | Abierto |
| PR-06 Alto | Rate limiting en memoria no coordina réplicas y la IP detrás de proxy no está definida | ThrottlerModule usa almacenamiento por proceso; `req.ip` sin trust proxy específico | Almacén compartido y política de proxy conocido, sin confiar en X-Forwarded-For arbitrario | Prueba entre dos instancias y suplantación de IP | Abierto; separación por usuario corregida localmente |
| PR-07 Alto | SMTP local no entrega comunicaciones a usuarios reales | `.env.example` apunta a Mailpit; no hay identidad de dominio configurada | SMTP transaccional, TLS, SPF/DKIM/DMARC y tratamiento de fallos/reintentos | Entrega y rebote controlados a cuentas de prueba autorizadas | Abierto |
| PR-08 Alto | Sin monitoreo/alertas operativos y sin prueba de recepción de incidentes | Pino estructurado existente; no hay métricas, recolector, alertas ni dashboard operativo | Métricas sin PII, seguimiento de errores, sondas y alertas con responsables | Fallo controlado genera alerta recibida y atendida | Abierto |
| PR-09 Alto | CI no audita dependencias, no ejecuta E2E y no publica artefactos promovibles | `.github/workflows/ci.yml` solo lint/tipos/unit/integración/build; Mailpit añadido para invitaciones | Auditoría/SCA, artefactos con digest, E2E críticos y aprobación por environment | PR vulnerable bloqueada y promoción del mismo artefacto firmado/verificado | Abierto; workflow no ejecutado en GitHub en esta fase |
| PR-10 Alto | Sin prueba representativa de capacidad; PDF, Sharp y reportes comparten proceso | PDFKit/Sharp; exportación hasta 10.000 filas; transacciones serializadas por empresa | Medir API, memoria, pool y bundles; limitar trabajos costosos según evidencia | Carga en staging autorizado con p50/p95/p99, errores y memoria registrada | Abierto |
| PR-11 Alto | Webhooks futuros quedarían bloqueados por el control Origin y carecen de verificación real | Middleware global exige APP_ORIGIN para toda escritura; proveedor solo es una interfaz | Ruta separada con raw body, verificación oficial, inbox idempotente y procesamiento transaccional | Firma inválida rechazada; duplicado sin doble efecto; orden invertido conciliado | Abierto; no hay webhook público habilitado |
| PR-12 Alto | Verificación de correo no precede hoy a creación de empresa y uso comercial | Registro inicia sesión; onboarding crea organización; verificación obligatoria solo al aceptar invitación | Definir/aplicar gating de onboarding comercial sin borrar organizaciones existentes | Cuenta no verificada no inicia trial comercial; verificación permite continuar | Abierto |
| PR-13 Medio | Liveness y readiness no separados; fallar DB no debe generar reinicios en bucle | `/health` hace SELECT 1 y Swagger se expone incondicionalmente | Probes independientes, timeout, respuesta mínima y control de Swagger en producción | Corte de DB afecta readiness, no liveness; docs protegidos/deshabilitados | Abierto |
| PR-14 Medio | Rotación, retención y proceso de incidentes no operativos | Reset revoca sesiones; faltan política de retención y jobs de limpieza observados | Runbooks, caducidad, borrado por política, rotación de credenciales y soporte | Simulacro y limpieza verificada en base aislada | Abierto |
| PR-15 Medio | Almacenamiento de objetos solicitado aún sin integración ni ciclo de vida | Logos PNG/JPEG revalidados se guardan en DB; PDFs se generan bajo autenticación | Decidir qué objetos persistir; bucket privado y URLs firmadas solo si se necesitan | Un tenant no obtiene objetos de otro; caducidad y restore de objetos | Abierto; no se detectó un bucket público expuesto |
| PR-16 Medio | Permisos/módulos se comprueban en servidor, pero cambios concurrentes requieren cobertura amplia | Operaciones, conversión, pagos y reversos revalidan plan dentro del bloqueo; otros writers validan al inicio | Probar carreras entre rol/plan/visibilidad y escritura en todos los módulos | Ninguna carrera crea acceso superior o flujo imposible de completar | Parcial |
| PR-17 Bajo | Navegación/landing/SEO y ayuda comercial pendientes | `/` redirige a selección de empresa; no se observaron sitemap/robots comerciales | Landing independiente, metadata y onboarding/checklist sin testimonios inventados | Responsive, accesibilidad y enlaces/SEO revisados | Abierto |

## Controles existentes que deben conservarse

Scrypt con sal aleatoria y comparación constante; tokens de 256 bits guardados con hash; membresía activa y rol por petición; UUIDs ajenos sin datos; DTO whitelist/forbidNonWhitelisted; Origin y CORS restrictivos; cuerpo JSON de 1 MB; Helmet; PDF autenticado; imágenes decodificadas y normalizadas por Sharp; snapshots comerciales; dinero BigInt/Decimal; numeración y requestKey únicos; bloqueos y eventos transaccionales; reversos sin eliminación; CSV con BOM/escape de fórmulas; redacción de cookies/tokens en logs. Estos controles locales no demuestran seguridad de una infraestructura todavía inexistente.

`.env` no está versionado: `git ls-files -- .env .env.local .env.example` mostró únicamente `.env.example`. Esto no sustituye una revisión completa de secretos históricos ni una auditoría actual de dependencias.

## Normativa y puertas externas

La [BCN publica la Ley 21.719 con entrada en vigor el 1 de diciembre de 2026](https://www.bcn.cl/leychile/Navegar?idNorma=1209272&idParte=10527471&idVersion=2026-12-01). El tratamiento de datos debe revisarse conforme al marco vigente al lanzar y a esa transición. No se presenta este inventario como asesoría legal. Revisión jurídica, presupuesto, proveedores, RPO/RTO y responsables de soporte son decisiones pendientes.

## Decisión de avance

GO para preparación local, correcciones reversibles y documentación. NO-GO para lanzamiento comercial, despliegue de producción, DNS o cobros reales. El [plan de fase 6](phase-6-plan.md) indica dependencias, tareas verificables y puertas de aprobación; actualizar este dictamen solo con evidencia nueva.
