# Plan de implementación

## Alcance autorizado: Fase 1

Repositorio inicialmente vacío. Crear el monorepo en esta carpeta, sin subcarpeta redundante.

1. Documentar arquitectura, datos y permisos antes de implementar.
2. Configurar pnpm, Next.js App Router, NestJS, TypeScript estricto y paquetes compartidos.
3. PostgreSQL local con Docker, Prisma y migración inicial versionada.
4. Registro, inicio y cierre de sesión; sesiones opacas revocables; recuperación y verificación por correo mediante SMTP local.
5. Organizaciones, configuración inicial, membresías y resolución de empresa por slug con autorización en servidor.
6. Interfaz Nuviora responsive, navegación y rutas de fundaciones. Los módulos comerciales quedan para fases posteriores.
7. Pruebas de autenticación, permisos y acceso entre empresas; lint, typecheck, tests y build.

## Criterio de cierre

Documentar los comandos realmente ejecutados y sus resultados. No considerar aprobada la fase sin comprobar integración con PostgreSQL. Esperar revisión del usuario antes de Fase 2. No desplegar ni contratar servicios.

## Riesgos y dependencias

Docker Engine debe estar iniciado. npm requiere acceso a red. SMTP de desarrollo no entrega correo externo. Producción necesita HTTPS, SMTP transaccional, almacenamiento y limitación distribuida; no está autorizada en esta fase.
