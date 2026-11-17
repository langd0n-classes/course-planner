import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createPastDatedTermFixture } from "@/lib/redesign-fixtures";
import { createTermSchema } from "@/lib/redesign-schemas";

const { preview, apply } = vi.hoisted(() => ({ preview: vi.fn(), apply: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/redesign-auth", () => ({ getAuthenticatedInstructor: vi.fn(async () => ({ id: "instructor-1" })) }));
vi.mock("@/services/redesign/term-service", () => ({ previewTermCreation: preview, applyTermCreation: apply }));

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe.each(["mid-flight", "back-test"] as const)("past-dated Term contract and handler: %s", (scenario) => {
  it.each(["preview", "apply"] as const)("accepts %s through Zod and POST", async (mode) => {
    const fixture = createPastDatedTermFixture(scenario);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${fixture.today}T12:00:00Z`));
    const request = { ...fixture.createRequest, mode };
    expect(createTermSchema.safeParse(request).success).toBe(true);
    preview.mockResolvedValue({ calendarSlotCandidates: [], conflicts: [], warnings: [] });
    apply.mockResolvedValue({
      term: { ...request, id: "term-1", startDate: new Date(request.startDate), endDate: new Date(request.endDate),
        status: "planned", closedAt: null, clonedFromId: null, archivedAt: null },
      calendarSlotCount: 40, warnings: [],
    });
    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/terms", { method: "POST", body: JSON.stringify(request) }));
    expect(response.status).toBe(mode === "preview" ? 200 : 201);
    const body = await response.json();
    expect(body.kind).toBe(mode === "preview" ? "preview" : "applied");
    expect(mode === "preview" ? preview : apply).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      startDate: new Date(request.startDate), endDate: new Date(request.endDate), instructorId: "instructor-1",
    }));
    if (mode === "apply") {
      expect(body.term.startDate).toBe(request.startDate);
      expect(body.term.endDate).toBe(request.endDate);
    }
  });
});
