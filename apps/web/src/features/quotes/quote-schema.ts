import { z } from "zod";
import {
  calculateQuote,
  DISCOUNT_PATTERN,
  isDateOnly,
  isValidMoney,
  QUANTITY_PATTERN,
  scaledInteger,
} from "@nuviora/domain";
export const quoteItemSchema = z.object({
  catalogItemId: z.uuid().optional(),
  name: z.string().trim().min(1, "Ingresa el nombre del concepto").max(150),
  description: z.string().trim().max(5000),
  unit: z.string().trim().min(1, "Ingresa la unidad").max(50),
  quantity: z
    .string()
    .refine(
      (value) => QUANTITY_PATTERN.test(value) && scaledInteger(value, 4) > 0n,
      "Usa una cantidad positiva con hasta 4 decimales",
    ),
  unitPrice: z
    .string()
    .refine(isValidMoney, "Usa un precio no negativo con hasta 2 decimales"),
  discount: z
    .string()
    .refine(
      (value) =>
        DISCOUNT_PATTERN.test(value) && scaledInteger(value, 2) <= 10000n,
      "El descuento debe estar entre 0 y 100%",
    ),
  taxMode: z.enum(["VAT_19", "EXEMPT"]),
});
const text = (max: number) => z.string().trim().max(max);
export const quoteSchema = z
  .object({
    customerId: z.uuid("Selecciona un cliente"),
    issueDate: z.string().refine(isDateOnly, "Ingresa una fecha válida"),
    expiryDate: z.string().refine(isDateOnly, "Ingresa un vencimiento válido"),
    reference: text(150),
    items: z.array(quoteItemSchema).max(100, "Puedes agregar hasta 100 ítems"),
    notes: text(5000),
    deliveryTerms: text(2000),
    paymentTerms: text(2000),
    validityTerms: text(1000),
    customerNotes: text(5000),
  })
  .superRefine((value, ctx) => {
    if (value.expiryDate < value.issueDate)
      ctx.addIssue({
        code: "custom",
        path: ["expiryDate"],
        message: "El vencimiento debe ser igual o posterior a la emisión",
      });
    try {
      calculateQuote(value.items);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: error instanceof Error ? error.message : "Revisa los importes",
      });
    }
  });
export type QuoteFormValues = z.infer<typeof quoteSchema>;
export const blankQuoteItem = (): QuoteFormValues["items"][number] => ({
  name: "",
  description: "",
  unit: "Unidad",
  quantity: "1",
  unitPrice: "0",
  discount: "0",
  taxMode: "VAT_19",
});
