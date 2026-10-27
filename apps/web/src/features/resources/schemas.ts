import { z } from "zod";
import { isValidMoney, isValidRut } from "@nuviora/domain";
const optional = (length: number) =>
  z.string().trim().max(length, `Usa como máximo ${length} caracteres`);
export const customerSchema = z.object({
  type: z.enum(["PERSON", "COMPANY"]),
  name: z.string().trim().min(2, "Ingresa al menos 2 caracteres").max(150),
  rut: optional(20).refine(
    (value) => !value || isValidRut(value),
    "RUT inválido: revisa el formato y dígito verificador",
  ),
  email: optional(254).refine(
    (value) => !value || z.email().safeParse(value).success,
    "Ingresa un correo válido",
  ),
  phone: optional(30),
  address: optional(250),
  commune: optional(100),
  region: optional(100),
  country: z.string().trim().min(2, "Ingresa el país").max(100),
  notes: optional(5000),
});
export type CustomerValues = z.infer<typeof customerSchema>;
export const catalogSchema = z.object({
  type: z.enum(["PRODUCT", "SERVICE"]),
  name: z.string().trim().min(2, "Ingresa al menos 2 caracteres").max(150),
  sku: optional(60),
  description: optional(5000),
  unitPrice: z
    .string()
    .refine(
      isValidMoney,
      "Usa un precio no negativo, hasta 16 enteros y 2 decimales separados por punto",
    ),
  unit: z.string().trim().min(1, "Ingresa una unidad de medida").max(50),
  taxMode: z.enum(["VAT_19", "EXEMPT"]),
  active: z.boolean(),
});
export type CatalogValues = z.infer<typeof catalogSchema>;
