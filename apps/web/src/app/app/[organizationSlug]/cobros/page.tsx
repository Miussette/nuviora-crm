import { OperationsList } from "@/features/operations/operations-list";
export default async function Page({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  return <OperationsList slug={organizationSlug} receivables />;
}
