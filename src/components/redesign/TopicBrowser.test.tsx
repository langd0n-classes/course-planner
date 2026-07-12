// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TopicBrowser from "./TopicBrowser";

describe("TopicBrowser", () => {
  it("keeps the unassigned bucket visible and saves prerequisite changes", async () => {
    const onAssignTopic = vi.fn().mockResolvedValue(undefined);
    const onSavePrerequisites = vi.fn().mockResolvedValue(undefined);

    render(
      <TopicBrowser
        buckets={[
          {
            key: "unassigned",
            label: "Unassigned Topics",
            learningModuleId: null,
            isUnassigned: true,
            topics: [
              {
                topic: { id: "topic-1", courseId: "course-1", learningModuleId: null, stableCode: "SQL1", currentVersionId: "tv-1", archivedAt: null },
                currentVersion: { id: "tv-1", topicId: "topic-1", revision: 1, title: "Selecting", category: "SQL", description: null, changeSummary: null, publishedAt: null },
                prerequisiteTopicIds: [],
              },
            ],
          },
          {
            key: "lm-1",
            label: "Probability",
            learningModuleId: "lm-1",
            isUnassigned: false,
            topics: [
              {
                topic: { id: "topic-2", courseId: "course-1", learningModuleId: "lm-1", stableCode: "PROB1", currentVersionId: "tv-2", archivedAt: null },
                currentVersion: { id: "tv-2", topicId: "topic-2", revision: 1, title: "Sample spaces", category: "Probability", description: null, changeSummary: null, publishedAt: null },
                prerequisiteTopicIds: [],
              },
            ],
          },
        ]}
        learningModules={[{ id: "lm-1", courseId: "course-1", stableCode: "PROB", currentVersionId: "lmv-1", archivedAt: null }]}
        topicTitleById={new Map([
          ["topic-1", "Selecting"],
          ["topic-2", "Sample spaces"],
        ])}
        onAssignTopic={onAssignTopic}
        onSavePrerequisites={onSavePrerequisites}
      />,
    );

    expect(screen.getByText("Unassigned Topics")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Sample spaces/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save prerequisites" }));

    await waitFor(() => {
      expect(onSavePrerequisites).toHaveBeenCalledWith("topic-1", ["topic-2"]);
    });
  });
});
