import TopicWorkspacePage from "@/components/redesign/TopicWorkspacePage";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ courseId: string; topicId: string }>;
}) {
  const { courseId, topicId } = await params;
  return <TopicWorkspacePage courseId={courseId} topicId={topicId} />;
}
