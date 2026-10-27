import { CompanySettings } from '@/features/administration/company-settings';
export default async function Page({ params }: { params: Promise<{ organizationSlug: string }> }) { return <CompanySettings slug={(await params).organizationSlug} />; }
