/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPastDatedTermFixture } from "@/lib/redesign-fixtures";
import { buildTermDailyDriver } from "@/lib/redesign-workspace";
import { toTermActivityDto, toTermActivityRevisionDto } from "@/lib/redesign-serializers";
import { applyTermActivityAdoption, previewTermActivityAdoption } from "./term-activity-service";
import { transitionTermLifecycle } from "./lifecycle-service";
import { computeTermImpact } from "./planning-service";
import { applyTermCreation, previewTermCreation } from "./term-service";

function database(tx: Record<string, any>) {
  return { $transaction: async <T>(fn: (tx: Record<string, any>) => Promise<T>) => fn(tx) };
}

afterEach(() => vi.useRealTimers());

describe.each(["mid-flight", "back-test"] as const)("past-dated Term services: %s", (scenario) => {
  it("open question: creation and adoption materialize 40 undated planned meetings with no next meeting", async () => {
    const fixture = createPastDatedTermFixture(scenario);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${fixture.today}T12:00:00Z`));
    const request = fixture.createRequest;
    const slots: any[] = [];
    const activities: any[] = [];
    const revisions: any[] = [];
    let createdTerm: any;
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
      term: {
        create: async ({ data }: any) => (createdTerm = {
          id: fixture.termActivities[0]!.termId, ...data, status: "planned", closedAt: null, archivedAt: null,
          course: { instructorId: "instructor-1" },
        }),
        findUnique: async () => createdTerm,
      },
      activityVersion: { findUnique: async ({ where }: any) => ({
        id: where.id, activityId: where.id, activity: { id: where.id, courseId: request.courseId, course: { instructorId: "instructor-1" } },
        title: where.id, summary: null, activityTypeVersionId: "meeting-type",
        activityTypeVersion: { label: "Lecture", activityType: { instructorId: "instructor-1" } },
        meetingDetail: { modality: "in_person" }, topicActions: [],
      }) },
      courseActivityTypeVersion: { findUnique: async () => ({ courseId: request.courseId }) },
      termActivity: {
        count: async () => activities.length,
        create: async ({ data }: any) => {
          const row = { id: `adopted-${activities.length}`, archivedAt: null, plannedRevisionId: null, deliveredRevisionId: null, ...data };
          activities.push(row); return row;
        },
        update: async ({ where, data }: any) => Object.assign(activities.find((row) => row.id === where.id), data),
        findMany: async () => activities,
      },
      termActivityRevision: {
        create: async ({ data }: any) => {
          const row = { id: `revision-${revisions.length}`, createdAt: new Date(), changeReason: null,
            meetingDetail: null, courseworkDetail: null, assessmentDetail: null, topicActions: [], milestones: [], ...data };
          revisions.push(row); return row;
        },
        findUnique: async ({ where }: any) => revisions.find((row) => row.id === where.id),
      },
      termMeetingActivityRevision: { create: async ({ data }: any) => {
        revisions.find((row) => row.id === data.termActivityRevisionId).meetingDetail = data;
        return data;
      } },
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

    const adoptionInput = {
      instructorId: "instructor-1", termId: applied.term.id,
      learningModuleVersionSelections: [],
      crossCuttingSelections: Array.from({ length: 40 }, (_, index) => ({ activityId: `meeting-${index}`, activityVersionId: `meeting-${index}` })),
    };
    const adoptionPreview = await previewTermActivityAdoption(db, adoptionInput);
    const adopted = await applyTermActivityAdoption(db, { ...adoptionInput,
      previewToken: adoptionPreview.previewToken, expectedCurrentActivityCount: adoptionPreview.expectedCurrentActivityCount,
    });
    expect(adopted.termActivities).toHaveLength(40);
    expect(revisions).toHaveLength(40);
    const revisionsByTermActivityId = Object.fromEntries(adopted.termActivities.map((activity: any) => {
      expect(activity.deliveredRevisionId).toBeNull();
      expect(activity.lifecycleState).toBeNull();
      const planned = toTermActivityRevisionDto(revisions.find((row) => row.id === activity.plannedRevisionId));
      expect(planned.detail).toMatchObject({ startsAt: null, endsAt: null, calendarSlotId: null, status: null });
      return [activity.id, { planned, delivered: null }];
    }));
    const driver = buildTermDailyDriver({ today: fixture.today,
      termActivities: adopted.termActivities.map(toTermActivityDto), revisionsByTermActivityId });
    expect(driver.totalMeetings).toBe(40);
    expect(driver.nextMeeting).toBeNull();
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


it("allows activation of a past-dated planned Term", async () => {
  const fixture = createPastDatedTermFixture("mid-flight");
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${fixture.today}T12:00:00Z`));
  const term = { id: "past-term", status: "planned", course: { instructorId: "instructor-1" },
    startDate: new Date(fixture.createRequest.startDate), endDate: new Date(fixture.createRequest.endDate) };
  const updateMany = vi.fn(async () => ({ count: 1 }));
  const active = await transitionTermLifecycle(database({ term: { findUnique: async () => term, updateMany } }), {
    instructorId: "instructor-1", termId: term.id, transition: "activate", expectedStatus: "planned",
  });
  expect(active.status).toBe("active");
  expect(active.closedAt).toBeNull();
  expect(updateMany).toHaveBeenCalledWith({ where: { id: term.id, status: "planned" }, data: { status: "active", closedAt: null } });
});
