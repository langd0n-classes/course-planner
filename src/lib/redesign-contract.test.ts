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
  type ActivityBehaviorFamily,
  type MilestoneRole,
  type AcademicCalendarPeriodKind,
  type TermMilestoneAnchorPolicy,
  type TermCalendarExceptionAction,
  type ArtifactParentType,
  type ActivityDetailDto,
  type MeetingActivityDetailDto,
  type CourseworkActivityDetailDto,
  type AssessmentActivityDetailDto,
  type ActivityVersionDto,
  type TermActivityRevisionDetailDto,
  type MeetingRevisionDetailDto,
  type CourseworkRevisionDetailDto,
  type AssessmentRevisionDetailDto,
  type TermActivityRevisionDto,
  type LearningModuleVersionDto,
  type UpsertLearningModuleVersionRequest,
  type ArtifactDto,
  type CreateArtifactRequest,
  type TermAdoptionPreviewResponse,
  type TermAdoptionApplyRequest,
  type TermActivityRevisionPreviewResponse,
  type TermActivityRevisionApplyRequest,
  type PromoteDeliveryPreviewResponse,
  type PromoteDeliveryApplyRequest,
  type TermCalendarPreviewResponse,
  type TermCalendarApplyRequest,
  type ActivityVersionTopicActionWithSiblingsDto,
  type PreviewImpactDto,
  type CreateAcademicCalendarVersionRequest,
  type GetAcademicCalendarVersionResponse,
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
  academicCalendarVersionId: null,
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

// ─── B.2R Activity/Term contract additions (B.3.1b) ────────────────────────

const sampleBehaviorFamilies: ActivityBehaviorFamily[] = ["meeting", "coursework", "assessment"];
const sampleMilestoneRoles: MilestoneRole[] = ["release", "work", "phase_release", "review", "due"];
const sampleCalendarPeriodKinds: AcademicCalendarPeriodKind[] = [
  "instructional",
  "no_instruction",
  "special_schedule",
];
const sampleAnchorPolicies: TermMilestoneAnchorPolicy[] = [
  "follow_activity",
  "fixed_instant",
  "standalone",
];
const sampleCalendarExceptionActions: TermCalendarExceptionAction[] = [
  "cancel",
  "add",
  "replace",
  "modify",
];
const sampleArtifactParentTypes: ArtifactParentType[] = [
  "learning_module_version",
  "topic_version",
  "session",
  "assessment",
  "activity_version",
  "term_activity_revision",
];

// Three detail-family discriminants for ActivityDetailDto.
const meetingDetail = {
  behaviorFamily: "meeting",
  defaultDurationMinutes: 75,
  modality: "in_person",
  preparationNotes: null,
  authoringNotes: null,
} satisfies MeetingActivityDetailDto;
const courseworkDetail = {
  behaviorFamily: "coursework",
  submissionPolicy: "individual",
  releasePolicy: "on_publish",
  authoringNotes: null,
} satisfies CourseworkActivityDetailDto;
const assessmentDetail = {
  behaviorFamily: "assessment",
  modality: "in_class",
  authoringNotes: null,
} satisfies AssessmentActivityDetailDto;
// Each detail is separately proven assignable to the discriminated union.
const _meetingIsActivityDetail: ActivityDetailDto = meetingDetail;
const _courseworkIsActivityDetail: ActivityDetailDto = courseworkDetail;
const _assessmentIsActivityDetail: ActivityDetailDto = assessmentDetail;
void _meetingIsActivityDetail;
void _courseworkIsActivityDetail;
void _assessmentIsActivityDetail;

const sampleActivityVersion = {
  id: "activity-version-1",
  activityId: "activity-1",
  revision: 1,
  title: "Lecture 11: Central Limit Theorem",
  summary: null,
  activityTypeVersionId: "activity-type-version-1",
  changeSummary: null,
  publishedAt: null,
  detail: meetingDetail,
  milestoneTemplates: [],
} satisfies ActivityVersionDto;

