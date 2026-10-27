"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@nuviora/ui/button";
export function ConfirmDialog({
  name,
  onClose,
  onConfirm,
}: {
  name: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos archivar el registro",
      );
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby="archive-title"
      aria-describedby="archive-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-border bg-white p-7 text-foreground shadow-xl backdrop:bg-black/35"
    >
      <h2 id="archive-title" className="text-xl font-semibold">
        ¿Archivar este registro?
      </h2>
      <p
        id="archive-description"
        className="mt-4 break-words text-sm leading-6 text-secondary"
      >
        «{name}» quedará fuera de los listados activos. Su información se
        conservará y podrás consultarla con el filtro Archivados.
      </p>
      {error && (
        <p role="alert" className="field-error mt-4">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={busy} onClick={confirm}>
          {busy ? "Archivando…" : "Archivar"}
        </Button>
      </div>
    </dialog>
  );
}
