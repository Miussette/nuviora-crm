import { ResourceEditor } from "@/features/resources/resource-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  return <ResourceEditor slug={organizationSlug} resource="customers" />;
}
