# Respuesta a incidentes — procedimiento propuesto

Estado: sin simulacro realizado ni responsable operativo asignado.

1. Clasificar disponibilidad, exposición entre tenants, credenciales, integridad financiera o pérdida de datos. Crear un registro con hora UTC, impacto y responsable; evitar PII/tokens en el ticket.
2. Contener: retirar el artefacto afectado, bloquear escrituras riesgosas, revocar credenciales comprometidas y preservar evidencia. No borrar logs ni movimientos comerciales para ocultar el problema.
3. Diagnosticar por request IDs, métricas, versión/digest y eventos de negocio. Un error financiero exige conciliación de operaciones, pagos/reversos y eventos del proveedor.
4. Recuperar con el último artefacto compatible o mediante restauración aprobada en destino validado. No hacer down migrations automáticas ni reejecutar webhooks sin idempotencia.
5. Verificar aislamiento, integridad y disponibilidad antes de devolver tráfico. Comunicar hechos confirmados y alcance conocido; la evaluación de notificaciones legales debe realizarla el responsable competente.
6. Registrar cronología, causa, datos potencialmente afectados, tiempo de recuperación, acciones preventivas y prueba que evita repetición.

Pendientes de definir: contacto de guardia, canal de soporte, escalamiento al proveedor, criterios de severidad y tiempos de respuesta. Probar al menos una alerta de caída y una recuperación antes del piloto.
