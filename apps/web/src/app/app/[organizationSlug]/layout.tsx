import { AppShell } from '@/components/layout/app-shell';
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ organizationSlug: string }> }) { const { organizationSlug } = await params; return <AppShell slug={organizationSlug}>{children}</AppShell>; }
