import type { ValidationError } from "class-validator";

const labels: Record<string, string> = {
  name: "Nombre",
  email: "Correo",
  password: "Contraseña",
  terms: "Términos",
  token: "Enlace",
  type: "Tipo",
  rut: "RUT",
  phone: "Teléfono",
  address: "Dirección",
  commune: "Comuna",
  region: "Región",
  country: "País",
  notes: "Notas",
  sku: "SKU",
  description: "Descripción",
  unitPrice: "Precio unitario",
  unit: "Unidad",
  taxMode: "Impuestos",
  active: "Estado",
  page: "Página",
  pageSize: "Tamaño de página",
  search: "Búsqueda",
  status: "Estado",
  sortBy: "Campo de ordenamiento",
  sortOrder: "Orden",
  businessType: "Tipo de negocio",
  items: "Ítems",
  quantity: "Cantidad",
  discount: "Descuento",
  customerId: "Cliente",
  issueDate: "Fecha de emisión",
  expiryDate: "Vencimiento",
  documentVersion: "Versión",
  requestKey: "Identificador de solicitud",
  confirmed: "Confirmación",
  expiresInDays: "Vigencia del enlace",
  logoDataUrl: "Logo",
  accentColor: "Color",
  footer: "Pie de documento",
};
export function validationMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...validationMessages(error.children ?? []),
    ...Object.entries(error.constraints ?? {}).map(([rule]) => {
      const label = labels[error.property] ?? "Campo";
      if (rule === "whitelistValidation")
        return "La solicitud incluye un campo no permitido";
      if (rule === "rut")
        return "El RUT debe tener formato y dígito verificador correctos";
      if (rule === "isEmail") return `${label}: ingresa un correo válido`;
      if (rule === "isEnum" || rule === "isIn")
        return `${label}: selecciona una opción válida`;
      if (rule === "isBoolean") return `${label}: usa verdadero o falso`;
      if (rule === "isInt" || rule === "min" || rule === "max")
        return `${label}: ingresa un entero dentro del rango permitido`;
      if (rule === "maxLength")
        return `${label}: el texto supera el largo permitido`;
      if (rule === "isLength") return `${label}: revisa el largo del texto`;
      if (rule === "isString") return `${label}: debe ser texto`;
      if (rule === "dateOnly")
        return `${label}: ingresa una fecha válida entre 2000 y 2199`;
      if (rule === "isUuid") return `${label}: selecciona un registro válido`;
      if (rule === "isArray" || rule === "arrayMaxSize")
        return "La cotización debe contener una lista de hasta 100 ítems";
      if (rule === "equals") return `${label}: debes aceptar para continuar`;
      if (error.property === "unitPrice")
        return "Precio unitario: usa un texto decimal no negativo con hasta 16 enteros y 2 decimales";
      if (error.property === "token")
        return "El enlace tiene un formato inválido";
      return `${label}: revisa el valor ingresado`;
    }),
  ]);
}
