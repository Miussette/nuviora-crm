import { Sprout } from 'lucide-react';
export function LoadingSkeleton() { return <div role="status" aria-label="Cargando" className="space-y-5 animate-pulse"><div className="h-12 w-64 rounded-xl bg-muted" /><div className="h-64 rounded-2xl bg-muted" /><span className="sr-only">Cargando…</span></div>; }
export function EmptyState({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return <div className="panel px-6 py-14 text-center"><div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted text-primary"><Sprout size={28} /></div><h2 className="text-xl font-semibold">{title}</h2><p className="mx-auto mt-3 mb-6 max-w-md text-sm leading-6 text-secondary">{description}</p>{children}</div>;
}
export function PageHeader({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div>{eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-primary">{eyebrow}</p>}<h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-3 text-sm text-secondary">{description}</p></div>{children}</div>;
}
