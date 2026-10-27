# Guía de Clientes y Catálogo

## API

Base: `/api/v1`. Requiere cookie `nuviora_session` y encabezado `X-Organization-Slug` con el slug de una empresa de la que el usuario sea miembro. Las escrituras requieren `Origin` igual a APP_ORIGIN y rol OWNER/ADMIN. El cuerpo no acepta organizationId. Swagger documenta campos y cabeceras en `/api/docs`.

| Método | Clientes | Catálogo | Comportamiento |
|---|---|---|---|
| GET | `/customers` | `/catalog-items` | Listado paginado y filtrado |
| GET | `/customers/:id` | `/catalog-items/:id` | Detalle propio, incluye archivados |
| POST | `/customers` | `/catalog-items` | Crear y auditar |
| PATCH | `/customers/:id` | `/catalog-items/:id` | Edición parcial y auditoría |
| DELETE | `/customers/:id` | `/catalog-items/:id` | Archivado lógico idempotente |

Listados: `page=1`, `pageSize=10` (máximo 100), `search`, `sortBy=name|createdAt`, `sortOrder=asc|desc`, `status=ACTIVE|ARCHIVED|ALL`. Catálogo admite además `INACTIVE`. `type` admite PERSON/COMPANY en clientes o PRODUCT/SERVICE en catálogo. Respuesta `{ data, total, page, pageSize }` con orden estable por UUID como desempate.

Errores: 400 para entrada inválida, 401 sin sesión, 403 por rol/origen, 404 para UUID o empresa inaccesibles, 409 por SKU repetido o intento de editar un archivado. Se conservan las protecciones de rate limiting.

## Crear cliente

```json
{
  "type": "COMPANY",
  "name": "Cliente de prueba",
  "rut": "12.345.678-5",
  "email": "contacto@example.test",
  "phone": "+56912345678",
  "address": "Dirección de prueba",
  "commune": "Providencia",
  "region": "Metropolitana",
  "country": "Chile",
  "notes": "Datos exclusivamente de prueba"
}
```

Solo tipo y nombre son obligatorios en API. El país por defecto es Chile. RUT debe incluir guion y DV correcto; admite puntos opcionales y K/k. Se almacena sin puntos, con guion y K mayúscula. Correo, RUT y otros opcionales admiten cadena vacía para limpiar su contenido. Los textos se muestran mediante React, sin HTML interpretado.

## Crear producto o servicio

```json
{
  "type": "PRODUCT",
  "name": "Producto de prueba",
  "sku": "PROD-001",
  "description": "Descripción opcional",
  "unitPrice": "19990.25",
  "unit": "Unidad",
  "taxMode": "VAT_19",
  "active": true
}
```

Para un servicio usa SERVICE y una unidad como Hora. Impuestos: VAT_19 o EXEMPT. El precio es neto CLP y se envía como **string**, con hasta 16 dígitos enteros y 2 decimales; no se admiten Number, exponentes, negativos, comas ni más decimales. PostgreSQL usa Decimal(18,2) y CHECK no negativo. El formato de pantalla usa BigInt para no perder precisión.

SKU vacío se guarda como null y puede repetirse; SKU informado se normaliza a mayúsculas y es único por empresa. Un SKU archivado continúa reservado. La restricción se aplica en PostgreSQL, también frente a solicitudes concurrentes. Empresas de productos o servicios restringen tipos nuevos en backend; los registros anteriores conservan su acceso aunque cambie la configuración.

## Probar desde la interfaz

1. Inicia sesión, selecciona empresa y abre Clientes. Crea, edita y busca por nombre, correo, teléfono o RUT.
2. Prueba un RUT inválido: el formulario impide guardar y la API también lo rechaza.
3. Archiva desde la ficha o el menú de registro, cancela primero y confirma después. Filtra Archivados y verifica que se conserva el detalle.
4. Crea un producto y un servicio en una empresa Mixta. Cambia precio, busca por SKU, filtra por tipo/estado y prueba SKU duplicado.
5. Marca un elemento inactivo; consulta el filtro Inactivos. Archívalo y revisa Archivados.
6. Con otra empresa intenta pegar un UUID anterior: no puede leerlo ni modificarlo. MEMBER puede consultar pero no guardar ni archivar.

Los formularios advierten al salir con cambios sin guardar, evitan doble envío y muestran errores/toasts. En móvil se usan tarjetas. La actividad de creación, edición y archivo se registra transaccionalmente en ActivityLog; la ficha no simula cotizaciones ni cobros.
