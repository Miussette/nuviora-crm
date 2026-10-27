"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Paginated, QuoteListRow } from "@nuviora/types";
import { formatClp } from "@nuviora/domain";
import { organizationApi } from "@/services/resources";
import { QuoteStatusBadge } from "./quote-status";
export function CustomerQuotes({
  slug,
  customerId,
}: {
  slug: string;
  customerId: string;
}) {
  const result = useQuery({
    queryKey: ["quotes", slug, "customer", customerId],
    queryFn: () =>
      organizationApi<Paginated<QuoteListRow>>(
        slug,
        `/quotes?customerId=${customerId}&pageSize=5`,
      ),
  });
  return (
    <section className="panel mt-7 max-w-4xl p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-semibold">Cotizaciones del cliente</h2>
        <Link
          className="text-sm text-primary underline"
          href={`/app/${slug}/cotizaciones?cliente=${customerId}`}
        >
          Ver todas
        </Link>
      </div>
      {result.isPending ? (
        <p role="status" className="text-sm text-secondary">
          Cargando cotizaciones…
        </p>
      ) : result.error ? (
        <p role="alert" className="field-error">
          {result.error.message}
        </p>
      ) : result.data.data.length ? (
        <ul className="space-y-4">
          {result.data.data.map((row) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3"
              key={row.id}
            >
              <Link
                className="text-sm font-medium text-primary underline"
                href={`/app/${slug}/cotizaciones/${row.id}`}
              >
                {row.number}
              </Link>
              <QuoteStatusBadge status={row.status} />
              <span className="text-sm">{formatClp(row.total)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-secondary">
          Este cliente todavía no tiene cotizaciones registradas.
        </p>
      )}
    </section>
  );
}