const sampleCalendarVersionRequest = {
  name: "Example University 2026–27",
  academicYear: "2026-27",
  events: [
    {
      eventType: "holiday",
      startsOn: "2026-11-26",
      endsOn: "2026-11-27",
      label: "Thanksgiving recess",
    },
  ],
  periods: [
    {
      kind: "special_schedule",
      label: "Finals",
      startsOn: "2026-12-14",
      endsOn: "2026-12-18",
    },
  ],
} satisfies CreateAcademicCalendarVersionRequest;
const sampleCalendarVersionResponse = {
  version: {
    id: "calendar-version-1",
    academicCalendarId: "calendar-1",
    version: 1,
    name: "Example University 2026–27",
    academicYear: "2026-27",
    sourceUri: null,
    publishedAt: null,
    archivedAt: null,
  },
  events: [
    {
      id: "calendar-event-1",
      academicCalendarId: "calendar-1",
      academicCalendarVersionId: "calendar-version-1",
      eventType: "holiday",
      startsOn: "2026-11-26",
      endsOn: "2026-11-27",
      label: "Thanksgiving recess",
      sourceUri: null,
    },
  ],
  periods: [
    {
      id: "calendar-period-1",
      academicCalendarVersionId: "calendar-version-1",
      kind: "special_schedule",
      label: "Finals",
      startsOn: "2026-12-14",
      endsOn: "2026-12-18",
    },
  ],
} satisfies GetAcademicCalendarVersionResponse;

// Three detail-family discriminants for TermActivityRevisionDetailDto.
const meetingRevisionDetail = {
  behaviorFamily: "meeting",
  calendarSlotId: "slot-1",
  startsAt: null,
  endsAt: null,
  status: "scheduled",
  modality: "in_person",
  overrideReason: null,
  overrideEvidence: null,
} satisfies MeetingRevisionDetailDto;
const courseworkRevisionDetail = {
  behaviorFamily: "coursework",
  lifecycleState: "open",
  deliveryNotes: null,
} satisfies CourseworkRevisionDetailDto;
const assessmentRevisionDetail = {
  behaviorFamily: "assessment",
  lifecycleState: "scheduled",
  modality: "in_class",
  deliveryNotes: null,
} satisfies AssessmentRevisionDetailDto;
const _meetingIsRevisionDetail: TermActivityRevisionDetailDto = meetingRevisionDetail;
const _courseworkIsRevisionDetail: TermActivityRevisionDetailDto = courseworkRevisionDetail;
const _assessmentIsRevisionDetail: TermActivityRevisionDetailDto = assessmentRevisionDetail;
void _meetingIsRevisionDetail;
void _courseworkIsRevisionDetail;
void _assessmentIsRevisionDetail;

const sampleTermActivityRevision = {
  id: "term-activity-revision-1",
  termActivityId: "term-activity-1",
  revision: 1,
  baseActivityVersionId: "activity-version-1",
  title: "Lecture 11: Central Limit Theorem",
  summary: null,
  changeReason: null,
  createdByInstructorId: null,
  createdAt: "2026-01-20T00:00:00.000Z",
  detail: meetingRevisionDetail,
  topicActions: [
    {
      id: "term-topic-action-1",
      termActivityRevisionId: "term-activity-revision-1",
      topicVersionId: "topic-version-1",
      action: "introduced",
      notes: null,
      provenance: null,
    },
  ],
  milestones: [
    {
      id: "milestone-1",
      termActivityRevisionId: "term-activity-revision-1",
      sourceTemplateId: null,
      role: "due",
      label: "P1 due",
      linkedTermActivityId: "term-activity-1",
      occursAt: "2026-02-01T08:00:00.000Z",
      timeZone: "America/New_York",
      anchorPolicy: "fixed_instant",
      notes: null,
      provenance: null,
    },
  ],
} satisfies TermActivityRevisionDto;

