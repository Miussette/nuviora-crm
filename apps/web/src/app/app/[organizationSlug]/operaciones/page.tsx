import { OperationsList } from "@/features/operations/operations-list";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { organizationSlug } = await params;
  const q = await searchParams;
  return <OperationsList slug={organizationSlug} customerId={q.cliente} />;
}
