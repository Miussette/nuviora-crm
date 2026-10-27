ALTER TABLE "Operation" ADD CONSTRAINT "Operation_assignee_membership_fkey" FOREIGN KEY ("assignedUserId", "organizationId") REFERENCES "Membership"("userId", "organizationId") ON DELETE RESTRICT;
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_amounts_check" CHECK (
  "subtotal" >= 0 AND "discountTotal" >= 0 AND "discountTotal" <= "subtotal"
  AND "netTotal" = "subtotal" - "discountTotal"
  AND "taxableBase" >= 0 AND "exemptBase" >= 0
  AND "netTotal" = "taxableBase" + "exemptBase"
  AND "taxTotal" >= 0 AND "total" = "netTotal" + "taxTotal"
  AND "version" > 0 AND ("dueDate" IS NULL OR "dueDate" >= "issueDate")
);
ALTER TABLE "OperationItem" ADD CONSTRAINT "OperationItem_amounts_check" CHECK (
  "quantity" > 0 AND "unitPrice" >= 0 AND "discount" BETWEEN 0 AND 100
  AND "subtotal" >= 0 AND "discountAmount" BETWEEN 0 AND "subtotal"
  AND "netAmount" = "subtotal" - "discountAmount" AND "taxAmount" >= 0
  AND "lineTotal" = "netAmount" + "taxAmount" AND "position" >= 0
  AND (("taxMode" = 'VAT_19' AND "taxRate" = 19) OR ("taxMode" = 'EXEMPT' AND "taxRate" = 0))
);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_amount_check" CHECK ("amount" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversal_check" CHECK (
  ("reversedAt" IS NULL AND "reversedById" IS NULL AND "reversalReason" IS NULL)
  OR ("reversedAt" IS NOT NULL AND "reversedById" IS NOT NULL AND length(trim("reversalReason")) >= 3)
);
