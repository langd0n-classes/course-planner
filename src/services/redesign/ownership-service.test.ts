/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { describe, expect, it } from "vitest";
import {
  getOwnedArtifactForInstructor,
  getOwnedCalendarSlotForInstructor,
  getOwnedCoverageForInstructor,
  getOwnedTermForInstructor,
} from "./ownership-service";

describe("redesign ownership helpers", () => {
  it("rejects cross-instructor Terms with a not-found invariant", async () => {
    const tx = {
      term: {
        findUnique: async () => ({
          id: "term-1",
          course: { instructorId: "instructor-2" },
        }),
      },
    };

    await expect(getOwnedTermForInstructor(tx as any, "instructor-1", "term-1")).rejects.toThrow(
      "Term not found",
    );
  });

  it("rejects cross-instructor Coverage through the Session -> Term chain", async () => {
    const tx = {
      coverage: {
        findUnique: async () => ({
          id: "coverage-1",
          session: { term: { course: { instructorId: "instructor-2" } } },
        }),
      },
    };

    await expect(
      getOwnedCoverageForInstructor(tx as any, "instructor-1", "coverage-1"),
    ).rejects.toThrow("Coverage not found");
  });

  it("rejects cross-instructor CalendarSlots through the Term graph", async () => {
    const tx = {
      calendarSlot: {
        findUnique: async () => ({
          id: "slot-1",
          term: { course: { instructorId: "instructor-2" } },
        }),
      },
    };

    await expect(
      getOwnedCalendarSlotForInstructor(tx as any, "instructor-1", "slot-1"),
    ).rejects.toThrow("Calendar slot not found");
  });

  it("rejects cross-instructor Artifacts regardless of parent type", async () => {
    const tx = {
      artifact: {
        findUnique: async () => ({
          id: "artifact-1",
          session: null,
          assessment: null,
          learningModuleVersion: {
            learningModule: { course: { instructorId: "instructor-2" } },
          },
          topicVersion: null,
        }),
      },
    };

    await expect(
      getOwnedArtifactForInstructor(tx as any, "instructor-1", "artifact-1"),
    ).rejects.toThrow("Artifact not found");
  });
});
