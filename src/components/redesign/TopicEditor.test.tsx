// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TopicEditor from "./TopicEditor";

describe("TopicEditor", () => {
  it("shows code after title and saves topic edits and prerequisites", async () => {
    const onSaveTopic = vi
      .fn()
      .mockResolvedValue({
        saveError: null,
        reloadError: null,
        savedVersionId: "tv-2",
      });

    render(
      <TopicEditor
        topicId="topic-1"
        entries={[
          {
            topic: {
              id: "topic-1",
              courseId: "course-1",
              learningModuleId: null,
              stableCode: "SQL1",
              currentVersionId: "tv-1",
              archivedAt: null,
            },
            currentVersion: {
              id: "tv-1",
              topicId: "topic-1",
              revision: 1,
              title: "Selecting",
              category: "SQL",
              description: null,
              changeSummary: null,
              publishedAt: null,
            },
            prerequisiteTopicIds: [],
          },
          {
            topic: {
              id: "topic-2",
              courseId: "course-1",
              learningModuleId: "lm-1",
              stableCode: "PROB1",
              currentVersionId: "tv-2",
              archivedAt: null,
            },
            currentVersion: {
              id: "tv-2",
              topicId: "topic-2",
              revision: 1,
              title: "Sample spaces",
              category: "Probability",
              description: null,
              changeSummary: null,
              publishedAt: null,
            },
            prerequisiteTopicIds: [],
          },
        ]}
        topicTitleById={
          new Map([
            ["topic-1", "Selecting"],
            ["topic-2", "Sample spaces"],
          ])
        }
        onSaveTopic={onSaveTopic}
        onReloadTopic={vi.fn().mockResolvedValue(null)}
      />,
    );

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
    const onSaveTopic = vi
      .fn()
      .mockResolvedValue({
        saveError: null,
        reloadError: null,
        savedVersionId: "tv-2",
      });

    render(
      <TopicEditor
        topicId="topic-1"
        entries={[
          {
            topic: {
              id: "topic-1",
              courseId: "course-1",
              learningModuleId: null,
              stableCode: "SQL1",
              currentVersionId: "tv-1",
              archivedAt: null,
            },
            currentVersion: {
              id: "tv-1",
              topicId: "topic-1",
              revision: 1,
              title: "Selecting",
              category: "SQL",
              description: null,
              changeSummary: null,
              publishedAt: null,
            },
            prerequisiteTopicIds: [],
          },
        ]}
        topicTitleById={new Map([["topic-1", "Selecting"]])}
        onSaveTopic={onSaveTopic}
        onReloadTopic={vi.fn().mockResolvedValue(null)}
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

describe("Topic detail edits", () => {
  const buckets = [
    {
      key: "unassigned",
      label: "Unassigned Topics",
      learningModuleId: null,
      isUnassigned: true,
      topics: [
        {
          topic: {
            id: "t1",
            courseId: "c1",
            learningModuleId: null,
            stableCode: "T1",
            currentVersionId: "v1",
            archivedAt: null,
          },
          currentVersion: {
            id: "v1",
            topicId: "t1",
            revision: 3,
            title: "Topic",
            category: "Concept",
            description: "Original description",
            changeSummary: "Previous change",
            publishedAt: "2026-01-01T00:00:00Z",
          },
          prerequisiteTopicIds: [],
        },
      ],
    },
  ];

  function topicEntries({
    stableCode = "T1",
    prerequisiteTopicIds = [],
    versionId = "v1",
    changeSummary = "Previous change",
  }: {
    stableCode?: string;
    prerequisiteTopicIds?: string[];
    versionId?: string;
    changeSummary?: string;
  } = {}) {
    return [
      {
        topic: {
          ...buckets[0]!.topics[0]!.topic,
          stableCode,
          currentVersionId: versionId,
        },
        currentVersion: {
          ...buckets[0]!.topics[0]!.currentVersion,
          id: versionId,
          changeSummary,
        },
        prerequisiteTopicIds,
      },
      {
        topic: {
          id: "t2",
          courseId: "c1",
          learningModuleId: null,
          stableCode: "T2",
          currentVersionId: "v2",
          archivedAt: null,
        },
        currentVersion: {
          id: "v2",
          topicId: "t2",
          revision: 1,
          title: "Prerequisite topic",
          category: "Concept",
          description: null,
          changeSummary: null,
          publishedAt: null,
        },
        prerequisiteTopicIds: [],
      },
    ];
  }

  it("does not mount or focus a conflict banner during a normal load", () => {
    render(
      <TopicEditor
        topicId="t1"
        entries={topicEntries()}
        topicTitleById={new Map([["t2", "Prerequisite topic"]])}
        onSaveTopic={vi.fn()}
        onReloadTopic={vi.fn().mockResolvedValue(null)}
      />,
    );

    expect(
      screen.queryByRole("region", { name: /saved topic.*editing/i }),
    ).not.toBeInTheDocument();
    expect(document.activeElement).not.toHaveAttribute(
      "id",
      "topic-save-conflict-heading",
    );
  });

  it("shows version details, cancels edits locally, and saves description and summary", async () => {
    const onSaveTopic = vi
      .fn()
      .mockResolvedValue({
        saveError: null,
        reloadError: null,
        savedVersionId: "v2",
      });
    render(
      <TopicEditor
        topicId="t1"
        entries={buckets[0]!.topics}
        topicTitleById={new Map()}
        onSaveTopic={onSaveTopic}
        onReloadTopic={vi.fn().mockResolvedValue(null)}
      />,
    );
    expect(screen.getByText(/Revision 3 · Published/)).toBeInTheDocument();
    expect(
      screen.getByText("Last change: Previous change"),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Topic description"), {
      target: { value: "Discard me" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel edits" }));
    expect(screen.getByLabelText("Topic description")).toHaveValue(
      "Original description",
    );
    expect(onSaveTopic).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Topic description"), {
      target: { value: "New description" },
    });
    fireEvent.change(screen.getByLabelText("Topic change summary"), {
      target: { value: "Explain the topic" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));
    await waitFor(() =>
      expect(onSaveTopic).toHaveBeenCalledWith("t1", {
        stableCode: "T1",
        title: "Topic",
        category: "Concept",
        description: "New description",
        changeSummary: "Explain the topic",
        prerequisiteTopicIds: [],
      }),
    );
  });

  it("retains description edits when saving fails", async () => {
    render(
      <TopicEditor
        topicId="t1"
        entries={buckets[0]!.topics}
        topicTitleById={new Map()}
        onSaveTopic={vi.fn().mockResolvedValue({
          saveError: "Version conflict",
          reloadError: null,
          savedVersionId: null,
        })}
        onReloadTopic={vi.fn().mockResolvedValue(null)}
      />,
    );
    fireEvent.change(screen.getByLabelText("Topic description"), {
      target: { value: "Keep my work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Version conflict",
    );
    expect(screen.getByLabelText("Topic description")).toHaveValue(
      "Keep my work",
    );
  });

  it("blocks a retry when a colleague adds a prerequisite after a code-only save fails", async () => {
    const onSaveTopic = vi.fn().mockResolvedValue({
      saveError: "Unable to save Topic.",
      reloadError: null,
      savedVersionId: null,
    });
    const props = {
      topicId: "t1",
      topicTitleById: new Map([["t2", "Prerequisite topic"]]),
      onSaveTopic,
      onReloadTopic: vi.fn().mockResolvedValue(null),
    };
    const { rerender } = render(<TopicEditor {...props} entries={topicEntries()} />);

    fireEvent.change(screen.getByLabelText("Topic code"), {
      target: { value: "T1-REVISED" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));
    await screen.findByText("Unable to save Topic.");

    rerender(
      <TopicEditor {...props} entries={topicEntries({ prerequisiteTopicIds: ["t2"] })} />,
    );

    expect(
      screen.getByRole("region", { name: /saved topic changed while you were editing/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save topic" })).toBeDisabled();
  });

  it("does not require a choice when only the change summary differs", async () => {
    const onSaveTopic = vi.fn().mockResolvedValue({
      saveError: "Unable to save Topic.",
      reloadError: null,
      savedVersionId: null,
    });
    const props = {
      topicId: "t1",
      topicTitleById: new Map([["t2", "Prerequisite topic"]]),
      onSaveTopic,
      onReloadTopic: vi.fn().mockResolvedValue(null),
    };
    const { rerender } = render(<TopicEditor {...props} entries={topicEntries()} />);

    fireEvent.change(screen.getByLabelText("Topic change summary"), {
      target: { value: "My explanation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));
    await screen.findByText("Unable to save Topic.");
    rerender(
      <TopicEditor
        {...props}
        entries={topicEntries({ versionId: "v3", changeSummary: "Colleague explanation" })}
      />,
    );

    expect(screen.getByRole("button", { name: "Save topic" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Keep my draft" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/You chose to keep your draft/)).not.toBeInTheDocument();
  });

  it("hides the conflict banner when the draft has no differing fields", async () => {
    const props = {
      topicId: "t1",
      topicTitleById: new Map([["t2", "Prerequisite topic"]]),
      onSaveTopic: vi.fn(),
      onReloadTopic: vi.fn().mockResolvedValue(null),
    };
    const { rerender } = render(<TopicEditor {...props} entries={topicEntries()} />);

    rerender(<TopicEditor {...props} entries={topicEntries({ versionId: "v3" })} />);

    expect(
      screen.queryByRole("region", { name: /saved topic.*editing/i }),
    ).not.toBeInTheDocument();
  });

  it("requires a new choice and refocuses the heading after an approved conflict changes again", async () => {
    const onSaveTopic = vi.fn().mockResolvedValue({
      saveError: "Unable to save Topic.",
      reloadError: null,
      savedVersionId: null,
    });
    const props = {
      topicId: "t1",
      topicTitleById: new Map([["t2", "Prerequisite topic"]]),
      onSaveTopic,
      onReloadTopic: vi.fn().mockResolvedValue(null),
    };
    const { rerender } = render(<TopicEditor {...props} entries={topicEntries()} />);

    fireEvent.change(screen.getByLabelText("Topic title"), {
      target: { value: "My topic draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));
    await screen.findByText("Unable to save Topic.");
    rerender(
      <TopicEditor {...props} entries={topicEntries({ prerequisiteTopicIds: ["t2"] })} />,
    );

    const heading = screen.getByRole("heading", {
      name: "The saved Topic changed while you were editing.",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Keep my draft" }));
    expect(screen.getByRole("button", { name: "Save topic" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));
    await waitFor(() => expect(onSaveTopic).toHaveBeenCalledTimes(2));

    rerender(
      <TopicEditor
        {...props}
        entries={topicEntries({
          stableCode: "T1-COLLEAGUE",
          prerequisiteTopicIds: ["t2"],
        })}
      />,
    );

    const secondHeading = screen.getByRole("heading", {
      name: "The saved Topic changed while you were editing.",
    });
    await waitFor(() => expect(secondHeading).toHaveFocus());
    expect(screen.getByRole("button", { name: "Save topic" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep my draft" })).toBeInTheDocument();
  });
});
