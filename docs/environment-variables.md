# Variables de entorno

## Existentes

| Variable | Uso | Tratamiento |
|---|---|---|
| DATABASE_URL | Prisma/PostgreSQL | Secreto; usuario por entorno y privilegios mínimos |
| APP_ORIGIN | Origen permitido y enlaces por correo | URL exacta; HTTPS obligatorio con NODE_ENV=production |
| PORT | API, 3001 por defecto | Configuración |
| NODE_ENV | development/test/production | Producción no usa configuración local |
| SMTP_HOST / SMTP_PORT | Transporte Nodemailer | Host productivo por elegir; Mailpit solo local |
| SMTP_USER / SMTP_PASSWORD | Autenticación SMTP opcional | Secretos; requerir política específica para producción |
| MAIL_FROM | Remitente | Dominio cuya entrega esté validada |
| API_INTERNAL_ORIGIN | Rewrite de Next a la API | Red privada o TLS; no exponer credenciales al navegador |
| NEXT_DIST_DIR | Carpeta de compilación | E2E usa `.next-e2e` |
| E2E_WEB_PORT / E2E_API_PORT | Servidores aislados de pruebas | 3100/3101 por defecto |
| PLAYWRIGHT_CHANNEL / PLAYWRIGHT_REUSE_SERVER | Navegador y reutilización de pruebas | No constituyen configuración productiva |

Validador actual: `apps/api/src/config/env.ts`. `.env.example` contiene únicamente valores locales de ejemplo; no trasladarlos a producción. `.gitignore` excluye `.env*` salvo `.env.example`.

## Configuración pendiente de diseñar e implementar

Host de escucha, proxy confiable, almacenamiento compartido del limitador, exportador de métricas, seguimiento de errores, S3, cifrado/retención de backups, proveedor de suscripción, secreto de webhook, precios versionados, trial y gracia. **No se presentan como variables ya soportadas.** Antes de introducir cada una, añadir validación, documentación y pruebas de arranque fail closed.

## Política propuesta

Staging y producción usan gestores de secretos y cuentas separadas; jamás NEXT_PUBLIC para credenciales. Validar secretos antes de recibir tráfico. Separar usuario migrador del usuario de aplicación, usar TLS y certificados verificados con DB/SMTP/proveedores. Rotar un secreto sin imprimirlo ni copiarlo a tickets. Ante exposición: revocar, reemplazar, comprobar acceso y revisar logs; cambiar un archivo local no revoca una credencial externa.