// LM legacy Topic membership and new ordered Activity membership coexist.
const sampleLearningModuleVersion = {
  id: "lm-version-1",
  learningModuleId: "lm-1",
  revision: 1,
  title: "Probability Foundations",
  description: null,
  studentDescription: null,
  learningObjectives: [],
  notes: null,
  defaultSequence: 1,
  changeSummary: null,
  publishedAt: null,
  topics: [{ topicVersionId: "topic-version-1", sequence: 1 }],
  activities: [{ activityVersionId: "activity-version-1", sequence: 1, notes: null }],
} satisfies LearningModuleVersionDto;
const sampleUpsertLearningModuleVersion = {
  title: "Probability Foundations",
  topics: [{ topicVersionId: "topic-version-1", sequence: 1 }],
  activities: [{ activityVersionId: "activity-version-1", sequence: 1, notes: null }],
} satisfies UpsertLearningModuleVersionRequest;

// ArtifactDto/create input additively expose nullable activityVersionId and
// termActivityRevisionId alongside the existing parent pointers.
const sampleActivityVersionArtifact = {
  id: "artifact-1",
  parentType: "activity_version",
  learningModuleVersionId: null,
  topicVersionId: null,
  sessionId: null,
  assessmentId: null,
  activityVersionId: "activity-version-1",
  termActivityRevisionId: null,
  artifactType: "slides",
  sourceType: "uploaded_file",
  title: "Lecture 11 slides",
  uri: "file://slides.pdf",
  filename: "slides.pdf",
  mimeType: "application/pdf",
  generatorKey: null,
  generatedAt: null,
  metadata: null,
  archivedAt: null,
} satisfies ArtifactDto;
const sampleCreateActivityVersionArtifact = {
  parentType: "term_activity_revision",
  learningModuleVersionId: null,
  topicVersionId: null,
  sessionId: null,
  assessmentId: null,
  activityVersionId: null,
  termActivityRevisionId: "term-activity-revision-1",
  artifactType: "handout",
  sourceType: "generated_file",
  title: "Delivered handout",
  uri: "file://handout.pdf",
  filename: "handout.pdf",
  mimeType: "application/pdf",
} satisfies CreateArtifactRequest;

// Preview/apply request/response pairs each carry a preview token plus the
// relevant expected-current pointer/revision, and reuse the shared
// PreviewImpactDto shape (typed issues, sibling duplicates, calendar conflicts).
const sampleImpact: PreviewImpactDto = { issues: [], topicActionDuplicates: [], calendarConflicts: [] };

const sampleAdoptionPreview: TermAdoptionPreviewResponse = {
  kind: "preview",
  previewToken: "preview-token-1",
  expectedCurrentActivityCount: 0,
  candidates: [],
  impact: sampleImpact,
};
const sampleAdoptionApply: TermAdoptionApplyRequest = {
  learningModuleVersionSelections: [],
  crossCuttingSelections: [],
  previewToken: "preview-token-1",
  expectedCurrentActivityCount: 0,
};

const sampleRevisionPreview: TermActivityRevisionPreviewResponse = {
  kind: "preview",
  previewToken: "preview-token-2",
  expectedCurrentRevisionId: null,
  proposedRevision: sampleTermActivityRevision,
  impact: sampleImpact,
};
const sampleRevisionApply: TermActivityRevisionApplyRequest = {
  title: "Lecture 11: Central Limit Theorem",
  detail: meetingRevisionDetail,
  previewToken: "preview-token-2",
  expectedCurrentRevisionId: null,
  advancePointer: "delivered",
};

const samplePromotionPreview: PromoteDeliveryPreviewResponse = {
  kind: "preview",
  previewToken: "preview-token-3",
  expectedCurrentActivityVersionIds: [{ activityId: "activity-1", activityVersionId: "activity-version-1" }],
  drafts: [],
  impact: sampleImpact,
};
const samplePromotionApply: PromoteDeliveryApplyRequest = {
  previewToken: "preview-token-3",
  expectedCurrentActivityVersionIds: [{ activityId: "activity-1", activityVersionId: "activity-version-1" }],
  termActivityIds: ["term-activity-1"],
};

