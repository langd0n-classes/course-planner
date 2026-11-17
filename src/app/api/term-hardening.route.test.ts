/* eslint-disable @typescript-eslint/no-explicit-any -- route request fixtures */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ConcurrencyConflictError, DomainInvariantError } from "@/services/redesign/errors";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), clone: vi.fn(), remove: vi.fn(), calendar: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/redesign-auth", () => ({ getAuthenticatedInstructor: async () => ({ id: "i" }) }));
vi.mock("@/services/redesign/term-service", () => ({ applyTermCreation: mocks.create, previewTermCreation: mocks.create, updateTerm: mocks.update }));
vi.mock("@/services/redesign", async (original) => ({ ...await original<any>(), applyTermClone: mocks.clone, previewTermClone: mocks.clone, removeTermLearningModule: mocks.remove, applyTermCalendar: mocks.calendar }));
import { POST as create } from "./terms/route";
import { PATCH as update } from "./terms/[id]/route";
import { POST as clone } from "./terms/[id]/clone/route";
import { DELETE as remove } from "./term-learning-modules/[id]/route";
import { POST as calendar } from "./terms/[id]/calendar/apply/route";
const body = { mode: "apply", courseId: "00000000-0000-4000-8000-000000000001", institutionId: "00000000-0000-4000-8000-000000000002", academicCalendarId: "00000000-0000-4000-8000-000000000003", code: "F26", name: "Fall", startDate: "2026-01-01", endDate: "2026-05-01", meetingPattern: { roles: [{ roleKey: "lecture", label: "Lecture", sessionType: "lecture", days: ["Monday"] }] } };
const context = { params: Promise.resolve({ id: "term" }) };
const request = (data: unknown) => new NextRequest("http://localhost/api/terms", { method: "POST", body: JSON.stringify(data) });
beforeEach(() => vi.resetAllMocks());
describe.each([["create", create, mocks.create], ["update", update, mocks.update], ["clone", clone, mocks.clone]] as const)("%s errors", (_name, handler, mock) => {
  it("returns 409 naming the duplicate code", async () => {
    mock.mockRejectedValue(new ConcurrencyConflictError('The Course already uses Term code "F26"'));
    const response = await handler(request(body), context);
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("F26");
  });
  it.each(["real calendar date", "after the start date", "400 days"])("returns 400 for %s", async (message) => {
    mock.mockRejectedValue(new DomainInvariantError(message));
    expect((await handler(request(body), context)).status).toBe(400);
  });
  it("passes the original date text to the service for calendar validation", async () => {
    mock.mockRejectedValue(new DomainInvariantError("real calendar date"));
    await handler(request({ ...body, startDate: "2026-02-30" }), context);
    expect(mock).toHaveBeenCalled();
    expect(mock.mock.calls[0].at(-1)).toMatchObject({ startDate: "2026-02-30" });
  });
});
it("returns 409 with the Term Activities blocker on removal", async () => {
  mocks.remove.mockRejectedValue(new ConcurrencyConflictError("Cannot remove while 2 Term Activities remain attached"));
  const response = await remove(request({}), context);
  expect(response.status).toBe(409);
  expect(await response.text()).toContain("2 Term Activities");
});
it("preserves 404 for closed Term calendar apply", async () => {
  mocks.calendar.mockRejectedValue(new DomainInvariantError("Closed Terms are read-only"));
  const response = await calendar(request({ previewToken: "token", expectedCurrentCalendarSlotCount: 0, meetingPatterns: [] }), context);
  expect(response.status).toBe(404);
  expect(await response.text()).toContain("Closed Terms are read-only");
});
