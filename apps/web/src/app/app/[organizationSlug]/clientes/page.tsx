import { ResourceList } from "@/features/resources/resource-list";
export default async function Page({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  return <ResourceList slug={organizationSlug} resource="customers" />;
}
