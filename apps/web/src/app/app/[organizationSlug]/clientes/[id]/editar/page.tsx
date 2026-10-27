import { ResourceEditor } from "@/features/resources/resource-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ organizationSlug: string; id: string }>;
}) {
  const { organizationSlug, id } = await params;
  return (
    <ResourceEditor slug={organizationSlug} resource="customers" id={id} />
  );
}
