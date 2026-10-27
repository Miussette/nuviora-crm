import { ResourceDetail } from "@/features/resources/resource-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ organizationSlug: string; id: string }>;
}) {
  const { organizationSlug, id } = await params;
  return (
    <ResourceDetail slug={organizationSlug} resource="catalog-items" id={id} />
  );
}
