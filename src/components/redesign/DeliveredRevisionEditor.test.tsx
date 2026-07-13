// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeliveredRevisionEditor from "./DeliveredRevisionEditor";

describe("DeliveredRevisionEditor", () => {
  it("submits a sorted delivered-revision request with the warning banner visible", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <DeliveredRevisionEditor
        plannedVersion={{
          id: "lmv-1",
          learningModuleId: "lm-1",
          revision: 1,
          title: "Probability Foundations",
          description: "Base description",
          studentDescription: null,
          learningObjectives: ["Reason about random variables"],
          notes: "Base notes",
          defaultSequence: 1,
          changeSummary: null,
          publishedAt: null,
          topics: [
            { topicVersionId: "tv-2", sequence: 2 },
            { topicVersionId: "tv-1", sequence: 1 },
          ],
        }}
        deliveredVersion={null}
        availableTopicVersions={[
          { id: "tv-1", topicId: "topic-1", revision: 1, title: "Sample spaces", category: "Probability", description: null, changeSummary: null, publishedAt: null },
          { id: "tv-2", topicId: "topic-2", revision: 1, title: "Random variables", category: "Probability", description: null, changeSummary: null, publishedAt: null },
          { id: "tv-3", topicId: "topic-3", revision: 1, title: "Expectation", category: "Probability", description: null, changeSummary: null, publishedAt: null },
        ]}
        onCancel={() => undefined}
        onSave={onSave}
      />,
    );

    expect(screen.getByText("You are changing the delivered version of this term.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Delivered title"), { target: { value: "Probability in practice" } });
    fireEvent.click(screen.getAllByRole("checkbox")[2]);
    fireEvent.change(screen.getAllByLabelText("Order")[2], { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Change summary"), {
      target: { value: "Added an explicit expectation refresher after week one." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save delivered revision" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        expectedDeliveredLearningModuleVersionId: null,
        title: "Probability in practice",
        description: "Base description",
        notes: "Base notes",
        learningObjectives: ["Reason about random variables"],
        changeSummary: "Added an explicit expectation refresher after week one.",
        topics: [
          { topicVersionId: "tv-1", sequence: 1 },
          { topicVersionId: "tv-2", sequence: 2 },
          { topicVersionId: "tv-3", sequence: 3 },
        ],
      });
    });
  });
});
