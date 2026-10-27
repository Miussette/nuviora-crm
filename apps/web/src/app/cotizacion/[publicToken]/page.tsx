import type { Metadata } from 'next';
import { QuoteApprovalPage } from '@/features/quotes/quote-approval-page';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cotización comercial', robots: { index: false, follow: false, noarchive: true }, referrer: 'no-referrer' };
export default async function Page({ params }: { params: Promise<{ publicToken: string }> }) { return <QuoteApprovalPage token={(await params).publicToken} />; }
