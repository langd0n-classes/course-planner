import { NotFoundError } from "@/services/redesign/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { DomainInvariantError } from "@/services/redesign";
const { service } = vi.hoisted(() => ({ service: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/redesign-auth", () => ({ getAuthenticatedInstructor: vi.fn() }));
vi.mock("@/services/redesign", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/redesign")>()),
  previewMilestoneDating: service,
}));
const auth = vi.mocked(getAuthenticatedInstructor);
const payload = {};
async function call(body: unknown = payload) {
  const { POST } = await import("./route");
  return POST(
    new NextRequest(
      "http://localhost/api/terms/term/milestone-dating-preview",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
    { params: Promise.resolve({ id: "term" }) },
  );
}
describe("milestone dating preview route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.mockResolvedValue({
      id: "instructor",
      email: "i@example.edu",
      name: "Instructor",
    });
  });
  it("requires authentication", async () => {
    auth.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(service).not.toHaveBeenCalled();
  });
  it("rejects a non-object payload", async () => {
    expect((await call(null)).status).toBe(400);
  });
  it("passes validated inputs and returns the result", async () => {
    service.mockResolvedValue({
      kind: "preview",
      previewToken: "token",
      dates: [
        {
          termActivityId: "a",
          milestoneId: "m",
          sourceTemplateId: "t",
          label: "Due",
          adoptedLabel: "Practice",
          linkedTermActivityId: "meeting",
          linkedMeetingLabel: "Lecture",
          expectedPlannedRevisionId: "r",
          occursAt: new Date("2026-03-06T14:00:00Z"),
          timeZone: "UTC",
          internal: true,
        },
      ],
      creates: [],
      undated: [],
      alreadyDatedCount: 0,
    });
    const response = await call();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.dates[0]).toMatchObject({
      label: "Due",
      adoptedLabel: "Practice",
      occursAt: "2026-03-06T14:00:00.000Z",
    });
    expect(body.dates[0]).not.toHaveProperty("internal");
    expect(service).toHaveBeenCalledWith(
      {},
      { instructorId: "instructor", termId: "term", ...payload },
    );
  });
  it.each([
    ["Term not found", 404],
    ["Closed Terms are read-only", 400],
  ])("maps %s", async (message, status) => {
    service.mockRejectedValue((status === 404 ? new NotFoundError(message as string) : new DomainInvariantError(message as string)));
    expect((await call()).status).toBe(status);
  });
});
