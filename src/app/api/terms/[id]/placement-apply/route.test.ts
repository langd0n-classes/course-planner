import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import {
  ConcurrencyConflictError,
  DomainInvariantError,
} from "@/services/redesign";
const { service } = vi.hoisted(() => ({ service: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/redesign-auth", () => ({ getAuthenticatedInstructor: vi.fn() }));
vi.mock("@/services/redesign", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/redesign")>()),
  applyMeetingPlacement: service,
}));
const auth = vi.mocked(getAuthenticatedInstructor);
const payload = { defaultMeetingTime: null, previewToken: "token" };
async function call(body: unknown = payload) {
  const { POST } = await import("./route");
  return POST(
    new NextRequest("http://localhost/api/terms/term/placement-apply", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "term" }) },
  );
}
describe("meeting placement apply route", () => {
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
  it.each([
    { defaultMeetingTime: { startTimeLocal: "9:00", timeZone: "UTC" } },
    { defaultMeetingTime: { startTimeLocal: "09:00", timeZone: "bad/zone" } },
  ])("rejects invalid requests", async (body) => {
    expect((await call(body)).status).toBe(400);
  });
  it("passes validated inputs and returns the result", async () => {
    service.mockResolvedValue({ kind: "applied", placedCount: 1, storedMeetingPatternCount: 2 });
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ kind: "applied", placedCount: 1, storedMeetingPatternCount: 2 });
    expect(service).toHaveBeenCalledWith(
      {},
      { instructorId: "instructor", termId: "term", ...payload },
    );
  });
  it.each([
    ["Term not found", 404],
    ["Closed Terms are read-only", 400],
  ])("maps %s", async (message, status) => {
    service.mockRejectedValue(new DomainInvariantError(message as string));
    expect((await call()).status).toBe(status);
  });
  it("maps a concurrency conflict", async () => {
    service.mockRejectedValue(new ConcurrencyConflictError());
    expect((await call()).status).toBe(409);
  });
});
