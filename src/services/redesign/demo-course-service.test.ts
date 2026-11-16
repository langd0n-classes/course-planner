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

import { demoSemesters, loadDemoCourse } from "./demo-course-service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAcademicCalendarVersion.mockResolvedValue({ version: { id: "version-1" } });
  mocks.previewTermCalendar.mockResolvedValue({ previewToken: "calendar-token", expectedCurrentCalendarSlotCount: 0, conflicts: [] });
  mocks.applyTermCalendar.mockResolvedValue({ kind: "applied" });
  mocks.adoptLearningModuleForTerm.mockResolvedValue({ id: "offering-1" });
  mocks.previewTermActivityAdoption.mockResolvedValue({ previewToken: "activity-token", expectedCurrentActivityCount: 0 });
  mocks.applyTermActivityAdoption.mockResolvedValue({ kind: "applied" });
});

const iso = (date: Date) => date.toISOString().slice(0, 10);

describe("demoSemesters", () => {
  it.each([
    ["2026-01-01", "Spring 2026", false, "Fall 2026"],
    ["2026-03-01", "Spring 2026", true, "Fall 2026"],
    ["2026-05-06", "Fall 2026", false, "Spring 2027"],
    ["2026-10-04", "Fall 2026", true, "Spring 2027"],
    ["2026-12-16", "Spring 2027", false, "Fall 2027"],
  ])("selects the current or next semester and the one after it on %s", (date, name, inProgress, nextName) => {
    const [current, next] = demoSemesters(new Date(date + "T12:00:00Z"));
    expect(current).toMatchObject({ name, inProgress });
    expect(next).toMatchObject({ name: nextName, inProgress: false });
  });

  it("computes semester dates from weekday rules", () => {
    const [fall, spring] = demoSemesters(new Date("2026-11-16T12:00:00Z"));
    expect(fall).toMatchObject({ code: "FA26", academicYear: "2026-2027", inProgress: true });
    expect([iso(fall.startDate), iso(fall.endDate)]).toEqual(["2026-09-02", "2026-12-11"]);
    expect(spring).toMatchObject({ code: "SP27", academicYear: "2026-2027", inProgress: false });
    expect([iso(spring.startDate), iso(spring.endDate)]).toEqual(["2027-01-19", "2027-04-30"]);
  });

  it("starts each Fall on a Wednesday and each Spring on a Tuesday, and ends on a Friday", () => {
    for (let year = 2026; year <= 2040; year += 1) {
      const [spring, fall] = demoSemesters(new Date(Date.UTC(year, 0, 1)));
      expect([spring.name, spring.startDate.getUTCDay(), spring.endDate.getUTCDay()]).toEqual([`Spring ${year}`, 2, 5]);
      expect([fall.name, fall.startDate.getUTCDay(), fall.endDate.getUTCDay()]).toEqual([`Fall ${year}`, 3, 5]);
      expect(spring.startDate.getUTCDate()).toBeGreaterThanOrEqual(16);
      expect(spring.startDate.getUTCDate()).toBeLessThanOrEqual(22);
      expect(fall.startDate.getUTCMonth()).toBe(8);
      expect(fall.startDate.getUTCDate()).toBeLessThanOrEqual(7);
    }
  });

  it("keeps a semester current from its first day through its last day", () => {
    expect(demoSemesters(new Date("2026-09-01T23:59:00Z"))[0]).toMatchObject({ name: "Fall 2026", inProgress: false });
    expect(demoSemesters(new Date("2026-09-02T00:00:00Z"))[0]).toMatchObject({ name: "Fall 2026", inProgress: true });
    expect(demoSemesters(new Date("2026-12-11T23:59:00Z"))[0]).toMatchObject({ name: "Fall 2026", inProgress: true });
    expect(demoSemesters(new Date("2026-12-12T00:00:00Z"))[0]).toMatchObject({ name: "Spring 2027", inProgress: false });
  });
});

