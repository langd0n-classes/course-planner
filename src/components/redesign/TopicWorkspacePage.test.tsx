// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setMockBackend } from "@/lib/redesign-api-client";
import type { TopicDto, TopicVersionDto } from "@/lib/redesign-contract";
import TopicWorkspacePage from "./TopicWorkspacePage";

const topic: TopicDto = {
  id: "t1",
  courseId: "c1",
  learningModuleId: "legacy-lm",
  stableCode: "T1",
  currentVersionId: "v1",
  archivedAt: null,
};
const version: TopicVersionDto = {
  id: "v1",
  topicId: "t1",
  revision: 1,
  title: "Probability",
  category: "Concept",
  description: "Original description",
  changeSummary: null,
  publishedAt: "2026-01-01T00:00:00Z",
};

function backend() {
  const other = {
    ...topic,
    id: "t2",
    stableCode: "T2",
    currentVersionId: "v2",
  };
  return {
    listTopics: vi.fn(async () => [topic, other]),
    listTopicPrerequisites: vi.fn(async () => [
      { topicId: "t1", prerequisiteTopicId: "t2" },
    ]),
    getTopic: vi.fn(
      async (
        id: string,
      ): Promise<{
        topic: TopicDto;
        currentVersion: TopicVersionDto | null;
      }> => ({
        topic: id === "t1" ? topic : other,
        currentVersion:
          id === "t1"
            ? version
            : { ...version, id: "v2", topicId: "t2", title: "Counting" },
      }),
    ),
    updateTopic: vi.fn(async () => ({ topic, currentVersion: version })),
    replaceTopicPrerequisites: vi.fn(async () => []),
    createTopicVersion: vi.fn(async () => version),
  };
}

afterEach(() => {
  setMockBackend(null);
  vi.clearAllMocks();
});

describe("TopicWorkspacePage", () => {
  it("loads a direct URL and provides navigation and prerequisite information without a listing", async () => {
    const api = backend();
    setMockBackend(api);
    render(<TopicWorkspacePage courseId="c1" topicId="t1" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Topic");
    await screen.findByDisplayValue("Probability");
    expect(
      screen.getByRole("link", { name: "← Activity board" }),
    ).toHaveAttribute("href", "/courses/c1");
    expect(screen.getByRole("link", { name: "Browse topics" })).toHaveAttribute(
      "href",
      "/courses/c1#topics",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Current chain: Counting",
    );
    expect(screen.getByRole("checkbox", { name: /Counting/ })).toBeChecked();
    expect(screen.queryByTestId("topic-list")).not.toBeInTheDocument();
    expect(screen.queryByText("legacy-lm")).not.toBeInTheDocument();
  });

  it("recovers from a load failure", async () => {
    const api = backend();
    api.listTopics.mockRejectedValueOnce(
      new Error("Topic service unavailable"),
    );
    setMockBackend(api);
    render(<TopicWorkspacePage courseId="c1" topicId="t1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Topic service unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByDisplayValue("Probability");
  });

  it("rejects a Topic outside the course before fetching or editing it", async () => {
    const api = backend();
    setMockBackend(api);
    render(<TopicWorkspacePage courseId="c1" topicId="other-course-topic" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Topic not found in this course.",
    );
    expect(api.getTopic).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Save topic" }),
    ).not.toBeInTheDocument();
  });

  it("updates prerequisites without creating a content revision", async () => {
    const api = backend();
    setMockBackend(api);
    render(<TopicWorkspacePage courseId="c1" topicId="t1" />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /Counting/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));
    await waitFor(() =>
      expect(api.replaceTopicPrerequisites).toHaveBeenCalledWith("t1", []),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save topic" })).toBeEnabled(),
    );
    expect(api.createTopicVersion).not.toHaveBeenCalled();
    expect(api.updateTopic).not.toHaveBeenCalled();
  });

  it("retains edits and reports a revision conflict", async () => {
    const api = backend();
    api.createTopicVersion.mockRejectedValueOnce(
      new Error("Concurrent Topic revision"),
    );
    setMockBackend(api);
    render(<TopicWorkspacePage courseId="c1" topicId="t1" />);
    await screen.findByDisplayValue("Probability");
    fireEvent.change(screen.getByLabelText("Topic description"), {
      target: { value: "Keep my edits" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save topic" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Concurrent Topic revision",
    );
    expect(screen.getByLabelText("Topic description")).toHaveValue(
      "Keep my edits",
    );
    expect(api.createTopicVersion).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({
        expectedCurrentVersionId: "v1",
        description: "Keep my edits",
        publish: false,
      }),
    );
  });

  it("disables content saves for a Topic without a version", async () => {
    const api = backend();
    api.getTopic.mockResolvedValueOnce({ topic, currentVersion: null });
    setMockBackend(api);
    render(<TopicWorkspacePage courseId="c1" topicId="t1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "no current version to edit",
    );
    expect(screen.getByRole("button", { name: "Save topic" })).toBeDisabled();
    expect(api.createTopicVersion).not.toHaveBeenCalled();
  });
});
