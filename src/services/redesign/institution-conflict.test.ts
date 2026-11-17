import { expect, it, vi } from "vitest";
import { createCourse, createInstitution, getOwnedCourse, listInstitutionsForInstructor, replaceCourseInstitutions, updateCourse } from "./course-service";
import { getActivityForInstructor, listActivitiesForCourse } from "./activity-service";
import { getOwnedTermForInstructor } from "./ownership-service";
import type { RedesignDb } from "./types";

function database() {
  const institutions = [{ id: "existing", name: "College", shortName: "Original", canonicalUri: "https://example.test", createdAt: new Date("2020-01-01"), archivedAt: null as Date | null }];
  const memberships = [{ instructorId: "B", institutionId: "existing", status: "active", isDefault: true }];
  const course = { id: "course-B", instructorId: "B", title: "Private course" };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ locked: 1 }]),
    institution: {
      findFirst: vi.fn(async ({ where, orderBy }) => {
        // PostgreSQL ILIKE semantics used by Prisma's insensitive equals filter.
        const pattern = where.name.equals.replace(/\\(.)|([%_])|([.*+?^${}()|[\]\\])/g,
          (_match: string, escaped: string, wildcard: string, special: string) => escaped ? `\\${escaped}` : wildcard === "%" ? ".*" : wildcard === "_" ? "." : `\\${special}`);
        const rows = institutions.filter((row) => new RegExp(`^${pattern}$`, "i").test(row.name));
        if (orderBy?.createdAt === "asc") rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return rows[0] ?? null;
      }),
      create: vi.fn(async ({ data }) => { const row = { id: "new", archivedAt: null, ...data }; institutions.push(row); return row; }),
      findMany: vi.fn(async ({ where }) => institutions.filter((row) => memberships.some((m) => m.institutionId === row.id && m.instructorId === where.instructors.some.instructorId && m.status === "active"))),
    },
    instructorInstitution: {
      count: vi.fn(async ({ where }) => memberships.filter((m) => m.instructorId === where.instructorId && m.status === where.status).length),
      upsert: vi.fn(async ({ where, create, update }) => {
        const key = where.instructorId_institutionId;
        const row = memberships.find((m) => m.instructorId === key.instructorId && m.institutionId === key.institutionId);
        if (row) { Object.assign(row, update); return row; }
        memberships.push(create); return create;
      }),
      findUnique: vi.fn(async ({ where }) => memberships.find((m) => m.instructorId === where.instructorId_institutionId.instructorId && m.institutionId === where.instructorId_institutionId.institutionId) ?? null),
    },
    instructor: { update: vi.fn().mockResolvedValue({ nextCourseSerial: 2 }) },
    course: {
      findUnique: vi.fn(async ({ where }) => where.id_instructorId.instructorId === course.instructorId && where.id_instructorId.id === course.id ? course : null),
      create: vi.fn(async ({ data }) => ({ id: "course-A", ...data })),
      update: vi.fn(),
    },
    courseInstitution: { create: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    activity: { findUnique: vi.fn().mockResolvedValue({ id: "activity-B", course }), findMany: vi.fn() },
    term: { findUnique: vi.fn().mockResolvedValue({ id: "term-B", course }) },
  };
  const db = { $transaction: async <T>(fn: (transaction: typeof tx) => Promise<T>) => fn(tx) } as unknown as RedesignDb;
  return { db, tx, institutions, memberships, course };
}

it("joins an existing name after trimming and ignoring case, preserving institution fields", async () => {
  const { db, tx, memberships, institutions } = database();
  const before = { ...institutions[0] };
  expect(await createInstitution(db, { instructorId: "A", name: "  cOLLege  ", shortName: "Changed", canonicalUri: "https://changed.test" })).toEqual({ ...before, created: false });
  expect(tx.institution.create).not.toHaveBeenCalled();
  expect(institutions).toEqual([before]);
  expect(memberships).toContainEqual({ instructorId: "A", institutionId: "existing", status: "active", isDefault: true });
});

it.each(["active", "inactive"])("activates an existing %s membership without changing its default", async (status) => {
  const { db, memberships } = database();
  memberships.push({ instructorId: "A", institutionId: "existing", status, isDefault: false });
  const before = structuredClone(memberships);
  await createInstitution(db, { instructorId: "A", name: "College" });
  expect(memberships).toEqual(before.map((membership) => membership.instructorId === "A" ? { ...membership, status: "active" } : membership));
});

