import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createInstitution: vi.fn(), createAcademicCalendar: vi.fn(), createAcademicCalendarVersion: vi.fn(),
  createTerm: vi.fn(), previewTermCalendar: vi.fn(), applyTermCalendar: vi.fn(),
  adoptLearningModuleForTerm: vi.fn(), previewTermActivityAdoption: vi.fn(), applyTermActivityAdoption: vi.fn(),
}));
vi.mock("./course-service", () => ({ createInstitution: mocks.createInstitution, createAcademicCalendar: mocks.createAcademicCalendar }));
vi.mock("./academic-calendar-service", () => ({ createAcademicCalendarVersion: mocks.createAcademicCalendarVersion, previewTermCalendar: mocks.previewTermCalendar, applyTermCalendar: mocks.applyTermCalendar }));
vi.mock("./term-service", () => ({ createTerm: mocks.createTerm }));
vi.mock("./offering-service", () => ({ adoptLearningModuleForTerm: mocks.adoptLearningModuleForTerm }));
vi.mock("./term-activity-service", () => ({ previewTermActivityAdoption: mocks.previewTermActivityAdoption, applyTermActivityAdoption: mocks.applyTermActivityAdoption }));

import { demoSemester, loadDemoCourse } from "./demo-course-service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createInstitution.mockResolvedValue({ id: "institution-1" });
  mocks.createAcademicCalendar.mockResolvedValue({ id: "calendar-1", name: "Demo Calendar" });
  mocks.createAcademicCalendarVersion.mockResolvedValue({ version: { id: "version-1" } });
  mocks.createTerm.mockResolvedValue({ id: "term-1" });
  mocks.previewTermCalendar.mockResolvedValue({ previewToken: "calendar-token", expectedCurrentCalendarSlotCount: 0, conflicts: [] });
  mocks.applyTermCalendar.mockResolvedValue({ kind: "applied" });
  mocks.adoptLearningModuleForTerm.mockResolvedValue({ id: "offering-1" });
  mocks.previewTermActivityAdoption.mockResolvedValue({ previewToken: "activity-token", expectedCurrentActivityCount: 0 });
  mocks.applyTermActivityAdoption.mockResolvedValue({ kind: "applied" });
});

describe("demoSemester", () => {
  it.each([
    ["2026-01-01", "Spring 2026", false],
    ["2026-03-01", "Spring 2026", true],
    ["2026-05-06", "Fall 2026", false],
    ["2026-10-04", "Fall 2026", true],
    ["2026-12-16", "Spring 2027", false],
  ])("selects the current or next semester on %s", (date, name, inProgress) => {
    expect(demoSemester(new Date(date + "T12:00:00Z"))).toMatchObject({ name, inProgress });
  });
});

describe("loadDemoCourse", () => {
  function fixture() {
    const courses = [{ id: "other-course", instructorId: "other", demoKey: "generic-demo-v1", title: "Other demo" }];
    const otherBefore = structuredClone(courses[0]);
    const tx = {
      $queryRaw: vi.fn(async () => [{ id: "owner" }]),
      course: {
        findUnique: vi.fn(async ({ where }: { where: { instructorId_demoKey: { instructorId: string; demoKey: string } } }) =>
          courses.find((course) => course.instructorId === where.instructorId_demoKey.instructorId && course.demoKey === where.instructorId_demoKey.demoKey) ?? null),
        create: vi.fn(async ({ data }: { data: { instructorId: string; demoKey: string; title: string } }) => {
          const course = { id: "owner-course", ...data };
          courses.push(course);
          return course;
        }),
      },
      instructor: { update: vi.fn(async () => ({ nextCourseSerial: 2 })) },
      courseInstitution: { create: vi.fn(async () => ({})) },
      term: { update: vi.fn(async () => ({})) },
      courseActivityTypeVersion: { findFirst: vi.fn(async () => ({ activityTypeVersionId: "type-1" })) },
      learningModule: { findMany: vi.fn(async () => [{ id: "module-1", currentVersionId: "module-version-1" }]) },
    };
    const db = { $transaction: async <T>(fn: (arg: typeof tx) => Promise<T>) => fn(tx) };
    const importer = { apply: vi.fn(async (): Promise<{ ambiguities: Array<{ path: string }> }> => ({ ambiguities: [] })) };
    return { courses, otherBefore, tx, db, importer };
  }

  it("loads the Term once without changing another instructor's rows", async () => {
    const { courses, otherBefore, tx, db, importer } = fixture();
    expect(await loadDemoCourse(db, "owner", importer as never, new Date("2026-10-04"))).toEqual({ courseId: "owner-course", created: true });
    expect(await loadDemoCourse(db, "owner", importer as never, new Date("2026-10-04"))).toEqual({ courseId: "owner-course", created: false });
    expect(courses[0]).toEqual(otherBefore);
    expect(tx.course.create).toHaveBeenCalledTimes(1);
    expect(mocks.createTerm).toHaveBeenCalledTimes(1);
    expect(mocks.createTerm.mock.calls[0][1]).toMatchObject({ name: "Fall 2026", code: "FA26" });
    expect(mocks.applyTermCalendar).toHaveBeenCalledTimes(1);
    expect(mocks.applyTermActivityAdoption).toHaveBeenCalledTimes(1);
    expect(importer.apply).toHaveBeenCalledTimes(1);
  });

  it("fails before Term creation when the importer reports ambiguities", async () => {
    const { db, importer } = fixture();
    importer.apply.mockResolvedValueOnce({ ambiguities: [{ path: "activities[0]" }] });
    await expect(loadDemoCourse(db, "owner", importer as never)).rejects.toThrow("ambiguities");
    expect(mocks.createInstitution).not.toHaveBeenCalled();
    expect(mocks.createTerm).not.toHaveBeenCalled();
  });
});
