// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type ScenarioComparison, type WhatIfImpact } from "@/lib/api-client";
import WhatIfPanel from "./WhatIfPanel";

function impact(canceledSessionId: string): WhatIfImpact {
  return {
    canceledSessionId, affectedCoverages: [], atRiskSkills: [], newViolations: [],
    healthBefore: { totalSkills: 0, fullyCovered: 0, fullyIntroduced: 0 },
    healthAfter: { totalSkills: 0, fullyCovered: 0, fullyIntroduced: 0 },
  };
}

function deferredComparison() {
  let resolve!: (value: ScenarioComparison) => void;
  const promise = new Promise<ScenarioComparison>((done) => { resolve = done; });
  return { promise, resolve };
}

const props = {
  sessionId: "session-1", termId: "term-1", sessions: [],
  onClose: vi.fn(), onApplyCancel: vi.fn(),
};
const result = { scenarioA: impact("session-1"), scenarioB: impact("session-2") };

describe("WhatIfPanel comparison", () => {
  beforeEach(() => {
    vi.spyOn(api, "getSessionWhatIf").mockResolvedValue(impact("session-1"));
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("hides a completed comparison immediately when selection is cleared", async () => {
    vi.spyOn(api, "whatIfCompare").mockResolvedValue(result);
    const view = render(<WhatIfPanel {...props} compareSessionId="session-2" />);
    expect(await screen.findAllByText("At-risk (unique): 0")).toHaveLength(2);
    view.rerender(<WhatIfPanel {...props} compareSessionId={null} />);
    expect(screen.queryByText("At-risk (unique): 0")).not.toBeInTheDocument();
  });

  it("does not restore a cleared comparison when its request finishes", async () => {
    const pending = deferredComparison();
    vi.spyOn(api, "whatIfCompare").mockReturnValue(pending.promise);
    const view = render(<WhatIfPanel {...props} compareSessionId="session-2" />);
    await screen.findByText("Coverage Impact");
    view.rerender(<WhatIfPanel {...props} compareSessionId={null} />);
    await act(async () => { pending.resolve(result); });
    expect(screen.queryByText("At-risk (unique): 0")).not.toBeInTheDocument();
  });

  it("keeps the selected comparison when an older request resolves last", async () => {
    const oldRequest = deferredComparison();
    const newRequest = deferredComparison();
    vi.spyOn(api, "whatIfCompare")
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const view = render(<WhatIfPanel {...props} compareSessionId="session-2" />);
    await screen.findByText("Coverage Impact");
    view.rerender(<WhatIfPanel {...props} compareSessionId="session-3" />);
    await act(async () => {
      newRequest.resolve({
        scenarioA: impact("session-1"),
        scenarioB: {
          ...impact("session-3"),
          newViolations: [{ type: "ordering", message: "Practice before introduction" }],
        },
      });
    });
    expect(screen.getByText("New violations: 1")).toBeInTheDocument();
    await act(async () => { oldRequest.resolve(result); });
    expect(screen.getByText("New violations: 1")).toBeInTheDocument();
  });
});
