"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@nuviora/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { api } from "@/services/api";
export function AcceptInvitation() {
  const profile = useProfile();
  const client = useQueryClient();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const t =
      new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    if (/^[a-f0-9]{64}$/.test(t)) setToken(t);
  }, []);
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center p-6">
      <section className="panel w-full space-y-5 p-7">
        <h1 className="text-2xl font-semibold">Aceptar invitación</h1>
        <p className="text-sm leading-6 text-secondary">
          Confirma el acceso o la transferencia de propiedad usando la cuenta
          del correo invitado.
        </p>
        {!token ? (
          <p role="alert">Abre el enlace completo recibido por correo.</p>
        ) : profile.isPending ? (
          <p role="status">Comprobando tu sesión…</p>
        ) : !profile.data ? (
          <>
            <p className="text-sm">
              Inicia sesión o crea una cuenta para continuar.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/login#invitation=${token}`}>Iniciar sesión</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/registro#invitation=${token}`}>Crear cuenta</Link>
              </Button>
            </div>
          </>
        ) : !profile.data.emailVerifiedAt ? (
          <>
            <p className="text-sm">
              Verifica el correo {profile.data.email} antes de aceptar.
            </p>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api("/auth/resend-verification", { method: "POST" });
                  setMessage(
                    "Correo enviado. Verifica tu dirección y vuelve a esta página.",
                  );
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "No pudimos enviar",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Enviar verificación
            </Button>
            <Button variant="ghost" onClick={() => profile.refetch()}>
              Ya verifiqué mi correo
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm">
              Cuenta: <strong>{profile.data.email}</strong>
            </p>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await api<{ slug: string }>(
                    "/invitations/accept",
                    { method: "POST", body: JSON.stringify({ token }) },
                  );
                  await client.invalidateQueries();
                  window.history.replaceState(null, "", "/aceptar-invitacion");
                  router.push(`/app/${result.slug}/inicio`);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "No pudimos aceptar",
                  );
                  setBusy(false);
                }
              }}
            >
              {busy ? "Confirmando…" : "Aceptar y continuar"}
            </Button>
          </>
        )}
        {message && (
          <p role="status" className="text-sm text-primary">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
