# Respaldos y recuperación

**Estado: no hay restauración de prueba demostrada. No se afirma que los backups funcionen.** El volumen Docker local conserva datos entre reinicios, pero no es un respaldo.

## Objetivos propuestos, sujetos a acuerdo

Para un piloto pequeño: RPO de 24 horas y RTO de 4 horas como punto de discusión. Si se necesita menor pérdida admisible, evaluar PITR y proponer RPO de 15 minutos/RTO de 2 horas, con presupuesto, plataforma y pruebas que lo sostengan. Estos valores no son SLA ni compromisos aprobados.

## Diseño pendiente

- Backups automáticos cifrados fuera de la instancia, credenciales de mínimo privilegio y alertas ante omisión/fallo.
- Retención propuesta: 7 diarios y 4 semanales; acordar retención jurídica/comercial y costo. PITR, si se contrata, requiere verificar su ventana real.
- Registrar versión PostgreSQL, versión de aplicación y migraciones, hora del snapshot, checksum y ubicación privada. No guardar dumps en Git ni dejar vínculos públicos.
- Incluir objetos persistidos y configuración necesaria para reconstruir el servicio. Un dump de DB no contiene futuros objetos S3.

## Ensayo de restauración que debe ejecutarse

1. Aprobar un destino **aislado**, identificarlo explícitamente y comprobar que no sea producción. No usar una URL calculada sin validar host y nombre de base.
2. Crear dump consistente o seleccionar punto de recuperación del proveedor, registrar checksum y cifrado. Conservar originales.
3. Restaurar en base vacía de prueba, sin `--clean` contra una base existente. Red de prueba sin correos, webhooks ni cobros externos activos.
4. Comprobar migraciones, usuarios/organizaciones, conteos, claves compuestas y relaciones. Conciliar totales de operaciones, pagos válidos, reversos y saldos exactos; ningún sobrepago ni duplicado de numeración/conversión.
5. Ejecutar smoke y el flujo comercial sobre datos sintéticos/restaurados autorizados. Medir tiempo real de restore y validación.
6. Emitir acta con origen/destino, versión, fechas, checksum, conteos, resultados, duración, RPO/RTO observados, errores y responsable.

No convertir esta propuesta en «backup verificado» hasta adjuntar esa acta. Una restauración sobre producción requiere aprobación y plan específico de indisponibilidad/conciliación; no forma parte de esta preparación inicial.
