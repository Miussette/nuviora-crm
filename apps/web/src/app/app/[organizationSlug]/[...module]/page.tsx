import { notFound } from 'next/navigation';
import { EmptyState, PageHeader } from '@/components/ui/states';
const modules: Record<string, string> = { clientes: 'Clientes', catalogo: 'Catálogo', cotizaciones: 'Cotizaciones', operaciones: 'Operaciones', cobros: 'Cobros', 'configuracion/modulos': 'Módulos', 'configuracion/suscripcion': 'Suscripción' };
export default async function Page({ params }: { params: Promise<{ module: string[] }> }) {
  const path = (await params).module.join('/');
  const title = modules[path] ?? modules[path.split('/')[0] ?? ''];
  if (!title) notFound();
  return <><PageHeader title={title} description="Este módulo está previsto en el plan de implementación." /><EmptyState title="Un próximo paso para tu negocio" description="La Fase 1 cubre acceso, empresas y seguridad. Este módulo se implementará y probará en una fase posterior." /></>;
}
