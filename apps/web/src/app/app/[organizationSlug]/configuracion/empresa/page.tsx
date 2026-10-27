import { Settings } from '@/features/organizations/settings';
export default async function Page({ params }: { params: Promise<{ organizationSlug: string }> }) { return <Settings slug={(await params).organizationSlug} />; }
