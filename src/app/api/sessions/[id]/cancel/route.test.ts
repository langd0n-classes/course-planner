import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/sessions/[id]/cancel", () => {
  it("returns a typed 501 not_implemented stub for the frozen Phase A contract", async () => {
    const res = await POST();

    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe("not_implemented");
    expect(body.route).toBe("/api/sessions/[id]/cancel");
  });
});
