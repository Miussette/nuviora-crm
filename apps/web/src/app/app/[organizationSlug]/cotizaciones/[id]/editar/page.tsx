import { QuoteEditor } from '@/features/quotes/quote-editor';
export default async function Page({ params }: { params: Promise<{ organizationSlug: string; id: string }> }) { const { organizationSlug, id } = await params;  return <QuoteEditor slug={organizationSlug} id={id} />; }
