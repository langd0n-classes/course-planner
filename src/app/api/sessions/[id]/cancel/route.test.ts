import { describe, expect, it, vi } from "vitest";

const { cancelSessionMock } = vi.hoisted(() => ({
  cancelSessionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {},
}));

vi.mock("@/services/redesign", () => ({
  DomainInvariantError: class DomainInvariantError extends Error {},
  cancelSession: cancelSessionMock,
}));

import { POST } from "./route";

describe("POST /api/sessions/[id]/cancel", () => {
  it("returns the dry-run validation payload from the redesign service", async () => {
    cancelSessionMock.mockResolvedValueOnce({
      valid: false,
      issues: [{ code: "practiced_before_introduced", severity: "error", message: "bad order" }],
    });

    const req = new Request("http://localhost/api/sessions/s1/cancel", {
      method: "POST",
      body: JSON.stringify({ dryRun: true, redistributions: [] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req as never, { params: Promise.resolve({ id: "s1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.issues[0].code).toBe("practiced_before_introduced");
  });
});
