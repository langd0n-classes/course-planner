import { expect, it, vi } from "vitest";
import { seedDemoEffort } from "./demo-effort";
it("loads three student sizes, two kinds and estimates including a parts total", async () => {
  const sizes = vi.fn();
  const kinds = vi.fn(async () => ({ id: "kind" }));
  const coursework = vi.fn();
  const assessment = vi.fn();
  const parts = vi.fn();
  await seedDemoEffort(
    {
      courseEffortSize: { createMany: sizes },
      courseEffortPartKind: { create: kinds },
      activityVersion: {
        findMany: async () => [
          { id: "cw", courseworkDetail: {} },
          { id: "exam", assessmentDetail: {} },
        ],
      },
      courseworkActivityVersion: { update: coursework },
      assessmentActivityVersion: { update: assessment },
      activityVersionEffortPart: { createMany: parts },
    },
    "c",
  );
  expect(sizes.mock.calls[0][0].data).toMatchObject([
    { label: "Small", scale: "student", minMinutes: 30, maxMinutes: 45 },
    { label: "Medium", minMinutes: 60, maxMinutes: 120 },
    { label: "Large", minMinutes: 180, maxMinutes: 300 },
  ]);
  expect(kinds).toHaveBeenCalledTimes(2);
  expect(coursework.mock.calls[0][0].data).toEqual({
    effortMinMinutes: 60,
    effortMaxMinutes: 120,
  });
  expect(assessment.mock.calls[0][0].data).toEqual({
    effortMinMinutes: 30,
    effortMaxMinutes: 45,
  });
  expect(parts.mock.calls[0][0].data).toHaveLength(2);
});
