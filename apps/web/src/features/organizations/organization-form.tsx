'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { Organization } from '@nuviora/types';
import { Button } from '@nuviora/ui/button';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useUnsaved } from '@/hooks/use-unsaved';
import {isValidRut} from '@nuviora/domain';
const schema = z.object({ name: z.string().trim().min(2, 'Ingresa al menos 2 caracteres').max(100), email: z.email('Ingresa un correo válido'), legalName: z.string().max(150), rut: z.string().max(20).refine(v=>!v||isValidRut(v),'Ingresa un RUT válido'), phone: z.string().max(30), businessType: z.enum(['PRODUCTS', 'SERVICES', 'MIXED']) });
type Values = z.infer<typeof schema>;
export function OrganizationForm({ organization }: { organization?: Organization }) {
  const router = useRouter(); const client = useQueryClient();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting, isDirty } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: organization?.name ?? '', email: organization?.email ?? '', legalName: organization?.legalName ?? '', rut: organization?.rut ?? '', phone: organization?.phone ?? '', businessType: organization?.settings?.businessType ?? 'MIXED' } });
  useUnsaved(isDirty && !isSubmitting);
  async function submit(values: Values) {
    try {
      const result = await api<Organization>(organization ? `/organizations/${organization.slug}` : '/organizations', { method: organization ? 'PATCH' : 'POST', body: JSON.stringify(values) });
      reset(values); await client.invalidateQueries(); toast.success('Empresa guardada'); router.push(`/app/${result.slug}/inicio`);
    } catch (error) { setError('root', { message: error instanceof Error ? error.message : 'No pudimos guardar' }); }
  }
  const fields = [['name', 'Nombre comercial *'], ['email', 'Correo comercial *'], ['legalName', 'Razón social'], ['rut', 'RUT (opcional)'], ['phone', 'Teléfono']] as const;
  return <form className="panel max-w-3xl space-y-6 p-6 md:p-8" onSubmit={handleSubmit(submit)} noValidate><div className="grid gap-6 sm:grid-cols-2">{fields.map(([name, label]) => <div key={name}><label htmlFor={name}>{label}</label><input id={name} type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'} {...register(name)} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined} />{errors[name] && <p id={`${name}-error`} className="field-error">{errors[name]?.message}</p>}</div>)}<div><label htmlFor="businessType">¿Qué ofrece tu negocio?</label><select id="businessType" {...register('businessType')}><option value="PRODUCTS">Productos</option><option value="SERVICES">Servicios</option><option value="MIXED">Productos y servicios</option></select></div></div><p className="rounded-xl bg-background p-4 text-sm text-secondary">País: Chile · Moneda: peso chileno (CLP). Los datos opcionales se pueden completar después.</p>{errors.root && <p role="alert" className="field-error">{errors.root.message}</p>}<Button disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : organization ? 'Guardar cambios' : 'Crear mi empresa'}</Button></form>;
}
