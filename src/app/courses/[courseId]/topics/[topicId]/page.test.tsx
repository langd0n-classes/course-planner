// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import TopicPage from "./page";

vi.mock("@/components/redesign/TopicWorkspacePage", () => ({
  default: ({ courseId, topicId }: { courseId: string; topicId: string }) => (
    <p>
      Topic {topicId} in course {courseId}
    </p>
  ),
}));

it("opens the Topic page from resolved route parameters", async () => {
  render(
    await TopicPage({
      params: Promise.resolve({ courseId: "course-1", topicId: "topic-2" }),
    }),
  );
  expect(
    screen.getByText("Topic topic-2 in course course-1"),
  ).toBeInTheDocument();
});
