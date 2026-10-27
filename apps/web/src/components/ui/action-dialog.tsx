"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@nuviora/ui/button";
export function Modal({
  title,
  children,
  onClose,
  busy = false,
  large = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  large?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className={`m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto rounded-2xl border border-border bg-white p-6 text-foreground shadow-xl backdrop:bg-black/35 ${large ? "max-w-5xl" : "max-w-lg"}`}
    >
      <div className="mb-5 flex items-start justify-between gap-5">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button
          type="button"
          disabled={busy}
          aria-label="Cerrar diálogo"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-secondary"
        >
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ActionDialog({
  title,
  description,
  action,
  onConfirm,
  onClose,
  onComplete,
  children,
  canConfirm = true,
}: {
  title: string;
  description: string;
  action: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  onComplete?: () => void;
  children?: React.ReactNode;
  canConfirm?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      if (onComplete) onComplete();
      else onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos completar la acción",
      );
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <p className="mb-5 text-sm leading-6 text-secondary">{description}</p>
      {children}
      {error && (
        <p role="alert" className="field-error mt-4">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onClose}
        >
          Volver
        </Button>
        <Button type="button" disabled={busy || !canConfirm} onClick={confirm}>
          {busy ? "Procesando…" : action}
        </Button>
      </div>
    </Modal>
  );
}
