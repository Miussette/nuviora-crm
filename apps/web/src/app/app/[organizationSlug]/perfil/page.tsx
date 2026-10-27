'use client';
import { useProfile } from '@/hooks/use-profile';
import { PageHeader, LoadingSkeleton } from '@/components/ui/states';
export default function Profile() {
  const profile = useProfile();
  return <><PageHeader title="Mi perfil" description="Información de tu cuenta personal." />{profile.isPending ? <LoadingSkeleton /> : profile.error ? <p role="alert">{profile.error.message}</p> : <dl className="panel max-w-xl space-y-5 p-7"><div><dt className="text-xs text-secondary">Nombre</dt><dd className="mt-2">{profile.data.name}</dd></div><div><dt className="text-xs text-secondary">Correo</dt><dd className="mt-2 break-all">{profile.data.email}</dd></div><div><dt className="text-xs text-secondary">Verificación</dt><dd className="mt-2">{profile.data.emailVerifiedAt ? 'Correo verificado' : 'Pendiente de verificación'}</dd></div></dl>}</>;
}
