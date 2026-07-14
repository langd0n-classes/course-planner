// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TopicQuickEditor from "./TopicQuickEditor";

const topics = [
  { id: "topic-1", title: "Matrices", code: "MAT", category: "Linear Algebra" },
  { id: "topic-2", title: "Central Limit Theorem", code: "CLT", category: "Probability" },
  { id: "topic-3", title: "Regression Basics", code: "REG", category: "Modeling" },
];

function renderEditor() {
  const onCreate = vi.fn();
  const onUpdate = vi.fn();

  render(<TopicQuickEditor topics={topics} onCreate={onCreate} onUpdate={onUpdate} />);

  return { onCreate, onUpdate };
}

describe("TopicQuickEditor", () => {
  it("suggests a topic code from the title and preserves a manual override", () => {
    renderEditor();

    const titleInput = screen.getByLabelText("New topic title");
    const codeInput = screen.getByLabelText("New topic code");

    fireEvent.change(titleInput, { target: { value: "Law of Large Numbers" } });
    expect(codeInput).toHaveValue("LLN");

    fireEvent.change(codeInput, { target: { value: "CUSTOM" } });
    expect(codeInput).toHaveValue("CUSTOM");

    fireEvent.change(titleInput, { target: { value: "Central Limit Theorem" } });
    expect(codeInput).toHaveValue("CUSTOM");
  });

  it("submits trimmed values from the new topic flow", async () => {
    const { onCreate } = renderEditor();

    fireEvent.change(screen.getByLabelText("New topic title"), {
      target: { value: "  Sampling Distributions  " },
    });
    fireEvent.change(screen.getByLabelText("New topic code"), {
      target: { value: "  SAMP  " },
    });
    fireEvent.change(screen.getByLabelText("New topic category"), {
      target: { value: "  Probability  " },
    });

    fireEvent.click(screen.getByRole("button", { name: /create topic/i }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        title: "Sampling Distributions",
        code: "SAMP",
        category: "Probability",
      }),
    );
  });

  it("filters the dense topic list by search", () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText("Search topics"), {
      target: { value: "probability" },
    });

    expect(screen.getByRole("group", { name: /topic central limit theorem/i })).toBeTruthy();
    expect(screen.queryByRole("group", { name: /topic matrices/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /topic regression basics/i })).toBeNull();
  });

  it("commits inline title and topic code edits", () => {
    const { onUpdate } = renderEditor();

    const row = screen.getByRole("group", { name: /topic matrices/i });
    const titleInput = within(row).getByLabelText("Title");
    const codeInput = within(row).getByLabelText("Topic code");

    fireEvent.change(titleInput, { target: { value: "Matrices Revised" } });
    fireEvent.change(codeInput, { target: { value: "MTR2" } });
    fireEvent.blur(codeInput);

    expect(onUpdate).toHaveBeenCalledWith("topic-1", {
      title: "Matrices Revised",
      code: "MTR2",
    });
  });
});
