"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand";
import { Button } from "@nuviora/ui/button";
import { toast } from "sonner";
import { api } from "@/services/api";
import { useUnsaved } from "@/hooks/use-unsaved";
import { DemoNotice } from "@/components/ui/demo-notice";
type Mode =
  | "login"
  | "registro"
  | "recuperar-contrasena"
  | "restablecer-contrasena"
  | "verificar-correo";
const titles: Record<Mode, string> = {
  login: "Qué bueno tenerte de vuelta",
  registro: "Un nuevo comienzo para tu negocio",
  "recuperar-contrasena": "Recupera tu acceso",
  "restablecer-contrasena": "Crea una nueva contraseña",
  "verificar-correo": "Verifica tu correo",
};
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const client = useQueryClient();
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [invitation, setInvitation] = useState("");
  useEffect(() => {
    const value =
      new URLSearchParams(window.location.hash.slice(1)).get("invitation") ??
      "";
    if (/^[a-f0-9]{64}$/.test(value)) setInvitation(value);
  }, []);
  useEffect(() => {
    setToken(
      new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "",
    );
  }, []);
  const schema = z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      password: z.string().optional(),
      confirm: z.string().optional(),
      terms: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
      if (
        ["login", "registro", "recuperar-contrasena"].includes(mode) &&
        !z.email().safeParse(data.email).success
      )
        ctx.addIssue({
          code: "custom",
          path: ["email"],
          message: "Ingresa un correo válido",
        });
      if (
        ["login", "registro", "restablecer-contrasena"].includes(mode) &&
        (!data.password ||
          data.password.length < (mode === "login" ? 1 : 12) ||
          data.password.length > 128)
      )
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message:
            mode === "login"
              ? "Ingresa tu contraseña"
              : "Usa entre 12 y 128 caracteres",
        });
      if (
        ["registro", "restablecer-contrasena"].includes(mode) &&
        data.password !== data.confirm
      )
        ctx.addIssue({
          code: "custom",
          path: ["confirm"],
          message: "Las contraseñas no coinciden",
        });
      if (mode === "registro" && (!data.name || data.name.trim().length < 2))
        ctx.addIssue({
          code: "custom",
          path: ["name"],
          message: "Ingresa tu nombre",
        });
      if (mode === "registro" && !data.terms)
        ctx.addIssue({
          code: "custom",
          path: ["terms"],
          message: "Debes aceptar los términos",
        });
    });
  type Values = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<Values>({ resolver: zodResolver(schema) });
  useUnsaved(mode === "registro" && isDirty && !isSubmitting);
  async function submit(data: Values) {
    setMessage("");
    const routes: Record<Mode, string> = {
      login: "login",
      registro: "register",
      "recuperar-contrasena": "forgot-password",
      "restablecer-contrasena": "reset-password",
      "verificar-correo": "verify-email",
    };
    const body =
      mode === "registro"
        ? {
            name: data.name,
            email: data.email,
            password: data.password,
            terms: data.terms,
          }
        : mode === "login"
          ? { email: data.email, password: data.password }
          : mode === "recuperar-contrasena"
            ? { email: data.email }
            : mode === "restablecer-contrasena"
              ? { token, password: data.password }
              : { token };
    try {
      const result = await api<{ message: string }>(`/auth/${routes[mode]}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      reset();
      if (mode === "login" || mode === "registro") {
        client.clear();
        toast.success(result.message);
        router.push(
          invitation
            ? `/aceptar-invitacion#token=${invitation}`
            : mode === "registro"
              ? "/onboarding"
              : "/seleccionar-empresa",
        );
      } else setMessage(result.message);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No pudimos completar la solicitud",
      );
    }
  }
  const field = (
    name: keyof Values,
    label: string,
    type = "text",
    autoComplete?: string,
  ) => (
    <div>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        type={type}
        autoComplete={autoComplete}
        maxLength={name === "email" ? 254 : 128}
        {...register(name)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
      />
      {errors[name] && (
        <p id={`${name}-error`} className="field-error">
          {errors[name]?.message}
        </p>
      )}
    </div>
  );
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="hidden flex-col justify-between bg-[#eee8f5] p-14 lg:flex">
        <Link
          href="/login"
          className="flex items-center gap-2 text-2xl font-semibold text-primary"
        >
          <BrandLogo className="w-72 max-w-full" />
        </Link>
        <div>
          <h2 className="max-w-md text-5xl font-medium leading-tight tracking-tight">
            Más orden.
            <br />
            Más espacio
            <br />
            para crecer.
          </h2>
          <p className="mt-6 max-w-sm leading-7 text-secondary">
            Tu negocio organizado, sin complicaciones. Todo empieza con un lugar
            para trabajar mejor.
          </p>
        </div>
        <p className="text-sm text-secondary">
          Hecho para negocios que crecen en Chile.
        </p>
      </aside>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <p className="mb-9 flex items-center gap-2 text-xl font-semibold text-primary lg:hidden">
            <BrandLogo className="w-60 max-w-full" />
          </p>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            Bienvenido a Nuviora
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {titles[mode]}
          </h1>
          <p className="mt-3 mb-8 text-sm leading-6 text-secondary">
            {mode === "registro"
              ? "Crea tu cuenta y configura tu empresa en pocos pasos."
              : "Tu próximo paso hacia un negocio más organizado."}
          </p>
          <DemoNotice />
          <form
            onSubmit={handleSubmit(submit)}
            className="space-y-5"
            noValidate
          >
            {mode === "registro" && field("name", "Tu nombre", "text", "name")}
            {["login", "registro", "recuperar-contrasena"].includes(mode) &&
              field("email", "Correo electrónico", "email", "email")}
            {["login", "registro", "restablecer-contrasena"].includes(mode) &&
              field(
                "password",
                "Contraseña",
                "password",
                mode === "login" ? "current-password" : "new-password",
              )}
            {["registro", "restablecer-contrasena"].includes(mode) &&
              field(
                "confirm",
                "Confirma tu contraseña",
                "password",
                "new-password",
              )}
            {mode === "registro" && (
              <div>
                <label className="flex items-center gap-3 font-normal">
                  <input type="checkbox" {...register("terms")} />
                  Acepto los{" "}
                  <Link href="/terminos" className="text-primary underline">
                    términos de uso
                  </Link>
                </label>
                {errors.terms && (
                  <p className="field-error">{errors.terms.message}</p>
                )}
              </div>
            )}
            {mode === "verificar-correo" && !token && (
              <p className="text-sm">
                Abre el enlace que enviamos a tu correo. Puedes solicitar otro
                desde el inicio de tu empresa.
              </p>
            )}
            {message && (
              <p role="status" className="rounded-xl bg-muted p-4 text-sm">
                {message}
              </p>
            )}
            <Button
              className="w-full"
              disabled={
                isSubmitting ||
                (["verificar-correo", "restablecer-contrasena"].includes(
                  mode,
                ) &&
                  !token)
              }
            >
              {isSubmitting
                ? "Procesando…"
                : mode === "login"
                  ? "Ingresar"
                  : mode === "registro"
                    ? "Crear mi cuenta"
                    : mode === "verificar-correo"
                      ? "Verificar correo"
                      : "Continuar"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="mt-6 flex flex-wrap justify-between gap-4 text-sm">
            {mode === "login" ? (
              <>
                <Link
                  className="text-primary"
                  href={
                    invitation
                      ? `/registro#invitation=${invitation}`
                      : "/registro"
                  }
                >
                  Crear una cuenta
                </Link>
                <Link className="text-secondary" href="/recuperar-contrasena">
                  Olvidé mi contraseña
                </Link>
              </>
            ) : (
              <Link
                className="text-primary"
                href={invitation ? `/login#invitation=${invitation}` : "/login"}
              >
                Volver a iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
