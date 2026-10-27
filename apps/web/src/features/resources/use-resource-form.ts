"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  organizationApi,
  resourceRoute,
  type Resource,
} from "@/services/resources";
export function useResourceSave(slug: string, resource: Resource, id?: string) {
  const router = useRouter();
  const client = useQueryClient();
  const [error, setError] = useState("");
  async function save(values: unknown, onSaved: () => void) {
    setError("");
    try {
      const row = await organizationApi<{ id: string }>(
        slug,
        `/${resource}${id ? `/${id}` : ""}`,
        { method: id ? "PATCH" : "POST", body: JSON.stringify(values) },
      );
      onSaved();
      await client.invalidateQueries({ queryKey: [resource, slug] });
      await client.invalidateQueries({ queryKey: ["activity", slug] });
      toast.success(
        resource === "customers" ? "Cliente guardado" : "Elemento guardado",
      );
      router.push(`/app/${slug}/${resourceRoute(resource)}/${row.id}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos guardar los cambios",
      );
    }
  }
  return { save, error };
}
