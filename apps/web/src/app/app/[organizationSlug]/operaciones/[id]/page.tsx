import { OperationDetail } from "@/features/operations/operation-detail";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string; id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { organizationSlug, id } = await params;
  const q = await searchParams;
  return <OperationDetail slug={organizationSlug} id={id} initialTab={q.tab} />;
}
