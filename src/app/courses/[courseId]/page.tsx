import CourseWorkspacePage from "@/components/redesign/CourseWorkspacePage";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <CourseWorkspacePage courseId={courseId} />;
}
