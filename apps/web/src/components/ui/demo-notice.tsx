"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
export function DemoNotice() {
  const info = useQuery({
    queryKey: ["demo-info"],
    queryFn: () => api<{ enabled: boolean; email: string | null }>("/demo"),
    staleTime: 300000,
    retry: false,
  });
  if (!info.data?.enabled) return null;
  return (
    <aside
      aria-label="Información de la demo"
      className="mb-6 rounded-xl border border-primary/20 bg-muted p-4 text-sm text-primary"
    >
      <p className="font-semibold">Demo de Nuviora · Datos ficticios</p>
      <p className="mt-2 text-xs leading-5">
        Puedes explorar y probar el flujo comercial. Usa la cuenta{" "}
        {info.data.email}; la contraseña te la proporciona quien comparte la
        demo. El registro público y el correo externo están deshabilitados. Usa
        únicamente información de prueba.
      </p>
    </aside>
  );
}
