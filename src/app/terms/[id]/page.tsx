import TermWorkspacePage from "@/components/redesign/TermWorkspacePage";

export default async function TermPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TermWorkspacePage termId={id} />;
}
