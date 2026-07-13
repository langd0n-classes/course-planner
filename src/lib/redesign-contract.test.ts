import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  CANONICAL_ROUTES,
  type AssessmentType,
  type CalendarSlotCandidateDto,
  type CalendarSlotDto,
  type CreateTermRequest,
  type CanonicalRoute,
  type CapacitySource,
  type InstructionalCapacity,
  type InstructionalMode,
  type MeetingPatternDto,
  type SessionDto,
  type TermDto,
  type TermLifecycleTransition,
  type TermStatus,
  type UpdateLearningModuleRequest,
  type UpdateTopicRequest,
  type UpdateTermLearningModuleRequest,
} from "./redesign-contract";

// ─── Compile-time shape checks for the Phase A.1 additions ─────────────────
// These exist to fail a typecheck (not necessarily this test run) if the
// new enums/DTO fields regress. They also assert at runtime that the sample
// values are structurally valid so the file isn't silently dead code.

const sampleTermStatuses: TermStatus[] = ["planned", "active", "closed"];
const sampleLifecycleTransitions: TermLifecycleTransition[] = ["activate", "close", "reopen"];
const sampleCapacities: InstructionalCapacity[] = [
  "normal",
  "reduced_engagement",
  "recovery",
  "assessment_period",
];
const sampleCapacitySources: CapacitySource[] = ["baseline", "heuristic", "instructor_override"];
const sampleInstructionalModes: InstructionalMode[] = [
  "standard",
  "recovery",
  "review",
  "buffer",
  "assessment",
  "other",
];
const sampleMeetingPattern: MeetingPatternDto = {
  roles: [
    {
      roleKey: "lecture",
      label: "Lecture",
      sessionType: "lecture",
      days: ["tuesday", "thursday"],
    },
  ],
};

const sampleTerm: TermDto = {
  id: "term-1",
  courseId: "course-1",
  institutionId: "institution-1",
  academicCalendarId: "calendar-1",
  code: "S26",
  name: "Spring 2026",
  startDate: "2026-01-20",
  endDate: "2026-05-08",
  meetingPattern: null,
  status: "active",
  closedAt: null,
  clonedFromId: null,
  archivedAt: null,
};

const sampleCalendarSlot: CalendarSlotDto = {
  id: "slot-1",
  termId: "term-1",
  academicCalendarEventId: null,
  date: "2026-02-12",
  slotType: "class_day",
  label: "Pre-holiday class",
  source: "seed",
  instructionalCapacity: "reduced_engagement",
  capacitySource: "heuristic",
  capacityReason: "Long weekend reduces attendance.",
};

const sampleCalendarSlotCandidate: CalendarSlotCandidateDto = {
  date: "2027-03-12",
  slotType: "class_day",
  label: "Lecture class day",
  source: "meeting_roles:lecture",
  academicCalendarEventId: null,
  meetingRoleKeys: ["lecture"],
  meetingRoleLabels: ["Lecture"],
  instructionalCapacity: "reduced_engagement",
  capacitySource: "heuristic",
  capacityReason: "Last class day before explicit break starting 2027-03-15.",
  provenance: [],
};

const sampleSession: SessionDto = {
  id: "session-1",
  termId: "term-1",
  termLearningModuleId: null,
  calendarSlotId: "slot-1",
  sequence: 1,
  sessionType: "lecture",
  code: "lec-01",
  title: "Probability Foundations",
  date: "2026-01-20",
  scheduleOverrideLabel: null,
  description: null,
  format: null,
  notes: null,
  status: "scheduled",
  instructionalMode: "recovery",
  canceledAt: null,
  canceledReason: null,
  archivedAt: null,
};

// AssessmentType is generic app data, not schema vocabulary: GAIE is valid
// data, not a required literal.
const sampleAssessmentType: AssessmentType = "gaie";
const sampleGenericAssessmentType: AssessmentType = "final-project-milestone-2";

// The delivered pointer must NOT be directly client-settable.
const sampleUpdateTermLearningModule: UpdateTermLearningModuleRequest = {
  sequence: 2,
  notes: "reordering",
};
const sampleUpdateLearningModule: UpdateLearningModuleRequest = {
  stableCode: "PROB",
  archivedAt: null,
};
const sampleUpdateTopic: UpdateTopicRequest = {
  stableCode: "PROB1",
  learningModuleId: null,
  archivedAt: null,
};

