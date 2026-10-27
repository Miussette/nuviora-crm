# Fase 6 — Plan de ejecución

Estado inicial: auditoría documentada; implementación de las seis entregas todavía pendiente. Documento de referencia: [production-readiness.md](production-readiness.md). No se ha autorizado ninguna acción de producción.

## Reglas de trabajo

1. Conservar el trabajo local de fases 4–5; no resetear Git ni la base. Separar cambios y registrar el commit exacto que se verifica.
2. Cerrar la verificación de fase 5 antes de modificar el ciclo comercial. La última repetición E2E no pudo iniciarse por límite de la revisión automática de aprobación.
3. Cada tarea termina con pruebas y evidencia; un test escrito no cuenta como ejecutado. Las propuestas de infraestructura y SLA no cuentan como configuraciones activas.
4. Preparación local y archivos revisables no requieren un despliegue. Para producción, DNS, compras, restauraciones sobre datos reales y dinero real se necesita autorización explícita sobre el resultado concreto.
5. Nunca sustituir controles fallidos por resultados manuales ni usar datos reales en fixtures.

## 6.1 Auditoría y seguridad

**Entrada:** estado real de fases 1–5, migraciones y fallos pendientes.

- Repetir lint, typecheck, 28 unitarias, integración completa y los 10 E2E después del ajuste del rate limiter. Verificar expresamente el E2E anterior de cotización, el guard por usuario y el límite por IP de enlaces públicos.
- Auditar dependencias/secretos, historial Git y configuración. Resolver vulnerabilidades críticas/altas según exposición, sin afirmar que un audit anterior sigue vigente.
- Formalizar threat model de sesiones, pertenencia, invitaciones, aprobaciones, PDFs, CSV, logos y transferencias.
- Añadir política de entorno, documentación de rotación y control de Swagger. Diseñar email verification para onboarding y gating de producción.
- Probar acceso cruzado, desactivación inmediata, escalada, tokens caducados, falsificación de Origin y archivos inválidos.
- Dejar el tratamiento de webhooks con raw body y autenticidad específico; mantener CSRF en las rutas de sesión.

**Salida verificable:** auditoría actualizada; suite local completa verde; matriz de permisos; ningún bloqueante de aislamiento o integridad financiera. **Puerta:** ningún acceso a infraestructura real.

## 6.2 Infraestructura y CI/CD

- Comparar al menos dos plataformas con costos fechados, región, DPA, PITR, SMTP, S3 y soporte; ver [deployment.md](deployment.md).
- Preparar Dockerfiles de Next y API, `.dockerignore`, usuarios no root, build reproducible, digest y health/readiness. Configurar host de escucha, red privada y proxy same-origin sin exponer PostgreSQL.
- Separar secretos y servicios dev/staging/prod; no reutilizar Mailpit o credenciales locales en producción.
- Ampliar PR CI con SCA, artefactos y pruebas. Preparar workflow manual de staging y promoción a producción con environment protegido y el mismo digest.
- Aplicar migraciones como un job único y auditado; bloquear SQL destructivo sin revisión específica. Implementar smoke y rollback de aplicación compatible con el esquema.

**Salida:** configuración revisable, imágenes verificadas localmente y workflows preparados. **Puerta para staging/producción:** proveedor/cuenta, presupuesto, secretos y despliegue autorizados; el pipeline no debe ejecutarse solo por existir.

## 6.3 Suscripciones y pagos

- Sustituir el fallback de evaluación local por una política explícita: plan comercial versionado, precios configurables, suscripción, acceso, cargos del proveedor y documentos tributarios separados.
- Migración aditiva para trial de 14 días configurable, gracia y estados TRIALING/ACTIVE/PAST_DUE/CANCELED/EXPIRED. No fabricar renovaciones ni pagos.
- Mantener los cobros de clientes de las pymes en sus tablas actuales; crear un ledger SaaS separado con importes exactos, moneda y evidencia del proveedor.
- Evaluar Flow y Mercado Pago en documentación oficial; no asumir elegibilidad comercial, firma o facturación tributaria equivalentes.
- Implementar adaptador seleccionado únicamente después de tener contrato/API sandbox válidos; fail closed si falta proveedor.
- Inbox de webhooks con idempotencia, hash del payload, firma verificada, estado, número de intentos y fecha lógica; reconciliar contra proveedor, no confiar en el retorno del navegador.
- UI de selección/confirmación/pendiente/exitoso/fallido/cancelado/trial vencido basada en estado persistente confirmado, sin simular éxito.

