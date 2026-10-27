# Arquitectura

Next.js presenta la interfaz y reenvía /api/v1 al servidor NestJS; el navegador trabaja con el mismo origen. NestJS es el único propietario del acceso a PostgreSQL mediante Prisma. React Query administra datos remotos; React Hook Form y Zod validan formularios.

Autenticación: contraseñas con scrypt y sal aleatoria; sesiones de 7 días, token aleatorio de 256 bits en cookie HttpOnly, SameSite=Lax, Secure en producción. La base almacena solo SHA-256 del token. Logout revoca la sesión. Las escrituras exigen Origin igual al origen configurado, incluida autenticación, para mitigar CSRF. CORS restringido. Tokens de correo de un solo uso, almacenados mediante hash y con expiración.

Tenant: slug en la ruta, sesión autenticada y membresía consultada en cada petición. No se acepta organizationId como autoridad del cliente. Respuestas 404 para organizaciones ajenas. Las acciones administrativas usan roles de membresía, nunca un rol global del usuario.

No hay datos comerciales ficticios ni métricas inventadas. Los módulos de fases futuras muestran su estado pendiente. Logs JSON con pino y sin cookies/contraseñas. Swagger en /api/docs; health con consulta real a PostgreSQL.

Fase 2 agrega módulos REST de customers y catalog-items con paginación/ordenamiento en servidor y transacciones de escritura más auditoría. El paquete @nuviora/domain comparte validaciones puras de RUT y dinero con backend y formularios. Los componentes de recursos separan listados, formularios, edición, detalle, confirmación y transporte HTTP.

Pruebas E2E arrancan API y Next.js independientes en 3101/3100; Next usa .next-e2e para no interferir con el servidor de desarrollo del usuario. API_INTERNAL_ORIGIN configura el proxy de Next solo en servidor. Estos servicios de prueba usan la base local y eliminan exclusivamente sus fixtures UUID al finalizar.

Fase 3 separa lectura (QuotesService), escritura de borradores (QuoteWriterService), estados/enlaces/decisiones (QuoteWorkflowService), persistencia compartida (QuoteStore), PDF y diseño. El paquete domain comparte cálculo exacto con BigInt y fechas comerciales chilenas entre editor y servidor. Los totales del navegador no son aceptados por el DTO; el servidor los recalcula.

La creación serializa el contador por organización y compara la clave/hash de petición para reintentos. Los cambios de una cotización usan SELECT FOR UPDATE y comprobaciones de estado/versión. Aprobar/rechazar, evidencia y evento se confirman en una sola transacción. Se usa una espera máxima de admisión de transacciones de 10 s y timeout de 15 s; la prueba concurrente identificó que el valor por defecto de 2 s era insuficiente bajo ráfagas locales.

Enlaces públicos: token aleatorio de 256 bits, solo hash persistido, lectura limitada a una proyección comercial, revocación/rotación y rate limiting de 20 solicitudes/minuto por IP y handler. Sus URLs se enmascaran en Pino y se omiten del log de solicitudes de Next. Páginas/API públicas usan noindex, no-store y no-referrer. Las visualizaciones se agrupan por enlace en intervalos de 15 minutos; no se guarda IP ni fingerprint en la evidencia de aceptación.

El PDF se genera con PDFKit a partir de snapshots del documento, con paginación de filas/textos y logo opcional del emisor. Los logos se validan con Sharp (PNG/JPEG, hasta 256 KB y 4 MP), se normalizan y se eliminan metadatos; no se descargan URLs ni se aceptan SVG. La huella SHA-256 representa el JSON comercial canónico, no una firma criptográfica ni el hash de los bytes PDF. No se garantiza una representación PDF byte a byte idéntica entre versiones futuras del motor.
