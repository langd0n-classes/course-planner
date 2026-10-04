import { describe, expect, it, vi } from "vitest";
import { loadDemoCourse } from "./demo-course-service";

describe("loadDemoCourse", () => {
  it("loads once for one instructor without changing another instructor's rows", async () => {
    const courses = [
      { id: "other-course", instructorId: "other", demoKey: "generic-demo-v1", title: "Other demo" },
    ];
    const otherBefore = structuredClone(courses[0]);
    let serial = 1;
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
      instructor: {
        update: vi.fn(async () => ({ nextCourseSerial: ++serial })),
      },
    };
    const db = { $transaction: async <T>(fn: (arg: typeof tx) => Promise<T>) => fn(tx) };
    const importer = { apply: vi.fn(async (_db: unknown, _input: { instructorId: string; courseId: string }) => ({})) };

    expect(await loadDemoCourse(db, "owner", importer as never)).toEqual({ courseId: "owner-course", created: true });
    expect(await loadDemoCourse(db, "owner", importer as never)).toEqual({ courseId: "owner-course", created: false });
    expect(courses[0]).toEqual(otherBefore);
    expect(courses).toHaveLength(2);
    expect(tx.course.create).toHaveBeenCalledTimes(1);
    expect(tx.instructor.update).toHaveBeenCalledTimes(1);
    expect(importer.apply).toHaveBeenCalledTimes(1);
    expect(importer.apply.mock.calls[0][1]).toMatchObject({ instructorId: "owner", courseId: "owner-course" });
  });
});