const sampleCreateTermRequest: CreateTermRequest = {
  mode: "preview",
  courseId: "course-1",
  institutionId: "institution-1",
  academicCalendarId: "calendar-1",
  code: "S26",
  name: "Spring 2026",
  startDate: "2026-01-20",
  endDate: "2026-05-08",
  meetingPattern: sampleMeetingPattern,
};
const _rejectsDirectDeliveredPointerMutation: UpdateTermLearningModuleRequest = {
  // @ts-expect-error deliveredLearningModuleVersionId is service-owned, not a plain field
  deliveredLearningModuleVersionId: "some-version-id",
};
void _rejectsDirectDeliveredPointerMutation;

describe("redesign-contract Phase A.1 additions", () => {
  it("exposes the new enums with their documented members", () => {
    expect(sampleTermStatuses).toEqual(["planned", "active", "closed"]);
    expect(sampleLifecycleTransitions).toEqual(["activate", "close", "reopen"]);
    expect(sampleCapacities).toEqual([
      "normal",
      "reduced_engagement",
      "recovery",
      "assessment_period",
    ]);
    expect(sampleCapacitySources).toEqual(["baseline", "heuristic", "instructor_override"]);
    expect(sampleInstructionalModes).toEqual([
      "standard",
      "recovery",
      "review",
      "buffer",
      "assessment",
      "other",
    ]);
  });

  it("round-trips sample DTOs with the new fields", () => {
    expect(sampleTerm.status).toBe("active");
    expect(sampleCalendarSlot.instructionalCapacity).toBe("reduced_engagement");
    expect(sampleCalendarSlotCandidate.capacitySource).toBe("heuristic");
    expect(sampleSession.instructionalMode).toBe("recovery");
    expect(sampleSession.calendarSlotId).toBe("slot-1");
    expect(sampleAssessmentType).toBe("gaie");
    expect(sampleGenericAssessmentType).toBe("final-project-milestone-2");
    expect(sampleCreateTermRequest.meetingPattern.roles[0]?.roleKey).toBe("lecture");
    expect(sampleUpdateTermLearningModule).not.toHaveProperty("deliveredLearningModuleVersionId");
    expect(sampleUpdateLearningModule.archivedAt).toBeNull();
    expect(sampleUpdateTopic.learningModuleId).toBeNull();
  });
});

// ─── Every notImplemented() call in src/app/api must use a real CanonicalRoute ───

function findRouteFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(full));
    } else if (entry.name === "route.ts") {
      files.push(full);
    }
  }
  return files;
}

describe("canonical stub wiring", () => {
  const apiDir = path.join(process.cwd(), "src", "app", "api");
  const routeFiles = findRouteFiles(apiDir);
  const canonicalSet = new Set<string>(CANONICAL_ROUTES);

  it("finds route files to check", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it("only calls notImplemented() with a literal that is in CANONICAL_ROUTES", () => {
    const badCalls: string[] = [];
    for (const file of routeFiles) {
      const content = fs.readFileSync(file, "utf8");
      const matches = content.matchAll(/notImplemented\(\s*"([^"]+)"\s*\)/g);
      for (const match of matches) {
        const route = match[1];
        if (!canonicalSet.has(route)) {
          badCalls.push(`${file}: notImplemented("${route}")`);
        }
      }
    }
    expect(badCalls).toEqual([]);
  });

  it("never calls retired() on a path that is in CANONICAL_ROUTES", () => {
    // Retired (410) routes are, by definition, not part of the frozen
    // contract; a canonical path should get a typed 501 stub instead.
    for (const file of routeFiles) {
      const content = fs.readFileSync(file, "utf8");
      if (!content.includes("retired(")) continue;
      const routeFromPath = routePathFromFile(apiDir, file);
      expect(canonicalSet.has(routeFromPath)).toBe(false);
    }
  });
});

function routePathFromFile(apiDir: string, file: string): CanonicalRoute {
  const rel = path.relative(apiDir, path.dirname(file)).split(path.sep).join("/");
  return `/api/${rel}` as CanonicalRoute;
}
