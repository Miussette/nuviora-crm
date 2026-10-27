-- PostgreSQL CHECK permits NULL expressions: explicitly require the reason on reversals.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversal_reason_required"
CHECK ("reversedAt" IS NULL OR "reversalReason" IS NOT NULL);
