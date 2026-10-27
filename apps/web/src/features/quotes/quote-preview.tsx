import Image from "next/image";
import type { QuoteCommercial } from "@nuviora/types";
import { formatClp } from "@nuviora/domain";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { QuoteTotals } from "./quote-totals";
export function QuotePreview({ document }: { document: QuoteCommercial }) {
  const lineRows = document.items.map((item, index) => ({
    ...item,
    id: String(index),
  }));
  const columns: DataColumn<(typeof lineRows)[number]>[] = [
    {
      id: "name",
      label: "Concepto",
      render: (item) => (
        <>
          <span className="font-medium">{item.name}</span>
          {item.description && (
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-secondary">
              {item.description}
            </p>
          )}
          <p className="mt-1 text-xs text-secondary">Unidad: {item.unit}</p>
        </>
      ),
    },
    { id: "quantity", label: "Cantidad", render: (item) => item.quantity },
    {
      id: "unitPrice",
      label: "Precio unitario",
      render: (item) => formatClp(item.unitPrice),
    },
    { id: "discount", label: "Dto. %", render: (item) => item.discount },
    { id: "tax", label: "IVA %", render: (item) => item.taxRate },
    {
      id: "total",
      label: "Total CLP",
      render: (item) => formatClp(item.lineTotal),
    },
  ];
  const date = (value: string) =>
    new Intl.DateTimeFormat("es-CL", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value.slice(0, 10) + "T12:00:00Z"));
  return (
    <article className="panel space-y-8 p-5 md:p-8">
      <header className="flex flex-wrap justify-between gap-6 border-b border-border pb-6">
        <div className="min-w-0 flex-1">
          {document.issuer.logoDataUrl && (
            <Image
              unoptimized
              src={document.issuer.logoDataUrl}
              alt={`Logo de ${document.issuer.name}`}
              width={180}
              height={64}
              className="mb-4 h-16 w-44 object-contain object-left"
            />
          )}
          <h2
            className="break-words text-xl font-semibold"
            style={{ color: document.issuer.accentColor }}
          >
            {document.issuer.name}
          </h2>
          {[
            document.issuer.legalName,
            document.issuer.rut ? `RUT: ${document.issuer.rut}` : null,
            document.issuer.email,
            document.issuer.phone,
          ]
            .filter(Boolean)
            .map((value, index) => (
              <p
                key={index}
                className="mt-1 break-words text-sm text-secondary"
              >
                {value}
              </p>
            ))}
        </div>
        <div className="text-sm leading-7">
          <h3 className="font-semibold text-primary">
            Cotización {document.number}
          </h3>
          <p>Emisión: {date(document.issueDate)}</p>
          <p>Vencimiento: {date(document.expiryDate)}</p>
          <p>CLP · Versión {document.documentVersion}</p>
        </div>
      </header>
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
          Preparada para
        </p>
        <h3 className="mt-2 break-words font-semibold">
          {document.customer.name}
        </h3>
        {[
          document.customer.rut,
          document.customer.email,
          document.customer.phone,
          [
            document.customer.address,
            document.customer.commune,
            document.customer.region,
            document.customer.country,
          ]
            .filter(Boolean)
            .join(", "),
        ]
          .filter(Boolean)
          .map((value, index) => (
            <p key={index} className="mt-1 break-words text-sm text-secondary">
              {value}
            </p>
          ))}
        {document.reference && (
          <p className="mt-4 break-words text-sm">
            <strong>Referencia:</strong> {document.reference}
          </p>
        )}
      </section>
      {lineRows.length ? (
        <DataTable
          data={lineRows}
          columns={columns}
          caption="Detalle de la cotización"
        />
      ) : (
        <p className="rounded-xl bg-background p-5 text-sm text-secondary">
          Este borrador todavía no tiene ítems.
        </p>
      )}
      <QuoteTotals amounts={document} />
      <div className="space-y-5">
        {[
          ["Observaciones", document.notes],
          ["Plazo de entrega", document.deliveryTerms],
          ["Condiciones de pago", document.paymentTerms],
          ["Vigencia", document.validityTerms],
          ["Notas para el cliente", document.customerNotes],
        ].map(
          ([label, value]) =>
            value && (
              <section key={label}>
                <h3 className="text-sm font-semibold">{label}</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-secondary">
                  {value}
                </p>
              </section>
            ),
        )}
      </div>
      <footer className="space-y-3 border-t border-border pt-5 text-xs leading-5 text-secondary">
        {document.issuer.footer && (
          <p className="whitespace-pre-wrap break-words">
            {document.issuer.footer}
          </p>
        )}
        <p>
          Esta cotización comercial no constituye una factura electrónica del
          SII.
        </p>
      </footer>
    </article>
  );
}
