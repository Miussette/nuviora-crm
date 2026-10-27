# Guía de uso — entorno local

El producto se encuentra en preparación; no está habilitado para un lanzamiento comercial. El correo local se consulta en Mailpit (localhost:8025), no llega a destinatarios externos.

## Empezar

Crear cuenta, verificar el correo recibido y completar la empresa. El flujo actual todavía permite crear empresa antes de verificar; el orden comercial de fase 6 está pendiente. Los campos opcionales pueden completarse después. En inicio se muestran indicadores reales, filtros de período y accesos rápidos según rol/plan.

## Flujo comercial

1. Crear un cliente y sus datos de contacto; el RUT se valida cuando se informa.
2. Crear productos/servicios con precio neto y configuración de IVA/exención, o usar conceptos personalizados al cotizar.
3. Crear cotización, revisar importes, enviar y compartir un enlace. El destinatario puede aprobar/rechazar con confirmación; su identidad es declarada, no una firma electrónica avanzada.
4. Desde una aprobada, crear una operación. Se conservan conceptos/importes históricos y se evita una conversión duplicada. También se admiten pedidos/trabajos manuales.
5. Asignar responsable/fecha, iniciar y completar la operación. El estado operativo y el cobro son independientes.
6. Registrar abonos manuales desde Cobros. El cliente se deriva de la operación; no se permite sobrepasar el saldo. Para corregir un pago, revertir con motivo y confirmación, sin borrar el registro ni efectuar una devolución bancaria.
7. Revisar dashboard y reportes por período. Los saldos y operaciones abiertas muestran estado vigente; las ventas se cuentan desde operaciones no canceladas. OWNER/ADMIN pueden exportar CSV; MEMBER consulta sin exportar.

## Administrar empresa

En Configuración → Empresa, completar dirección, comuna, región, zona horaria y logo. Los documentos ya emitidos conservan sus snapshots. En Usuarios, invitar, reenviar o revocar; el destinatario debe iniciar sesión con el correo verificado. Desactivar conserva historial y otros accesos del usuario. Transferir propiedad requiere contraseña y confirmación del destinatario.

En Módulos se ajusta el negocio y la navegación. Ocultar conserva datos y bloquea nuevas escrituras; no se permite ocultar funciones necesarias para flujos activos. En Plan y suscripción solo existe configuración local de acceso, sin facturación ni renovación reales.

## Ayuda

Antes de reportar un error, registrar pantalla, acción, hora y request ID si está disponible. No enviar contraseñas, tokens, enlaces privados ni datos de clientes innecesarios. El canal comercial de soporte y el piloto todavía deben asignarse; no se publica un contacto inventado.

Detalles: [fase 4](phase-4-guide.md), [fase 5](phase-5-guide.md) y [estado de preparación](production-readiness.md).
