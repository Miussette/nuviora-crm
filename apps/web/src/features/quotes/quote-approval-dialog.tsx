"use client";
import { useState } from "react";
import { ActionDialog } from "@/components/ui/action-dialog";
export function QuoteApprovalDialog({
  decision,
  onClose,
  onConfirm,
}: {
  decision: "approve" | "reject";
  onClose: () => void;
  onConfirm: (data: {
    confirmed: true;
    approverName: string;
    reason: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const approve = decision === "approve";
  return (
    <ActionDialog
      title={approve ? "Aprobar cotización" : "Rechazar cotización"}
      description={
        approve
          ? "Confirma que revisaste el documento y aceptas la propuesta comercial. Tu decisión quedará asociada a esta versión."
          : "Confirma que deseas rechazar esta propuesta. La decisión quedará registrada y no podrá cambiarse desde este enlace."
      }
      action={approve ? "Confirmar aprobación" : "Confirmar rechazo"}
      onClose={onClose}
      canConfirm={confirmed}
      onConfirm={() =>
        onConfirm({
          confirmed: true,
          approverName: name.trim(),
          reason: reason.trim(),
        })
      }
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="approver-name">Nombre declarado (opcional)</label>
          <input
            id="approver-name"
            autoComplete="name"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        {!approve && (
          <div>
            <label htmlFor="rejection-reason">Motivo (opcional)</label>
            <textarea
              id="rejection-reason"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        )}
        <label className="flex items-start gap-3 text-sm font-normal leading-6">
          <input
            type="checkbox"
            className="mt-1.5"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          {approve
            ? "He revisado esta versión y confirmo mi aprobación."
            : "He revisado esta versión y confirmo mi rechazo."}
        </label>
        <p className="text-xs leading-5 text-secondary">
          Se registra una decisión mediante posesión del enlace. La identidad es
          declarada; no es una verificación fehaciente de identidad ni una firma
          electrónica avanzada.
        </p>
      </div>
    </ActionDialog>
  );
}
export function QuoteRejectionDialog(
  props: Omit<React.ComponentProps<typeof QuoteApprovalDialog>, "decision">,
) {
  return <QuoteApprovalDialog {...props} decision="reject" />;
}
