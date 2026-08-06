// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TopicBrowser from "./TopicBrowser";

describe("TopicBrowser", () => {
  it("keeps the unassigned bucket visible, shows code after title, and saves compact topic edits", async () => {
    const onSaveTopic = vi.fn().mockResolvedValue(undefined);

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
        topicTitleById={new Map([
          ["topic-1", "Selecting"],
          ["topic-2", "Sample spaces"],
        ])}
        onSaveTopic={onSaveTopic}
      />,
    );

    expect(screen.getByText("Unassigned Topics")).toBeInTheDocument();
    expect(screen.getAllByText("Selecting").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SQL1").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Topic title"), {
      target: { value: "Selecting rows" },
    });
    fireEvent.change(screen.getByLabelText("Topic code"), {
      target: { value: "topic-selecting-rows" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Sample spaces/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));

    await waitFor(() => {
      expect(onSaveTopic).toHaveBeenCalledWith("topic-1", {
        stableCode: "topic-selecting-rows",
        title: "Selecting rows",
        category: "SQL",
        prerequisiteTopicIds: ["topic-2"],
      });
    });
  });

  it("lets Tab accept the suggested topic code without trapping focus", () => {
    const onSaveTopic = vi.fn().mockResolvedValue(undefined);

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
        ]}
        topicTitleById={new Map([["topic-1", "Selecting"]])}
        onSaveTopic={onSaveTopic}
      />,
    );

    fireEvent.change(screen.getByLabelText("Topic title"), {
      target: { value: "Window functions" },
    });
    const codeInput = screen.getByLabelText("Topic code");
    fireEvent.change(codeInput, { target: { value: "" } });
    fireEvent.keyDown(codeInput, { key: "Tab" });

    expect(codeInput).toHaveValue("topic-window-functions");
  });
});
