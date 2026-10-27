# Decisiones técnicas

- Monorepo en la raíz existente; paquetes `@nuviora/*` y pnpm 10.34.9 fijado en packageManager.
- Next.js 16.4.3 y React 19.3.1 consultados en npm antes de instalar. NestJS 11.2.8 con Swagger 11; se conserva una familia compatible sin migrar a NestJS 12 durante fundaciones.
- Prisma 6.19.3 permite el flujo estándar de PostgreSQL, cliente y migraciones de esta fase. Migración inicial generada desde el esquema y ejecutada contra una base nueva.
- API compilada por tsc, también durante desarrollo: los DTO y la inyección de Nest necesitan metadata de decoradores, que tsx no emite. tsx se limita al ejecutor de pruebas, que importa las clases Nest compiladas.
- SMTP Nodemailer 10.2.1. Auditoría exigió actualizar el cliente SMTP y fijar deepmerge-ts 8, multer 2.5 y js-yaml 5.4.1 mediante overrides transitivos. Se comprueba generación Prisma y pruebas tras estos cambios. Reevaluar estos overrides al actualizar dependencias principales.
- Sin Zustand: no se necesita un almacén global para el estado de interfaz actual. React Query mantiene sesión y empresa; el menú móvil usa estado local.
- UI basada en el patrón Button de shadcn/ui (Radix Slot, CVA y utilidades de clase), sin instalar un framework de componentes paralelo.
- PostgreSQL en localhost:55432, pues 5432 pertenece a otro proyecto del equipo. No se cambia ni borra ese servicio.
- Sin despliegue: el alcance autorizado es local. Sites se consultó como guía de trabajo local; no se creó un sitio alojado.
