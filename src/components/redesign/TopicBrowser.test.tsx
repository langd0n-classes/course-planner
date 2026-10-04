// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TopicBrowser from "./TopicBrowser";

const topics = Array.from({ length: 150 }, (_, index) => ({
  id: `topic-${index}`,
  courseId: "course-1",
  learningModuleId: index % 2 ? "lm-1" : null,
  stableCode: `T${index}`,
  currentVersionId: `tv-${index}`,
  archivedAt: null,
}));
const versions = new Map(
  topics.map((topic, index) => [
    topic.id,
    {
      id: `tv-${index}`,
      topicId: topic.id,
      revision: 1,
      title: `Topic ${index}`,
      category: "Dense",
      description: null,
      changeSummary: null,
      publishedAt: null,
    },
  ]),
);

describe("TopicBrowser", () => {
  it("keeps 150 Topics reachable at a narrow viewport without a detail panel or module ownership", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 375,
    });
    render(
      <TopicBrowser
        courseId="course-1"
        topics={topics}
        currentVersionsByTopicId={versions}
      />,
    );
    expect(screen.getByTestId("topic-list").querySelectorAll("a")).toHaveLength(150);
    expect(screen.getByText("Topic 149").closest("a")).toHaveAttribute(
      "href",
      "/courses/course-1/topics/topic-149",
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Topic title")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Unassigned|module home|in this module/i),
    ).not.toBeInTheDocument();
  });

  it("wraps long titles within the standalone list at desktop width", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440,
    });
    const title =
      "A very long Topic title that must wrap within the list instead of extending underneath an open detail panel";
    render(
      <TopicBrowser
        courseId="course-1"
        topics={topics}
        currentVersionsByTopicId={
          new Map([["topic-0", { ...versions.get("topic-0")!, title }]])
        }
      />,
    );
    expect(screen.getByTestId("topic-list")).toHaveClass("min-w-0");
    expect(screen.getByText(title)).toHaveClass("break-words");
    expect(screen.getByText("T0")).toBeInTheDocument();
  });

  it("shows an empty course and links Topics with no current version", () => {
    const { rerender } = render(
      <TopicBrowser
        courseId="course-1"
        topics={[]}
        currentVersionsByTopicId={new Map()}
      />,
    );
    expect(screen.getByText("No topics yet.")).toBeInTheDocument();
    rerender(
      <TopicBrowser
        courseId="course-1"
        topics={[topics[0]!]}
        currentVersionsByTopicId={new Map()}
      />,
    );
    expect(
      screen.getByRole("link", { name: /Draft topic T0/ }),
    ).toHaveAttribute("href", "/courses/course-1/topics/topic-0");
  });
});
