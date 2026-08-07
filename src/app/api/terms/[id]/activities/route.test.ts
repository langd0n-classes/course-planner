import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { DomainInvariantError } from "@/services/redesign";

const { listMock, listWithRevisionsMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  listWithRevisionsMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ __esModule: true, default: {} }));
vi.mock("@/lib/redesign-auth", () => ({ getAuthenticatedInstructor: vi.fn() }));
vi.mock("@/services/redesign", () => ({
  DomainInvariantError: class DomainInvariantError extends Error {},
  listTermActivitiesForTerm: listMock,
  listTermActivitiesForTermWithRevisions: listWithRevisionsMock,
}));

const authMock = vi.mocked(getAuthenticatedInstructor);
const activity = {
  id: "ta-1", termId: "term-1", courseId: "course-1", activityId: "activity-1",
  plannedActivityVersionId: "av-1", activityTypeVersionId: "atv-1", adoptedLabel: "Lecture",
  termLearningModuleId: null, ordinal: 0, lifecycleState: null, plannedRevisionId: "planned-1",
  deliveredRevisionId: "delivered-1", archivedAt: null,
};
const revision = (id: string, title: string) => ({
  id, termActivityId: "ta-1", revision: 1, baseActivityVersionId: "av-1", title,
  summary: `${title} summary`, changeReason: null, createdByInstructorId: "instructor-1",
  createdAt: new Date("2026-07-15T00:00:00.000Z"),
  meetingDetail: { calendarSlotId: null, startsAt: null, endsAt: null, status: null, modality: "in_person", overrideReason: null, overrideEvidence: null },
  courseworkDetail: null, assessmentDetail: null, topicActions: [], milestones: [],
});

describe("Term activities list route", () => {
  beforeEach(() => { authMock.mockReset(); listMock.mockReset(); listWithRevisionsMock.mockReset(); });

  it("keeps the default response unchanged", async () => {
    authMock.mockResolvedValue({ id: "instructor-1", email: "a@b.test", name: "A" });
    listMock.mockResolvedValue([activity]);
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/terms/term-1/activities"), { params: Promise.resolve({ id: "term-1" }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ termActivities: [expect.objectContaining({ id: "ta-1" })] });
    expect(body).not.toHaveProperty("revisionsByTermActivityId");
  });

  it("returns planned and delivered content, including different delivered content", async () => {
    authMock.mockResolvedValue({ id: "instructor-1", email: "a@b.test", name: "A" });
    listWithRevisionsMock.mockResolvedValue({ termActivities: [activity], revisionsByTermActivityId: {
      "ta-1": { planned: revision("planned-1", "Planned lecture"), delivered: revision("delivered-1", "Delivered lecture") },
    } });
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/terms/term-1/activities?include=revisions"), { params: Promise.resolve({ id: "term-1" }) });
    const body = await response.json();
    expect(body.revisionsByTermActivityId["ta-1"]).toEqual(expect.objectContaining({
      planned: expect.objectContaining({ title: "Planned lecture", summary: "Planned lecture summary" }),
      delivered: expect.objectContaining({ title: "Delivered lecture", summary: "Delivered lecture summary" }),
    }));
    expect(body.revisionsByTermActivityId["ta-1"].delivered.title).not.toBe(body.revisionsByTermActivityId["ta-1"].planned.title);
  });

  it("returns null entries when revision pointers are absent", async () => {
    authMock.mockResolvedValue({ id: "instructor-1", email: "a@b.test", name: "A" });
    listWithRevisionsMock.mockResolvedValue({ termActivities: [{ ...activity, plannedRevisionId: null, deliveredRevisionId: null }], revisionsByTermActivityId: { "ta-1": { planned: null, delivered: null } } });
    const { GET } = await import("./route");
    const body = await (await GET(new NextRequest("http://localhost/api/terms/term-1/activities?include=revisions"), { params: Promise.resolve({ id: "term-1" }) })).json();
    expect(body.revisionsByTermActivityId["ta-1"]).toEqual({ planned: null, delivered: null });
  });

  it("preserves not-found behavior for a non-owner", async () => {
    authMock.mockResolvedValue({ id: "instructor-2", email: "b@b.test", name: "B" });
    listWithRevisionsMock.mockRejectedValue(new DomainInvariantError("Term not found"));
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/terms/term-1/activities?include=revisions"), { params: Promise.resolve({ id: "term-1" }) });
    expect(response.status).toBe(404);
  });
});
