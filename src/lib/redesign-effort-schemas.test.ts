import { describe, expect, it } from "vitest";
import {
  activityDetailSchema,
  upsertActivityVersionSchema,
  termActivityRevisionDetailSchema,
  courseEffortSizeSchema,
  courseEffortPartKindSchema,
} from "./redesign-schemas";

describe("effort request validation", () => {
  it.each(["coursework", "assessment"])(
    "requires paired valid effort on %s drafts and revisions",
    (behaviorFamily) => {
      for (const schema of [
        activityDetailSchema,
        termActivityRevisionDetailSchema,
      ]) {
        for (const [low, high] of [
          [0, 1],
          [1, null],
          [null, 1],
          [2, 1],
          [1, 60001],
          [1.5, 2],
        ])
          expect(
            schema.safeParse({
              behaviorFamily,
              effortMinMinutes: low,
              effortMaxMinutes: high,
            }).success,
          ).toBe(false);
        for (const [low, high] of [
          [null, null],
          [1, 1],
          [60000, 60000],
        ])
          expect(
            schema.safeParse({
              behaviorFamily,
              effortMinMinutes: low,
              effortMaxMinutes: high,
            }).success,
          ).toBe(true);
      }
    },
  );
  it("rejects meeting effort and meeting parts", () => {
    expect(
      activityDetailSchema.safeParse({
        behaviorFamily: "meeting",
        effortMinMinutes: 1,
        effortMaxMinutes: 1,
      }).success,
    ).toBe(false);
    expect(
      upsertActivityVersionSchema.safeParse({
        title: "A",
        activityTypeVersionId: "00000000-0000-4000-8000-000000000001",
        detail: { behaviorFamily: "meeting" },
        effortParts: [
          { sequence: 0, label: "Read", minMinutes: 1, maxMinutes: 2 },
        ],
      }).success,
    ).toBe(false);
  });
  it("trims vocabulary labels and rejects empty labels", () => {
    expect(
      courseEffortSizeSchema.parse({
        label: " Small ",
        minMinutes: 30,
        maxMinutes: 45,
      }).label,
    ).toBe("Small");
    expect(courseEffortPartKindSchema.safeParse({ label: "  " }).success).toBe(
      false,
    );
  });
});

it("rejects a total that disagrees with explicitly supplied parts", () => {
  expect(
    upsertActivityVersionSchema.safeParse({
      title: "A",
      activityTypeVersionId: "00000000-0000-4000-8000-000000000001",
      detail: {
        behaviorFamily: "coursework",
        effortMinMinutes: 20,
        effortMaxMinutes: 30,
      },
      effortParts: [
        { sequence: 0, label: "Read", minMinutes: 10, maxMinutes: 15 },
      ],
    }).success,
  ).toBe(false);
});
