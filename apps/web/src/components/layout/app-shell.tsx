"use client";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ChevronDown,
  House,
  Users,
  Package,
  FileText,
  ClipboardList,
  Wallet,
  ChartNoAxesCombined,
  SlidersHorizontal,
  CreditCard,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import type { Organization, Role, ModulesConfiguration } from "@nuviora/types";
import { organizationApi } from "@/services/resources";
import { api, ApiError } from "@/services/api";
import { useProfile } from "@/hooks/use-profile";
import { LoadingSkeleton } from "@/components/ui/states";
import { DemoNotice } from "@/components/ui/demo-notice";
export function AppShell({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const client = useQueryClient();
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const organization = useQuery({
    queryKey: ["organization", slug],
    queryFn: () => api<Organization & { role: Role }>(`/organizations/${slug}`),
  });
  const modules = useQuery({
    queryKey: ["modules", slug],
    queryFn: () =>
      organizationApi<ModulesConfiguration>(
        slug,
        "/organizations/current/modules",
      ),
    enabled: !!organization.data,
  });
  useEffect(() => {
    if (
      organization.error instanceof ApiError &&
      organization.error.status === 401
    )
      router.replace("/login");
  }, [organization.error, router]);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  async function logout() {
    setLoggingOut(true);
    try {
      await api("/auth/logout", { method: "POST" });
      client.clear();
      router.replace("/login");
    } catch (e) {
      setLogoutError(
        e instanceof Error ? e.message : "No pudimos cerrar la sesión",
      );
    } finally {
      setLoggingOut(false);
    }
  }
  if (organization.isPending)
    return (
      <main className="p-8">
        <LoadingSkeleton />
      </main>
    );
  if (organization.error)
    return (
      <main className="mx-auto max-w-lg p-10">
        <h1 className="text-2xl font-semibold">
          No pudimos abrir esta empresa
        </h1>
        <p role="alert" className="my-5">
          {organization.error.message}
        </p>
        <Link href="/seleccionar-empresa" className="text-primary underline">
          Seleccionar empresa
        </Link>
      </main>
    );
  const org = organization.data;
  const base = `/app/${slug}`;
  const nav = [
    { href: `${base}/inicio`, label: "Inicio", icon: House },
    { href: `${base}/clientes`, label: "Clientes", icon: Users },
    { href: `${base}/catalogo`, label: "Catálogo", icon: Package },
    { href: `${base}/cotizaciones`, label: "Cotizaciones", icon: FileText },
    { href: `${base}/operaciones`, label: "Operaciones", icon: ClipboardList },
    { href: `${base}/cobros`, label: "Cobros", icon: Wallet },
    { href: `${base}/reportes`, label: "Reportes", icon: ChartNoAxesCombined },
    ...(org.role !== "MEMBER"
      ? [
          {
            href: `${base}/configuracion/empresa`,
            label: "Empresa",
            icon: Building2,
          },
          {
            href: `${base}/configuracion/usuarios`,
            label: "Usuarios y roles",
            icon: Settings,
          },
          {
            href: `${base}/configuracion/modulos`,
            label: "Módulos",
            icon: SlidersHorizontal,
          },
        ]
      : []),
    ...(org.role === "OWNER"
      ? [
          {
            href: `${base}/configuracion/suscripcion`,
            label: "Plan y suscripción",
            icon: CreditCard,
          },
        ]
      : []),
  ].filter((item) => {
    const key: Record<string, string> = {
      clientes: "customers",
      catalogo: "catalog",
      cotizaciones: "quotes",
      operaciones: "operations",
      cobros: "payments",
      reportes: "reports",
    };
    const module = key[item.href.split("/").at(-1) ?? ""];
    return (
      !module ||
      !modules.data ||
      (modules.data.available.includes(module) &&
        !modules.data.hiddenModules.includes(module))
    );
  });
  return (
    <div className="min-h-screen">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-4"
      >
        Ir al contenido
      </a>
      {open && (
        <button
          className="fixed inset-0 z-30 bg-black/25 lg:hidden"
          aria-label="Cerrar navegación"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-white px-5 py-8 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full invisible lg:visible"}`}
      >
        <div className="mb-8 flex shrink-0 items-center justify-between">
          <Link
            href={`${base}/inicio`}
            className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary"
          >
            <BrandLogo className="w-48 max-w-full" />
          </Link>
          <button
            className="lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          >
            <X />
          </button>
        </div>
        <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-[.2em] text-secondary">
          Espacio de trabajo
        </p>
        <nav
          aria-label="Navegación principal"
          className="min-h-0 flex-1 space-y-1 overflow-y-auto"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "page"
                  : undefined
              }
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${pathname === item.href || pathname.startsWith(item.href + "/") ? "bg-muted font-semibold text-primary" : "text-secondary hover:bg-background"}`}
            >
              <item.icon size={19} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-5 hidden shrink-0 rounded-xl bg-background p-4 min-[1000px]:block">
          <p className="text-sm font-medium">Un espacio para crecer</p>
          <p className="mt-2 text-xs leading-5 text-secondary">
            Organiza tus pedidos, trabajos y cobros en un solo lugar.
          </p>
        </div>
        <div className="mt-5 shrink-0 border-t border-border pt-4">
          <Link
            href="/seleccionar-empresa"
            className="block px-3 py-2 text-sm text-secondary"
          >
            Cambiar de empresa
          </Link>
          <button
            onClick={logout}
            disabled={loggingOut}
            className="flex items-center gap-3 px-3 py-3 text-sm text-secondary"
          >
            <LogOut size={17} />
            {loggingOut ? "Cerrando…" : "Cerrar sesión"}
          </button>
          {logoutError && (
            <p role="alert" className="field-error">
              {logoutError}
            </p>
          )}
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="flex min-h-22 items-center justify-between gap-4 border-b border-border bg-white px-5 md:px-10">
          <div className="flex min-w-0 items-center gap-4">
            <button
              aria-label="Abrir menú"
              aria-expanded={open}
              className="lg:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <div className="min-w-0">
              <label
                htmlFor="organization-switcher"
                className="mb-1 text-[10px] font-medium uppercase tracking-widest text-secondary"
              >
                Empresa activa
              </label>
              <div className="relative">
                <select
                  id="organization-switcher"
                  className="max-w-56 appearance-none !border-0 !p-0 !pr-6 !font-semibold"
                  value={slug}
                  onChange={(event) =>
                    router.push(`/app/${event.target.value}/inicio`)
                  }
                >
                  {profile.data?.memberships.map((m) => (
                    <option key={m.organization.id} value={m.organization.slug}>
                      {m.organization.name}
                    </option>
                  )) ?? <option value={slug}>{org.name}</option>}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-0 top-1"
                  size={14}
                />
              </div>
            </div>
          </div>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span className="hidden text-right text-xs sm:block">
                <strong className="block font-semibold">
                  {profile.data?.name}
                </strong>
                <span className="mt-1 block text-secondary">
                  {org.role === "OWNER"
                    ? "Propietario"
                    : org.role === "ADMIN"
                      ? "Administrador"
                      : "Miembro"}
                </span>
              </span>
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-primary">
                {profile.data?.name.slice(0, 2).toUpperCase() ?? "NU"}
              </span>
            </summary>
            <div className="absolute right-0 z-20 mt-4 w-64 rounded-xl border border-border bg-white p-4 shadow-lg">
              <p className="break-all text-sm">{profile.data?.email}</p>
              <Link
                href={`${base}/perfil`}
                className="mt-4 block text-sm text-primary"
              >
                Mi perfil
              </Link>
              <button
                className="mt-4 text-sm text-secondary"
                onClick={logout}
                disabled={loggingOut}
              >
                Cerrar sesión
              </button>
            </div>
          </details>
        </header>
        <main
          id="contenido"
          className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-10"
        >
          <DemoNotice />
          {children}
        </main>
        <footer className="px-5 pb-8 text-xs text-secondary md:px-10">
          Nuviora Gestión · Tu negocio organizado, sin complicaciones.
        </footer>
      </div>
    </div>
  );
}
