CREATE INDEX "Quote_organizationId_sentAt_idx" ON "Quote"("organizationId", "sentAt");
CREATE INDEX "Operation_organizationId_issueDate_idx" ON "Operation"("organizationId", "issueDate");
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_kind_role_check" CHECK (
  ("kind" = 'MEMBER' AND "role" IN ('ADMIN', 'MEMBER')) OR
  ("kind" = 'OWNERSHIP' AND "role" = 'OWNER')
);
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_hidden_modules_not_null"
CHECK ("hiddenModules" IS NOT NULL);
