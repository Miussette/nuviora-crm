import { Members } from '@/features/organizations/settings';
export default async function Page({ params }: { params: Promise<{ organizationSlug: string }> }) { return <Members slug={(await params).organizationSlug} />; }
