import { Dashboard } from '@/features/analytics/dashboard';
export default async function Page({ params }: { params: Promise<{ organizationSlug: string }> }) { return <Dashboard slug={(await params).organizationSlug} />; }
