import { UsersTable } from '@/features/administration/users';
export default async function Page({ params }: { params: Promise<{ organizationSlug: string }> }) { return <UsersTable slug={(await params).organizationSlug} />; }