describe("loadDemoCourse", () => {
  type TermRow = { id: string; courseId: string; code: string; name: string };
  type CalendarRow = { id: string; institutionId: string; academicYear: string; name: string };

  function fixture() {
    const courses = [{ id: "other-course", instructorId: "other", demoKey: "generic-demo-v1", title: "Other demo" }];
    const otherBefore = structuredClone(courses[0]);
    const terms: TermRow[] = [];
    const calendars: CalendarRow[] = [];
    const courseInstitutions: Array<{ courseId: string; institutionId: string; institution: { name: string } }> = [];
    const modules: Array<{ id: string; currentVersionId: string | null }> = [{ id: "module-1", currentVersionId: "module-version-1" }];
    mocks.createInstitution.mockImplementation(async (_db: unknown, input: { name: string }) => ({ id: "institution-1", name: input.name }));
    mocks.createAcademicCalendar.mockImplementation(async (_db: unknown, input: { institutionId: string; academicYear: string; name: string }) => {
      const calendar = { id: `calendar-${input.academicYear}`, institutionId: input.institutionId, academicYear: input.academicYear, name: input.name };
      calendars.push(calendar);
      return calendar;
    });
    mocks.createTerm.mockImplementation(async (_db: unknown, input: { courseId: string; code: string; name: string }) => {
      const term = { id: `term-${input.code}`, courseId: input.courseId, code: input.code, name: input.name };
      terms.push(term);
      return term;
    });
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
      courseInstitution: {
        create: vi.fn(async ({ data }: { data: { courseId: string; institutionId: string } }) => {
          courseInstitutions.push({ ...data, institution: { name: "Demo Institution (owner)" } });
          return {};
        }),
        findFirst: vi.fn(async ({ where }: { where: { courseId: string; institution: { name: string } } }) =>
          courseInstitutions.find((row) => row.courseId === where.courseId && row.institution.name === where.institution.name) ?? null),
      },
      term: {
        findUnique: vi.fn(async ({ where }: { where: { courseId_code: { courseId: string; code: string } } }) =>
          terms.find((term) => term.courseId === where.courseId_code.courseId && term.code === where.courseId_code.code) ?? null),
        update: vi.fn<(args: { where: { id: string }; data: { status?: string; academicCalendarVersionId?: string } }) => Promise<object>>(async () => ({})),
      },
      academicCalendar: {
        findFirst: vi.fn(async ({ where }: { where: { institutionId: string; academicYear: string } }) =>
          calendars.find((calendar) => calendar.institutionId === where.institutionId && calendar.academicYear === where.academicYear) ?? null),
      },
      academicCalendarVersion: { findFirst: vi.fn(async () => ({ id: "version-existing" })) },
      courseActivityTypeVersion: { findFirst: vi.fn(async () => ({ activityTypeVersionId: "type-1" })) },
      learningModule: { findMany: vi.fn(async () => modules) },
    };
    const db = { $transaction: async <T>(fn: (arg: typeof tx) => Promise<T>) => fn(tx) };
    const importer = { apply: vi.fn(async (): Promise<{ ambiguities: Array<{ path: string }> }> => ({ ambiguities: [] })) };
    return { courses, otherBefore, terms, calendars, courseInstitutions, modules, tx, db, importer };
  }

  /** An Instructor who loaded the demo earlier and holds only the Terms in `codes`. */
  function existingDemo(codes: string[]) {
    const state = fixture();
    state.courses.push({ id: "owner-course", instructorId: "owner", demoKey: "generic-demo-v1", title: "Demo" });
    state.courseInstitutions.push({ courseId: "owner-course", institutionId: "institution-1", institution: { name: "Demo Institution (owner)" } });
    for (const code of codes) state.terms.push({ id: `term-${code}`, courseId: "owner-course", code, name: code });
    return state;
  }

  it("loads the current and next Term once without changing another instructor's rows", async () => {
    const { courses, otherBefore, tx, db, importer } = fixture();
    expect(await loadDemoCourse(db, "owner", importer as never, new Date("2026-10-04"))).toEqual({ courseId: "owner-course", created: true });
    expect(await loadDemoCourse(db, "owner", importer as never, new Date("2026-10-04"))).toEqual({ courseId: "owner-course", created: false });
    expect(courses[0]).toEqual(otherBefore);
    expect(tx.course.create).toHaveBeenCalledTimes(1);
    expect(mocks.createInstitution).toHaveBeenCalledTimes(1);
    expect(mocks.createTerm.mock.calls.map((call) => call[1])).toMatchObject([
      { name: "Fall 2026", code: "FA26", startDate: new Date("2026-09-02"), endDate: new Date("2026-12-11") },
      { name: "Spring 2027", code: "SP27", startDate: new Date("2027-01-19"), endDate: new Date("2027-04-30") },
    ]);
    expect(tx.term.update.mock.calls.map((call) => call[0])).toMatchObject([
      { where: { id: "term-FA26" }, data: { status: "active" } },
      { where: { id: "term-SP27" }, data: { status: "planned" } },
    ]);
    expect(mocks.applyTermCalendar).toHaveBeenCalledTimes(2);
    expect(importer.apply).toHaveBeenCalledTimes(1);
  });

  it("puts both Terms of one academic year on one Academic Calendar", async () => {
    const { db, importer } = fixture();
    await loadDemoCourse(db, "owner", importer as never, new Date("2026-10-04"));
    expect(mocks.createAcademicCalendar).toHaveBeenCalledTimes(1);
    expect(mocks.createAcademicCalendar.mock.calls[0][1]).toMatchObject({ academicYear: "2026-2027", name: "Demo Calendar 2026-2027" });
    expect(mocks.createAcademicCalendarVersion).toHaveBeenCalledTimes(1);
    expect(mocks.createTerm.mock.calls.map((call) => call[1].academicCalendarId)).toEqual(["calendar-2026-2027", "calendar-2026-2027"]);
  });

  it("creates one Academic Calendar per academic year when the Terms span two", async () => {
    const { db, importer } = fixture();
    await loadDemoCourse(db, "owner", importer as never, new Date("2027-02-01"));
    expect(mocks.createTerm.mock.calls.map((call) => [call[1].code, call[1].academicCalendarId])).toEqual([
      ["SP27", "calendar-2026-2027"],
      ["FA27", "calendar-2027-2028"],
    ]);
  });

  it("adopts Learning Modules and Activities into the current Term only", async () => {
    const { db, importer } = fixture();
    await loadDemoCourse(db, "owner", importer as never, new Date("2026-10-04"));
    expect(mocks.adoptLearningModuleForTerm.mock.calls.map((call) => call[1].termId)).toEqual(["term-FA26"]);
    expect(mocks.applyTermActivityAdoption).toHaveBeenCalledTimes(1);
    expect(mocks.applyTermActivityAdoption.mock.calls[0][1]).toMatchObject({ termId: "term-FA26" });
  });

  it("adds only the missing next Term to a demo Course that has the current Term", async () => {
    const { db, importer, tx } = existingDemo(["FA26"]);
    expect(await loadDemoCourse(db, "owner", importer as never, new Date("2026-11-16"))).toEqual({ courseId: "owner-course", created: false });
    expect(mocks.createTerm.mock.calls.map((call) => call[1].code)).toEqual(["SP27"]);
    expect(tx.course.create).not.toHaveBeenCalled();
    expect(importer.apply).not.toHaveBeenCalled();
    expect(mocks.createInstitution).not.toHaveBeenCalled();
    expect(mocks.applyTermActivityAdoption).not.toHaveBeenCalled();
  });

  it("reuses an existing Academic Calendar and its newest version for an added Term", async () => {
    const { db, importer, calendars, tx } = existingDemo(["FA26"]);
    calendars.push({ id: "calendar-old", institutionId: "institution-1", academicYear: "2026-2027", name: "Fall 2026 Demo Calendar" });
    await loadDemoCourse(db, "owner", importer as never, new Date("2026-11-16"));
    expect(mocks.createAcademicCalendar).not.toHaveBeenCalled();
    expect(mocks.createAcademicCalendarVersion).not.toHaveBeenCalled();
    expect(mocks.createTerm.mock.calls[0][1]).toMatchObject({ code: "SP27", academicCalendarId: "calendar-old" });
    expect(tx.term.update.mock.calls[0][0]).toMatchObject({ data: { academicCalendarVersionId: "version-existing" } });
  });

  it("adds a populated current Term and the next Term to a demo Course that holds only a past Term", async () => {
    const { db, importer, modules } = existingDemo(["SP26"]);
    modules.push({ id: "draft-only-module", currentVersionId: null });
    expect(await loadDemoCourse(db, "owner", importer as never, new Date("2026-11-16"))).toEqual({ courseId: "owner-course", created: false });
    expect(mocks.createTerm.mock.calls.map((call) => call[1].code)).toEqual(["FA26", "SP27"]);
    expect(mocks.adoptLearningModuleForTerm.mock.calls.map((call) => [call[1].termId, call[1].learningModuleId])).toEqual([["term-FA26", "module-1"]]);
    expect(mocks.applyTermActivityAdoption).toHaveBeenCalledTimes(1);
  });

  it("leaves an existing demo Course unchanged when its demo Institution link is gone", async () => {
    const { db, importer, courseInstitutions } = existingDemo(["SP26"]);
    courseInstitutions.length = 0;
    expect(await loadDemoCourse(db, "owner", importer as never, new Date("2026-11-16"))).toEqual({ courseId: "owner-course", created: false });
    expect(mocks.createTerm).not.toHaveBeenCalled();
  });

  it("fails before Term creation when the importer reports ambiguities", async () => {
    const { db, importer } = fixture();
    importer.apply.mockResolvedValueOnce({ ambiguities: [{ path: "activities[0]" }] });
    await expect(loadDemoCourse(db, "owner", importer as never)).rejects.toThrow("ambiguities");
    expect(mocks.createInstitution).not.toHaveBeenCalled();
    expect(mocks.createTerm).not.toHaveBeenCalled();
  });

  it("rejects a new demo Course whose Learning Module has no current version", async () => {
    const { db, importer, modules } = fixture();
    modules.push({ id: "draft-only-module", currentVersionId: null });
    await expect(loadDemoCourse(db, "owner", importer as never, new Date("2026-10-04"))).rejects.toThrow("no current version");
  });
});
