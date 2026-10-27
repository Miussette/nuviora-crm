# Checklist de lanzamiento controlado

Dictamen actual: **NO-GO**. Una casilla sin marcar es trabajo pendiente, no una tarea completada por estar documentada.

- [x] Auditoría inicial de fases 1–5 y plan de seis entregas documentados.
- [x] Restricciones de despliegue, DNS y cobros reales conservadas.
- [ ] Suite final local completa verde después del último ajuste de seguridad.
- [ ] Auditoría actual de dependencias y secretos sin críticos/altos explotables pendientes.
- [ ] Imágenes/artefactos reproducibles asociados a commit y digest.
- [ ] Staging separado autorizado, con TLS, secretos y DB administrada.
- [ ] Migraciones y rollback de aplicación ensayados sin pérdida financiera.
- [ ] Backup automático, retención y **restauración comprobada**.
- [ ] RPO/RTO acordados y medidos.
- [ ] Monitoreo y alerta recibida durante un ensayo.
- [ ] SMTP real y dominio de correo verificados.
- [ ] Suscripción/trial/gracia/acceso implementados y comprobados; cobros reales deshabilitados salvo autorización específica.
- [ ] Webhooks verificados, idempotentes y conciliados si se activa un proveedor.
- [ ] Landing independiente y onboarding real probados, sin claims inventados.
- [ ] Términos/privacidad/retención/DPA revisados y consentimiento versionado persistido.
- [ ] Solicitudes de datos, exportación y eliminación con reglas de conservación definidas.
- [ ] Prueba representativa de carga y presupuesto dimensionado.
- [ ] Responsable de incidentes y canal de soporte operativos.
- [ ] Programa piloto preparado con 10–15 pymes, consentimiento, feedback y métricas definidas.
- [ ] Aprobación explícita de lanzamiento por la persona responsable.

El piloto no se ha reclutado ni ejecutado. Métricas propuestas: altas terminadas, tiempo hasta primera cotización, uso semanal, cotizaciones/operaciones/cobros creados, errores, satisfacción e intención de pago. Recolectar solo lo necesario y conforme a la política revisada; no afirmar objetivos alcanzados antes de observarlos.