**Salida:** state machine y sandbox autorizado verificados, ledger coherente y límites aplicados también bajo concurrencia. **Puerta:** activación de cobros reales y credenciales productivas requieren autorización independiente.

## 6.4 Rendimiento, observabilidad y respaldos

- Instalar métricas con cardinalidad acotada, request IDs y seguimiento de errores; alertas sobre indisponibilidad, errores, DB, backups y webhooks.
- Preparar dashboard operativo separado del dashboard comercial. Restringir endpoints y no incluir PII, tokens o montos sensibles como etiquetas.
- Acordar RPO/RTO y retención; programar backups cifrados y restaurar en un destino aislado antes de afirmar recuperabilidad.
- Medir carga representativa en staging autorizado: concurrencia, p50/p95/p99, errores, CPU/RAM, pool, PDF y exportación. Investigar EXPLAIN y N+1 donde la medición lo indique.
- Determinar si el rate limiting compartido y los trabajos PDF/webhooks necesitan almacenamiento/colas externos; no incorporar infraestructura sin justificar el costo.

**Salida:** acta de restore y ensayo de alerta, resultados de carga y objetivos basados en esos resultados. **Puerta:** nunca cargar agresivamente servicios de terceros ni restaurar sobre producción sin autorización.

## 6.5 Landing, onboarding y documentación

- Landing independiente en `/gestion` o subdominio autorizado, preservando la web corporativa. CTA «Comienza tu prueba gratuita» solo cuando el trial esté implementado.
- Mostrar funcionalidades reales y precios configurados como hipótesis hasta aprobación comercial. Sin testimonios, empresas o métricas inventados.
- Metadata, Open Graph, sitemap y robots; excluir áreas autenticadas y enlaces bearer.
- Flujo cuenta → verificación → empresa/rubro → catálogo → primer cliente → primera cotización. Checklist persistente sin obligar datos opcionales.
- Implementar registro versionado de términos y procesos técnicos de privacidad/retención/exportación/solicitudes de titulares. Someter textos y DPA a revisión jurídica.
- Actualizar guía del usuario, variables, soporte y procedimientos operativos.

**Salida:** landing y onboarding probados en escritorio/móvil; documentación consistente y revisión legal registrada. **Puerta:** publicar una landing o cambiar DNS exige autorización del destino concreto.

## 6.6 Pruebas finales y piloto

- Un E2E integrado registra/verifica/crea empresa/cliente/catálogo/cotización/aprobación/operación/abonos/dashboard/exportación.
- Probar aislamiento, importes manipulados, doble pago, reversos, webhooks duplicados/fuera de orden, acceso según suscripción y restauración.
- Repetir auditoría de vulnerabilidades y comprobar el artefacto que se promoverá, no solo el checkout local.
- Preparar piloto de 10–15 pymes: reclutamiento y consentimiento por personas autorizadas, canal de soporte y feedback, definición de métricas y plan de retiro.
- Registrar objetivos frente a resultados reales: alta, tiempo a primera cotización, uso semanal, errores y satisfacción. Ninguna métrica se da por alcanzada antes del piloto.
- Cerrar checklist de lanzamiento y emitir GO/NO-GO con responsables y evidencia.

**Salida:** acta de aceptación, rollback probado, soporte y piloto preparados. **Puerta final:** aprobación explícita del lanzamiento; sin ella solo se entrega la preparación.

## Dependencias y decisiones pendientes

Orden: cierre fase 5 → 6.1 → 6.2; 6.3 puede desarrollarse con sandbox después de elegir proveedor; 6.4 depende de staging y almacenamiento aprobados; 6.5 requiere política comercial/legal; 6.6 requiere todas las anteriores.

Por acordar: presupuesto mensual y región; responsable de infraestructura y soporte; RPO/RTO/retención; proveedor de recurrencia y condiciones; precios finales y política de IVA; dominio/subdominio; textos legales; participantes del piloto. No se infieren autorizaciones de compra ni de activación de pagos a partir de esta lista.
