"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsSeries, StatusSeries } from "@nuviora/types";
import { formatClp } from "@nuviora/domain";
export const chartLabels: Record<string, string> = {
  SENT: "Pendientes",
  APPROVED: "Aprobadas",
  REJECTED: "Rechazadas",
  EXPIRED: "Vencidas",
  CANCELLED: "Canceladas",
  PENDING: "Pendientes",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Completadas",
};
export function RevenueChart({
  series,
  title = "Evolución de ventas",
}: {
  series: AnalyticsSeries;
  title?: string;
}) {
  const data = series.data.map((r) => ({ ...r, plot: Number(r.amount) }));
  const hasData = data.some((r) => r.plot !== 0);
  return (
    <section className="panel min-w-0 p-5 md:p-6">
      <h2 className="mb-1 font-semibold">{title}</h2>
      <p className="mb-5 text-xs text-secondary">
        CLP · {series.range.from} al {series.range.to}
      </p>
      {hasData ? (
        <div
          role="img"
          aria-label={`${title}. Valores exactos en la tabla accesible.`}
          className="h-60 w-full min-w-0"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="#eee8f5" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => String(v).slice(5)}
                minTickGap={45}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                width={65}
                tickFormatter={(v) =>
                  new Intl.NumberFormat("es-CL", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(Number(v))
                }
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(_v, _n, item) => [
                  formatClp(String(item.payload.amount)),
                  "CLP",
                ]}
              />
              <Area
                type="monotone"
                dataKey="plot"
                name="Monto"
                stroke="#7759A6"
                fill="#eee8f5"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="flex h-60 items-center justify-center text-center text-sm text-secondary">
          Sin movimientos en este período.
        </p>
      )}
      <details className="mt-4 text-xs text-secondary">
        <summary className="cursor-pointer text-primary">
          Ver datos del gráfico
        </summary>
        <div className="mt-3 max-h-52 overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{title}: valores exactos</caption>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Monto CLP</th>
              </tr>
            </thead>
            <tbody>
              {series.data.map((r) => (
                <tr key={r.date}>
                  <td className="py-1">{r.date}</td>
                  <td>{formatClp(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
export function PaymentsChart({ series }: { series: AnalyticsSeries }) {
  return <RevenueChart series={series} title="Evolución de cobros" />;
}
export function BalancesChart({ amount }: { amount: string }) {
  return (
    <div
      className="mt-4 h-24 min-w-0"
      role="img"
      aria-label={`Saldo pendiente: ${formatClp(amount)}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={[{ label: "Saldo vigente", plot: Number(amount), amount }]}
          layout="vertical"
          margin={{ left: 0, right: 25 }}
        >
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" hide />
          <Tooltip
            formatter={(_v, _n, item) => [
              formatClp(String(item.payload.amount)),
              "Saldo",
            ]}
          />
          <Bar
            dataKey="plot"
            fill="#9176b5"
            radius={[0, 6, 6, 0]}
            barSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function StatusChart({
  series,
  title,
}: {
  series: StatusSeries;
  title: string;
}) {
  const data = series.data.map((r) => ({
    ...r,
    label: chartLabels[r.status] ?? r.status,
  }));
  return (
    <section className="panel min-w-0 p-5 md:p-6">
      <h2 className="mb-5 font-semibold">{title}</h2>
      {data.some((r) => r.count) ? (
        <div
          className="h-56 min-w-0"
          role="img"
          aria-label={`${title}. Conteos debajo del gráfico.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 0, right: 20 }}
            >
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={95}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Bar
                dataKey="count"
                name="Cantidad"
                fill="#9176b5"
                radius={[0, 5, 5, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="flex h-56 items-center justify-center text-sm text-secondary">
          Sin registros en este período.
        </p>
      )}
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-secondary">
        {data.map((r) => (
          <li key={r.status}>
            {r.label}: <strong className="text-foreground">{r.count}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
export function QuotesStatusChart({ series }: { series: StatusSeries }) {
  return <StatusChart series={series} title="Cotizaciones por estado" />;
}
export function OperationsStatusChart({ series }: { series: StatusSeries }) {
  return <StatusChart series={series} title="Operaciones por estado" />;
}