const sampleCalendarPreview: TermCalendarPreviewResponse = {
  kind: "preview",
  previewToken: "preview-token-4",
  expectedCurrentCalendarSlotCount: 0,
  calendarSlotCandidates: [],
  conflicts: [],
  warnings: [],
};
const sampleCalendarApply: TermCalendarApplyRequest = {
  previewToken: "preview-token-4",
  expectedCurrentCalendarSlotCount: 0,
  meetingPatterns: [],
};

const sampleTopicActionWithSiblings: ActivityVersionTopicActionWithSiblingsDto = {
  id: "activity-topic-action-1",
  activityVersionId: "activity-version-1",
  topicVersionId: "topic-version-1",
  action: "introduced",
  notes: null,
  provenance: null,
  siblings: [
    {
      activityVersionId: "activity-version-2",
      activityId: "activity-2",
      activityStableCode: "L03",
      action: "introduced",
    },
  ],
};

describe("redesign-contract B.2R Activity/Term additions", () => {
  it("exposes the new vocabulary enums with their documented members", () => {
    expect(sampleBehaviorFamilies).toEqual(["meeting", "coursework", "assessment"]);
    expect(sampleMilestoneRoles).toEqual(["release", "work", "phase_release", "review", "due"]);
    expect(sampleCalendarPeriodKinds).toEqual([
      "instructional",
      "no_instruction",
      "special_schedule",
    ]);
    expect(sampleAnchorPolicies).toEqual(["follow_activity", "fixed_instant", "standalone"]);
    expect(sampleCalendarExceptionActions).toEqual(["cancel", "add", "replace", "modify"]);
    expect(sampleArtifactParentTypes).toContain("activity_version");
    expect(sampleArtifactParentTypes).toContain("term_activity_revision");
  });

  it("proves all three Activity detail-family discriminants round-trip", () => {
    expect(sampleActivityVersion.detail.behaviorFamily).toBe("meeting");
    expect(meetingDetail.behaviorFamily).toBe("meeting");
    expect(courseworkDetail.behaviorFamily).toBe("coursework");
    expect(assessmentDetail.behaviorFamily).toBe("assessment");
  });

  it("proves all three Term Activity revision detail-family discriminants round-trip", () => {
    expect(sampleTermActivityRevision.detail.behaviorFamily).toBe("meeting");
    expect(meetingRevisionDetail.behaviorFamily).toBe("meeting");
    expect(courseworkRevisionDetail.behaviorFamily).toBe("coursework");
    expect(assessmentRevisionDetail.behaviorFamily).toBe("assessment");
    expect(sampleTermActivityRevision.topicActions[0]?.action).toBe("introduced");
    expect(sampleTermActivityRevision.milestones[0]?.anchorPolicy).toBe("fixed_instant");
  });

  it("keeps LM legacy topics and new ordered Activity membership coexisting", () => {
    expect(sampleLearningModuleVersion.topics).toHaveLength(1);
    expect(sampleLearningModuleVersion.activities).toHaveLength(1);
    expect(sampleUpsertLearningModuleVersion.topics).toHaveLength(1);
    expect(sampleUpsertLearningModuleVersion.activities).toHaveLength(1);
  });

  it("carries versioned calendar events and explicit special periods", () => {
    expect(sampleCalendarVersionRequest.events?.[0]?.label).toBe("Thanksgiving recess");
    expect(sampleCalendarVersionRequest.periods?.[0]?.kind).toBe("special_schedule");
    expect(sampleCalendarVersionResponse.events[0]?.academicCalendarVersionId).toBe(
      "calendar-version-1",
    );
    expect(sampleCalendarVersionResponse.periods[0]?.label).toBe("Finals");
  });

  it("extends ArtifactDto/create input additively with the new nullable parents", () => {
    expect(sampleActivityVersionArtifact.activityVersionId).toBe("activity-version-1");
    expect(sampleActivityVersionArtifact.termActivityRevisionId).toBeNull();
    expect(sampleCreateActivityVersionArtifact.termActivityRevisionId).toBe(
      "term-activity-revision-1",
    );
  });

  it("carries a preview token plus expected-current pointer through every preview/apply pair", () => {
    expect(sampleAdoptionPreview.previewToken).toBe(sampleAdoptionApply.previewToken);
    expect(sampleAdoptionApply.expectedCurrentActivityCount).toBe(
      sampleAdoptionPreview.expectedCurrentActivityCount,
    );
    expect(sampleRevisionPreview.previewToken).toBe(sampleRevisionApply.previewToken);
    expect(sampleRevisionApply.expectedCurrentRevisionId).toBe(
      sampleRevisionPreview.expectedCurrentRevisionId,
    );
    expect(samplePromotionPreview.previewToken).toBe(samplePromotionApply.previewToken);
    expect(samplePromotionApply.expectedCurrentActivityVersionIds).toEqual(
      samplePromotionPreview.expectedCurrentActivityVersionIds,
    );
    expect(sampleCalendarPreview.previewToken).toBe(sampleCalendarApply.previewToken);
    expect(sampleCalendarApply.expectedCurrentCalendarSlotCount).toBe(
      sampleCalendarPreview.expectedCurrentCalendarSlotCount,
    );
  });

  it("gives every preview response typed issues, calendar conflicts, and topic-action duplicates", () => {
    expect(sampleAdoptionPreview.impact).toEqual(sampleImpact);
    expect(sampleRevisionPreview.impact).toEqual(sampleImpact);
    expect(samplePromotionPreview.impact).toEqual(sampleImpact);
    expect(sampleImpact.issues).toEqual([]);
    expect(sampleImpact.topicActionDuplicates).toEqual([]);
    expect(sampleImpact.calendarConflicts).toEqual([]);
  });

  it("returns sibling duplicate Topic/action links without failing the write", () => {
    expect(sampleTopicActionWithSiblings.siblings).toHaveLength(1);
    expect(sampleTopicActionWithSiblings.siblings[0]?.activityId).toBe("activity-2");
  });

  it("adds the accepted B.2R canonical routes without removing existing B.1 routes", () => {
    const routeSet = new Set<string>(CANONICAL_ROUTES);
    // Pre-existing B.1 routes remain.
    expect(routeSet.has("/api/terms")).toBe(true);
    expect(routeSet.has("/api/terms/[id]")).toBe(true);
    expect(routeSet.has("/api/terms/[id]/sessions")).toBe(true);
    expect(routeSet.has("/api/courses/[id]/learning-modules")).toBe(true);
    expect(routeSet.has("/api/academic-calendars/[id]/versions")).toBe(true);
    expect(routeSet.has("/api/academic-calendar-versions/[id]")).toBe(true);
    // New Activity vocabulary/design routes.
    expect(routeSet.has("/api/instructors/me/activity-types")).toBe(true);
    expect(routeSet.has("/api/courses/[id]/activities")).toBe(true);
    expect(routeSet.has("/api/activity-versions/[id]/topic-actions")).toBe(true);
    // New Term plan/run routes.
    expect(routeSet.has("/api/terms/[id]/adoption-preview")).toBe(true);
    expect(routeSet.has("/api/term-activities/[id]/revision-apply")).toBe(true);
    expect(routeSet.has("/api/terms/[id]/promote-delivery-apply")).toBe(true);
    // New calendar routes.
    expect(routeSet.has("/api/terms/[id]/calendar-preview")).toBe(true);
    expect(routeSet.has("/api/term-calendar-exceptions/[id]")).toBe(true);
  });
});
