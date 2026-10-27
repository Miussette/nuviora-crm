import { OperationForm } from "@/features/operations/operation-form";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { organizationSlug } = await params;
  const q = await searchParams;
  return <OperationForm slug={organizationSlug} quoteId={q.cotizacion} />;
}
