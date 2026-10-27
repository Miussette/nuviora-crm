import { Workspace } from '@/features/organizations/workspace';
export default async function Page({ params }: { params: Promise<{ organizationSlug: string }> }) { return <Workspace slug={(await params).organizationSlug} />; }