it("creates a trimmed new institution and permits multiple memberships without changing the default", async () => {
  const { db, memberships } = database();
  await createInstitution(db, { instructorId: "A", name: "College" });
  const result = await createInstitution(db, { instructorId: "A", name: "  Second   College  ", shortName: "SC" });
  expect(result).toMatchObject({ name: "Second College", shortName: "SC", created: true });
  expect(memberships.filter((m) => m.instructorId === "A")).toEqual([
    { instructorId: "A", institutionId: "existing", status: "active", isDefault: true },
    { instructorId: "A", institutionId: "new", status: "active", isDefault: false },
  ]);
  expect((await listInstitutionsForInstructor(db, "A")).map((i) => i.id)).toEqual(["existing", "new"]);
});

it("rejects archived names without adding membership or creating a row", async () => {
  const { db, tx, institutions } = database();
  institutions[0].archivedAt = new Date();
  await expect(createInstitution(db, { instructorId: "A", name: " college " })).rejects.toThrow("An institution with this name is archived.");
  expect(tx.instructorInstitution.upsert).not.toHaveBeenCalled();
  expect(tx.institution.create).not.toHaveBeenCalled();
});

it("preserves unexpected institution and membership database errors", async () => {
  const { db, tx } = database();
  const error = { code: "P1001" };
  tx.institution.create.mockRejectedValueOnce(error);
  await expect(createInstitution(db, { instructorId: "A", name: "New" })).rejects.toBe(error);
  const membershipError = { code: "P2002" };
  tx.instructorInstitution.upsert.mockRejectedValueOnce(membershipError);
  await expect(createInstitution(db, { instructorId: "A", name: "College" })).rejects.toBe(membershipError);
});

it("allows a Course to attach to either of its instructor's institutions", async () => {
  const { db, tx, course } = database();
  await createInstitution(db, { instructorId: "A", name: "College" });
  await createInstitution(db, { instructorId: "A", name: "Second College" });
  await createCourse(db, { instructorId: "A", title: "Course", number: "101", institutionIds: ["existing", "new"] });
  expect(tx.courseInstitution.create).toHaveBeenCalledTimes(2);
  course.instructorId = "A";
  await replaceCourseInstitutions(db, { instructorId: "A", courseId: course.id, institutionIds: ["new", "existing"] });
  expect(tx.courseInstitution.createMany).toHaveBeenCalledWith({ data: [
    { courseId: course.id, institutionId: "new" }, { courseId: course.id, institutionId: "existing" },
  ] });
  await expect(createCourse(db, { instructorId: "A", title: "Course", number: "101", institutionIds: ["unaffiliated"] })).rejects.toThrow("Institution must be valid");
});

it("shared institution membership gives A no read or change access to B's Course or Term", async () => {
  const { db, tx, course } = database();
  await createInstitution(db, { instructorId: "A", name: "College" });
  await expect(getOwnedCourse(db, "A", course.id)).rejects.toThrow("Course not found");
  await expect(updateCourse(db, "A", course.id, { title: "Changed" })).rejects.toThrow("Course not found");
  await expect(replaceCourseInstitutions(db, { instructorId: "A", courseId: course.id, institutionIds: ["existing"] })).rejects.toThrow("Course not found");
  await expect(getOwnedTermForInstructor(tx, "A", "term-B")).rejects.toThrow("Term not found");
  await expect(listActivitiesForCourse(db, "A", course.id)).rejects.toThrow("Course not found");
  await expect(getActivityForInstructor(db, "A", "activity-B")).rejects.toThrow("Activity not found");
  expect(tx.activity.findMany).not.toHaveBeenCalled();
  expect(tx.course.update).not.toHaveBeenCalled();
  expect(tx.courseInstitution.deleteMany).not.toHaveBeenCalled();
  expect(course.title).toBe("Private course");
});

it("joins the oldest matching institution after collapsing interior spaces", async () => {
  const { db, institutions } = database();
  institutions[0].name = "Example College";
  institutions.unshift({ ...institutions[0], id: "newer", name: "EXAMPLE COLLEGE", createdAt: new Date("2025-01-01") });
  const result = await createInstitution(db, { instructorId: "A", name: "  example   college  " });
  expect(result).toMatchObject({ id: "existing", created: false });
});

it.each(["_", "%", "\\"])("matches %s literally in institution names", async (character) => {
  const { db, institutions } = database();
  institutions[0].name = "ExampleXCollege";
  const name = `Example${character}College`;
  const created = await createInstitution(db, { instructorId: "A", name });
  expect(created).toMatchObject({ name, created: true });
  const joined = await createInstitution(db, { instructorId: "A", name: name.toLowerCase() });
  expect(joined).toMatchObject({ id: created.id, name, created: false });
});
