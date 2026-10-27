# Verificación de Fase 1

Fecha: 26 de octubre de 2026. Entorno Windows, Node 24.16.0, pnpm 10.34.9, Docker Desktop. No hubo despliegue.

| Comprobación ejecutada | Resultado final |
|---|---|
| `pnpm install --frozen-lockfile` | Correcta |
| `docker compose up -d` | PostgreSQL y Mailpit saludables; base en 55432 |
| `pnpm db:generate` | Cliente Prisma generado con overrides de seguridad |
| `pnpm db:migrate` | Migración inicial aplicada correctamente |
| `pnpm lint` | Correcto |
| `pnpm typecheck` | Correcto en API y web |
| `pnpm test` | 7 pruebas aprobadas |
| `pnpm test:integration` | Suite HTTP + PostgreSQL aprobada |
| `pnpm build` | API y Next.js compilados correctamente |
| `pnpm audit --prod --audit-level high` | Sin vulnerabilidades conocidas reportadas |
| `PLAYWRIGHT_CHANNEL=msedge pnpm exec playwright test` | Recorrido completo de fundaciones aprobado |

## Evidencia funcional

Integración: intentos de lectura y modificación de empresa ajena devuelven 404; MEMBER no puede editar ni enumerar usuarios; se rechaza inyectar organizationId; el perfil excluye passwordHash y sesiones; logout revoca la sesión; un origen ajeno recibe 403. Verificación y recuperación consumen tokens una sola vez. El cambio de contraseña revoca sesiones y almacena una nueva derivación válida.

Navegador: registro, creación de empresa, actividad real, verificación mediante correo de Mailpit, bloqueo de otra cuenta, sesión HttpOnly/SameSite, vista móvil de 390 px sin desbordamiento, logout/login, recuperación real mediante Mailpit, invalidación de la sesión previa y login con contraseña nueva. Se revisaron capturas de escritorio y móvil en `test-results/` (artefactos locales ignorados).

## Incidencias resueltas

- Motor Docker inicialmente detenido: iniciado para las pruebas locales.
- Puerto 5432 ocupado por otro proyecto: el nuevo contenedor usa 55432.
- Variable visual importada sin uso: corregida antes del lint final.
- Primera prueba de navegador ejecutada antes de terminar la instalación de Chromium: repetida con Microsoft Edge existente. La instalación adicional incompleta se detuvo; Edge ejecutó correctamente las pruebas.
- Primer recorrido detectó fallo SMTP: actualizado Nodemailer a 10.2.1 y repetido el envío con Mailpit y el recorrido completo, ambos correctos.
- Auditoría inicial detectó dependencias vulnerables: actualizadas/fijadas y verificadas nuevamente.

## Límites de esta revisión

No certifica WCAG ni preparación de producción. No se ejecutó CI en GitHub; sí sus comandos localmente. Los flujos comerciales completos requieren fases posteriores. No se probó un proveedor SMTP externo, servicios pagos, despliegue ni carga distribuida. Las invitaciones y edición de roles están pendientes, aunque las membresías y permisos del backend están implementados y probados.

Fase 1 queda entregada para revisión. No se inició Fase 2.
