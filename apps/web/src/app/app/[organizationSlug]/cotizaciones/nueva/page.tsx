import { QuoteEditor } from '@/features/quotes/quote-editor';
export default async function Page({ params }: { params: Promise<{ organizationSlug: string }> }) { const { organizationSlug } = await params;  return <QuoteEditor slug={organizationSlug} />; }
