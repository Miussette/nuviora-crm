import { PaymentForm } from "@/features/operations/payments";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { organizationSlug } = await params;
  const q = await searchParams;
  return <PaymentForm slug={organizationSlug} operationId={q.operacion} />;
}
