'use client';
import Link from 'next/link';
import { BrandLogo } from '@/components/ui/brand';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ArrowUpRight, Plus } from 'lucide-react';
import { Button } from '@nuviora/ui/button';
import { useProfile } from '@/hooks/use-profile';
import { ApiError } from '@/services/api';
import { LoadingSkeleton, PageHeader } from '@/components/ui/states';
import { OrganizationForm } from './organization-form';
export function CompanyEntry({ onboarding = false }: { onboarding?: boolean }) {
  const profile = useProfile(); const router = useRouter();
  useEffect(() => { if (profile.error instanceof ApiError && profile.error.status === 401) router.replace('/login'); }, [profile.error, router]);
  if (profile.isPending) return <main className="mx-auto max-w-4xl p-8"><LoadingSkeleton /></main>;
  if (profile.error) return <main className="p-8"><p role="alert">{profile.error.message}</p><Button className="mt-4" onClick={() => profile.refetch()}>Reintentar</Button></main>;
  return <main className="mx-auto min-h-screen max-w-4xl px-6 py-12"><Link href="/seleccionar-empresa" className="mb-12 inline-block"><BrandLogo className="w-64 max-w-full" /></Link><PageHeader eyebrow={onboarding ? 'Configura tu espacio' : 'Tus espacios de trabajo'} title={onboarding ? 'Cuéntanos sobre tu empresa' : `Hola, ${profile.data.name.split(' ')[0]}`} description={onboarding ? 'Solo necesitamos lo esencial para empezar.' : 'Selecciona la empresa con la que quieres trabajar.'} />{onboarding ? <OrganizationForm /> : <div className="grid gap-5 sm:grid-cols-2">{profile.data.memberships.map(m => <Link href={`/app/${m.organization.slug}/inicio`} key={m.organization.id} className="panel flex items-center gap-4 p-6 transition-colors hover:border-primary"><span className="rounded-xl bg-muted p-3 text-primary"><Building2 /></span><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{m.organization.name}</h2><p className="mt-1 text-sm text-secondary">{m.role === 'OWNER' ? 'Propietario' : m.role === 'ADMIN' ? 'Administrador' : 'Miembro'} · CLP</p></div><ArrowUpRight size={18} /></Link>)}<Link href="/onboarding" className="flex min-h-28 items-center justify-center gap-3 rounded-2xl border border-dashed border-primary p-6 text-primary"><Plus size={20} />Crear empresa</Link></div>}</main>;
}
