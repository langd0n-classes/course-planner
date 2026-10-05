// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
        description: "",
        changeSummary: "",
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

  it("keeps 150 Topics usable at a narrow viewport and exposes the current chain as information, not a button", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    const topics = Array.from({ length: 150 }, (_, index) => ({
      topic: { id: `topic-${index}`, courseId: "course-1", learningModuleId: null, stableCode: `T${index}`, currentVersionId: `tv-${index}`, archivedAt: null },
      currentVersion: { id: `tv-${index}`, topicId: `topic-${index}`, revision: 1, title: `Topic ${index}`, category: "Dense", description: null, changeSummary: null, publishedAt: null },
      prerequisiteTopicIds: index === 0 ? [] : ["topic-0"],
    }));
    render(<TopicBrowser buckets={[{ key: "unassigned", label: "Unassigned Topics", learningModuleId: null, isUnassigned: true, topics }]} topicTitleById={new Map([["topic-0", "Topic 0"]])} onSaveTopic={vi.fn(async () => undefined)} />);
    expect(document.querySelectorAll("button")).toHaveLength(152);
    expect(screen.getAllByText("Topic 149")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Current chain: No prerequisites");
    expect(within(screen.getByRole("complementary")).queryByRole("button", { name: /Current chain/ })).not.toBeInTheDocument();
  }, 15000);

  it("constrains a long Topic list beside the detail panel at desktop width", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    const title = "A very long Topic title that must wrap within the list instead of extending underneath the open detail panel";
    const topics = Array.from({ length: 130 }, (_, index) => ({
      topic: { id: `topic-${index}`, courseId: "course-1", learningModuleId: null, stableCode: `T${index}`, currentVersionId: `tv-${index}`, archivedAt: null },
      currentVersion: { id: `tv-${index}`, topicId: `topic-${index}`, revision: 1, title: `${title} ${index}`, category: "Dense", description: null, changeSummary: null, publishedAt: null },
      prerequisiteTopicIds: [],
    }));
    render(<TopicBrowser buckets={[{ key: "unassigned", label: "Unassigned Topics", learningModuleId: null, isUnassigned: true, topics }]} topicTitleById={new Map()} onSaveTopic={vi.fn(async () => undefined)} />);
    expect(screen.getByTestId("topic-list")).toHaveClass("min-w-0");
    expect(screen.getAllByText(`${title} 0`)[0]).toHaveClass("break-words");
  });
});

describe("Topic detail edits", () => {
  const buckets = [{ key: "unassigned", label: "Unassigned Topics", learningModuleId: null, isUnassigned: true, topics: [{
    topic: { id: "t1", courseId: "c1", learningModuleId: null, stableCode: "T1", currentVersionId: "v1", archivedAt: null },
    currentVersion: { id: "v1", topicId: "t1", revision: 3, title: "Topic", category: "Concept", description: "Original description", changeSummary: "Previous change", publishedAt: "2026-01-01T00:00:00Z" },
    prerequisiteTopicIds: [],
  }] }];

  it("shows version details, cancels edits locally, and saves description and summary", async () => {
    const onSaveTopic = vi.fn().mockResolvedValue(undefined);
    render(<TopicBrowser buckets={buckets} topicTitleById={new Map()} onSaveTopic={onSaveTopic} />);
    expect(screen.getByText(/Revision 3 · Published/)).toBeInTheDocument();
    expect(screen.getByText("Last change: Previous change")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Topic description"), { target: { value: "Discard me" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel edits" }));
    expect(screen.getByLabelText("Topic description")).toHaveValue("Original description");
    expect(onSaveTopic).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Topic description"), { target: { value: "New description" } });
    fireEvent.change(screen.getByLabelText("Topic change summary"), { target: { value: "Explain the topic" } });
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));
    await waitFor(() => expect(onSaveTopic).toHaveBeenCalledWith("t1", { stableCode: "T1", title: "Topic", category: "Concept", description: "New description", changeSummary: "Explain the topic", prerequisiteTopicIds: [] }));
  });

  it("retains description edits when saving fails", async () => {
    render(<TopicBrowser buckets={buckets} topicTitleById={new Map()} onSaveTopic={vi.fn().mockRejectedValue(new Error("Version conflict"))} />);
    fireEvent.change(screen.getByLabelText("Topic description"), { target: { value: "Keep my work" } });
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Version conflict");
    expect(screen.getByLabelText("Topic description")).toHaveValue("Keep my work");
  });
});
