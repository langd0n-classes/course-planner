/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPastDatedTermFixture } from "@/lib/redesign-fixtures";
import { computeTermImpact } from "./planning-service";
import { applyTermCreation, previewTermCreation } from "./term-service";

function database(tx: Record<string, any>) {
  return { $transaction: async <T>(fn: (tx: Record<string, any>) => Promise<T>) => fn(tx) };
}

afterEach(() => vi.useRealTimers());

describe.each(["mid-flight", "back-test"] as const)("past-dated Term services: %s", (scenario) => {
  it("accepts preview and creation and materializes the entire past-dated calendar", async () => {
    const fixture = createPastDatedTermFixture(scenario);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${fixture.today}T12:00:00Z`));
    const request = fixture.createRequest;
    const slots: any[] = [];
    const db = database({
      course: { findUnique: async () => ({ id: request.courseId, instructorId: "instructor-1" }) },
      instructorInstitution: { findUnique: async () => ({ status: "active" }) },
      courseInstitution: {
        findMany: async () => [{ institutionId: request.institutionId }],
        findUnique: async () => ({ institutionId: request.institutionId }),
      },
      academicCalendar: { findUnique: async () => ({ id: request.academicCalendarId, institutionId: request.institutionId }) },
      academicCalendarEvent: { findMany: async () => [] },
      instructorCalendarOverride: { findMany: async () => [] },
      term: { create: async ({ data }: any) => ({
        id: fixture.termActivities[0]!.termId, ...data, status: "planned", closedAt: null, archivedAt: null,
      }) },
      calendarSlot: { create: async ({ data }: any) => { slots.push(data); return data; } },
    });
    const input = { ...request, instructorId: "instructor-1",
      startDate: new Date(request.startDate), endDate: new Date(request.endDate) };
    const preview = await previewTermCreation(db, input);
    expect(preview.conflicts).toEqual([]);
    expect(preview.calendarSlotCandidates.filter((slot) => slot.slotType === "class_day")).toHaveLength(40);
    expect(slots).toEqual([]);
    const applied = await applyTermCreation(db, input);
    expect(applied.term.startDate).toEqual(input.startDate);
    expect(applied.term.endDate).toEqual(input.endDate);
    expect(applied.term.status).toBe("planned");
    expect(slots.filter((slot) => slot.slotType === "class_day")).toHaveLength(40);
    expect(slots[0].date.toISOString().slice(0, 10)).toBe(request.startDate);
    expect(slots.at(-1).date.toISOString().slice(0, 10)).toBe(request.endDate);
  });

  it("open question: past meetings without recorded coverage remain uncovered with no date-based exemption", async () => {
    const fixture = createPastDatedTermFixture(scenario);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${fixture.today}T12:00:00Z`));
    const topicVersion = { id: "tv-1", topicId: "topic-1", topic: { learningModuleId: null, courseId: fixture.createRequest.courseId } };
    const term = {
      id: fixture.termActivities[0]!.termId, courseId: fixture.createRequest.courseId,
      status: "active", course: { instructorId: "instructor-1" },
      learningModules: [{ learningModuleVersion: { topics: [{ topicVersionId: topicVersion.id, topicVersion }] }, deliveredLearningModuleVersion: null }],
      sessions: fixture.sessions.filter((session) => session.date! < fixture.today).map((session) => ({
        ...session, date: new Date(session.date!), termLearningModule: null, coverages: [],
      })),
      assessments: [], calendarSlots: [],
    };
    expect(term.sessions).toHaveLength(scenario === "mid-flight" ? 19 : 40);
    const impact = await computeTermImpact(database({ term: { findUnique: async () => term } }), "instructor-1", term.id);
    expect(impact.health).toEqual({ totalTopics: 1, fullyCovered: 0, partiallyCovered: 0, uncovered: 1 });
    expect(impact.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "topic_uncovered", topicVersionId: "tv-1", severity: "warning" }),
    ]));
  });
});
