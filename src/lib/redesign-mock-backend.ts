// Lane C (Phase B, issue #24) works against the frozen Phase A.1 contract
// (`redesign-contract.ts`) while Lane A fills in the real handlers behind
// CANONICAL_ROUTES (currently all 501 stubs — see redesign-stub.ts). This
// in-memory mock stands in for that backend: it implements the same
// request/response shapes the real routes will return, seeded with
// realistic-looking data so the workspace UI can be designed and exercised
// end-to-end now. When Lane A ships, `redesign-api-client.ts` swaps its
// implementation for real `fetch()` calls without changing call sites.
//
// Design principle #8 (mock is a feature, not a placeholder): this mock
// enforces the same invariants the real service will (immutable versions,
// service-owned delivered pointer, compound Term/Course scoping) so the UI
// built against it doesn't silently assume an easier world than production.

import type {
  AcademicCalendarDto,
  ArtifactDto,
  AssessmentDto,
  CalendarSlotDto,
  CloneTermApplyResponse,
  CloneTermPreviewResponse,
  CoverageDto,
  CoverageHealthDto,
  CourseDto,
  CourseInstitutionDto,
  CreateDeliveredRevisionRequest,
  CreateDeliveredRevisionResponse,
  Id,
  InstitutionDto,
  LearningModuleDto,
  LearningModuleVersionDto,
  PlannedDeliveredDiffResponse,
  PlannedDeliveredTopicChange,
  SessionDto,
  TermDto,
  TermLearningModuleDto,
  TermLifecycleTransition,
  TermStatus,
  TopicDto,
  TopicPrerequisiteDto,
  TopicVersionDto,
  UpsertLearningModuleVersionRequest,
  UpsertTopicVersionRequest,
} from "./redesign-contract";

// ---------------------------------------------------------------------------
// id + clock helpers
// ---------------------------------------------------------------------------

let idCounter = 0;
function nextId(prefix: string): Id {
  idCounter += 1;
  return `${prefix}_${idCounter.toString(36)}`;
}

function now(): string {
  return new Date().toISOString();
}

export class MockNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MockNotFoundError";
  }
}

export class MockConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MockConflictError";
  }
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

type Store = {
  institutions: Map<Id, InstitutionDto>;
  academicCalendars: Map<Id, AcademicCalendarDto>;
  courses: Map<Id, CourseDto>;
  courseInstitutions: CourseInstitutionDto[];
  learningModules: Map<Id, LearningModuleDto>;
  learningModuleVersions: Map<Id, LearningModuleVersionDto>;
  topics: Map<Id, TopicDto>;
  topicVersions: Map<Id, TopicVersionDto>;
  topicPrerequisites: TopicPrerequisiteDto[];
  terms: Map<Id, TermDto>;
  calendarSlots: Map<Id, CalendarSlotDto>;
  termLearningModules: Map<Id, TermLearningModuleDto>;
  sessions: Map<Id, SessionDto>;
  coverages: Map<Id, CoverageDto>;
  assessments: Map<Id, AssessmentDto>;
  artifacts: Map<Id, ArtifactDto>;
};

function emptyStore(): Store {
  return {
    institutions: new Map(),
    academicCalendars: new Map(),
    courses: new Map(),
    courseInstitutions: [],
    learningModules: new Map(),
    learningModuleVersions: new Map(),
    topics: new Map(),
    topicVersions: new Map(),
    topicPrerequisites: [],
    terms: new Map(),
    calendarSlots: new Map(),
    termLearningModules: new Map(),
    sessions: new Map(),
    coverages: new Map(),
    assessments: new Map(),
    artifacts: new Map(),
  };
}

export const INSTRUCTOR_ID: Id = "instr_demo";

let store = emptyStore();

export function resetMockBackend(): void {
  idCounter = 0;
  store = emptyStore();
  seed();
}

// ---------------------------------------------------------------------------
// Seed data — a realistic two-institution, two-course demo scenario
// ---------------------------------------------------------------------------

function seed(): void {
  const berkeley: InstitutionDto = {
    id: nextId("inst"),
    name: "UC Berkeley",
    shortName: "Berkeley",
    canonicalUri: "https://berkeley.edu",
    archivedAt: null,
  };
  const extension: InstitutionDto = {
    id: nextId("inst"),
    name: "Berkeley Extension",
    shortName: "Extension",
    canonicalUri: null,
    archivedAt: null,
  };
  store.institutions.set(berkeley.id, berkeley);
  store.institutions.set(extension.id, extension);

  const cal2026: AcademicCalendarDto = {
    id: nextId("cal"),
    institutionId: berkeley.id,
    name: "2026-27 Academic Calendar",
    academicYear: "2026-27",
    version: 1,
    sourceUri: null,
    publishedAt: now(),
    archivedAt: null,
  };
  const cal2025: AcademicCalendarDto = {
    id: nextId("cal"),
    institutionId: berkeley.id,
    name: "2025-26 Academic Calendar",
    academicYear: "2025-26",
    version: 1,
    sourceUri: null,
    publishedAt: now(),
    archivedAt: null,
  };
  store.academicCalendars.set(cal2026.id, cal2026);
  store.academicCalendars.set(cal2025.id, cal2025);

  // Course 1: Data 100-style course, fully built out.
  const ds100 = createCourseInternal({
    instructorId: INSTRUCTOR_ID,
    title: "Principles and Techniques of Data Science",
    number: "DATA 100",
    description: "Core data science methods course.",
    institutionIds: [berkeley.id],
  });

  const probLm = createLearningModuleInternal(ds100.id, "PROB", {
    title: "Probability Foundations",
    description: "Core probability concepts underpinning inference.",
    learningObjectives: ["Reason about random variables", "Apply expectation and variance"],
    topics: [],
    publish: true,
  });

  const t1 = createTopicInternal(ds100.id, "PROB1", null, {
    title: "Probability 1: Sample spaces & events",
    category: "Probability",
    description: "Foundational vocabulary.",
    publish: true,
  });
  const t2 = createTopicInternal(ds100.id, "PROB2", probLm.learningModule.id, {
    title: "Probability 2: Random variables",
    category: "Probability",
    description: "Discrete and continuous random variables.",
    publish: true,
  });
  const t3 = createTopicInternal(ds100.id, "PROB3", probLm.learningModule.id, {
    title: "Probability 3: Expectation & variance",
    category: "Probability",
    description: "Linearity of expectation, variance identities.",
    publish: true,
  });
  createTopicInternal(ds100.id, "SQL1", null, {
    title: "SQL 1: Selecting & filtering",
    category: "Data Wrangling",
    description: "Unassigned — not yet placed into a module.",
    publish: true,
  });

  replaceTopicPrerequisitesInternal(t2.topic.id, [t1.topic.id]);
  replaceTopicPrerequisitesInternal(t3.topic.id, [t2.topic.id]);

  // Attach PROB2/PROB3 into the module's current version's topic list.
  upsertLearningModuleVersionInternal(probLm.learningModule.id, {
    expectedCurrentVersionId: probLm.currentVersion.id,
    title: probLm.currentVersion.title,
    description: probLm.currentVersion.description,
    learningObjectives: probLm.currentVersion.learningObjectives,
    topics: [
      { topicVersionId: t2.currentVersion!.id, sequence: 1 },
      { topicVersionId: t3.currentVersion!.id, sequence: 2 },
    ],
    changeSummary: "Add Probability 2 and 3 to the module.",
    publish: true,
  });

  // An empty learning module (no topics yet) — Chunk 7 acceptance.
  createLearningModuleInternal(ds100.id, "WRANGLE", {
    title: "Data Wrangling",
    description: "Working module shell, topics not yet placed.",
    topics: [],
    publish: true,
  });

  // Spring term: active, planned + in-flight delivered divergence.
  const spring = createTermInternal({
    courseId: ds100.id,
    institutionId: berkeley.id,
    academicCalendarId: cal2026.id,
    code: "SP26",
    name: "Spring 2026",
    startDate: "2026-01-20",
    endDate: "2026-05-08",
    meetingPattern: { days: ["Tue", "Thu"] },
  });
  transitionTermInternal(spring.id, "activate", "planned");

  const probVersion = store.learningModuleVersions.get(
    store.learningModules.get(probLm.learningModule.id)!.currentVersionId!,
  )!;
  const tlm = adoptTermLearningModuleInternal(spring.id, {
    learningModuleId: probLm.learningModule.id,
    learningModuleVersionId: probVersion.id,
    sequence: 1,
    notes: "Planned as the opening unit.",
  });

  seedSession(spring.id, tlm.id, 1, "lecture", "L01", "Sample spaces & events", "2026-01-20");
  seedSession(spring.id, tlm.id, 2, "lecture", "L02", "Random variables", "2026-01-22");
  const gapDay = seedSession(spring.id, tlm.id, 3, "lecture", "L03", "Expectation & variance", null);
  void gapDay;

  addCalendarSlot(spring.id, "2026-01-20", "class_day");
  addCalendarSlot(spring.id, "2026-01-22", "class_day");
  addCalendarSlot(spring.id, "2026-01-27", "class_day");
  addCalendarSlot(spring.id, "2026-02-16", "holiday", "Presidents' Day");

  // Fall term (closed / historical) with a delivered divergence from plan.
  const fall = createTermInternal({
    courseId: ds100.id,
    institutionId: berkeley.id,
    academicCalendarId: cal2025.id,
    code: "FA25",
    name: "Fall 2025",
    startDate: "2025-08-25",
    endDate: "2025-12-12",
    meetingPattern: { days: ["Tue", "Thu"] },
  });
  transitionTermInternal(fall.id, "activate", "planned");
  const fallTlm = adoptTermLearningModuleInternal(fall.id, {
    learningModuleId: probLm.learningModule.id,
    learningModuleVersionId: probVersion.id,
    sequence: 1,
    notes: "Opening unit, as planned in summer prep.",
  });
  // Simulate an in-term amendment: split "Random variables" content, which
  // advances the delivered pointer to a new revision.
  createDeliveredRevisionInternal(fallTlm.id, {
    expectedDeliveredLearningModuleVersionId: null,
    title: probVersion.title,
    description: probVersion.description,
    learningObjectives: [...probVersion.learningObjectives, "Distinguish discrete vs. continuous RVs explicitly"],
    topics: probVersion.topics,
    changeSummary: "Added an explicit discrete-vs-continuous learning objective after students struggled in week 2.",
  });
  transitionTermInternal(fall.id, "close", "planned");

  // Course 2: a brand-new course with no learning modules or terms yet —
  // exercises the "course exists with nothing built out" empty state.
  createCourseInternal({
    instructorId: INSTRUCTOR_ID,
    title: "Intro to Statistical Computing",
    number: "1XX",
    numberIsPlaceholder: true,
    description: null,
    institutionIds: [extension.id],
  });
}

function seedSession(
  termId: Id,
  termLearningModuleId: Id | null,
  sequence: number,
  sessionType: "lecture" | "lab",
  code: string,
  title: string,
  date: string | null,
): SessionDto {
  const session: SessionDto = {
    id: nextId("sess"),
    termId,
    termLearningModuleId,
    calendarSlotId: null,
    sequence,
    sessionType,
    code,
    title,
    date,
    scheduleOverrideLabel: null,
    description: null,
    format: null,
    notes: null,
    status: "scheduled",
    instructionalMode: "standard",
    canceledAt: null,
    canceledReason: null,
    archivedAt: null,
  };
  store.sessions.set(session.id, session);
  return session;
}

function addCalendarSlot(
  termId: Id,
  date: string,
  slotType: CalendarSlotDto["slotType"],
  label: string | null = null,
): CalendarSlotDto {
  const slot: CalendarSlotDto = {
    id: nextId("slot"),
    termId,
    academicCalendarEventId: null,
    date,
    slotType,
    label,
    source: "baseline",
    instructionalCapacity: "normal",
    capacitySource: "baseline",
    capacityReason: null,
  };
  store.calendarSlots.set(slot.id, slot);
  return slot;
}

// ---------------------------------------------------------------------------
// Institutions / academic calendars
// ---------------------------------------------------------------------------

export function listInstitutions(): InstitutionDto[] {
  return [...store.institutions.values()].filter((i) => !i.archivedAt);
}

export function listAcademicCalendars(institutionId?: Id): AcademicCalendarDto[] {
  return [...store.academicCalendars.values()].filter(
    (c) => !c.archivedAt && (!institutionId || c.institutionId === institutionId),
  );
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

function createCourseInternal(input: {
  instructorId: Id;
  title: string;
  titleIsPlaceholder?: boolean;
  number: string;
  numberIsPlaceholder?: boolean;
  description?: string | null;
  institutionIds?: Id[];
}): CourseDto {
  const course: CourseDto = {
    id: nextId("course"),
    instructorId: input.instructorId,
    shortId: nextId("c").toUpperCase(),
    title: input.title,
    titleIsPlaceholder: input.titleIsPlaceholder ?? false,
    number: input.number,
    numberIsPlaceholder: input.numberIsPlaceholder ?? false,
    description: input.description ?? null,
    archivedAt: null,
  };
  store.courses.set(course.id, course);
  for (const institutionId of input.institutionIds ?? []) {
    store.courseInstitutions.push({ courseId: course.id, institutionId });
  }
  return course;
}

export function listCourses(): CourseDto[] {
  return [...store.courses.values()].filter((c) => !c.archivedAt);
}

export function getCourse(id: Id): CourseDto {
  const course = store.courses.get(id);
  if (!course) throw new MockNotFoundError(`Course ${id} not found`);
  return course;
}

export function createCourse(input: {
  instructorId: Id;
  title: string;
  titleIsPlaceholder?: boolean;
  number: string;
  numberIsPlaceholder?: boolean;
  description?: string | null;
  institutionIds?: Id[];
}): CourseDto {
  return createCourseInternal(input);
}

export function updateCourse(
  id: Id,
  patch: Partial<Pick<CourseDto, "title" | "titleIsPlaceholder" | "number" | "numberIsPlaceholder" | "description" | "archivedAt">>,
): CourseDto {
  const course = getCourse(id);
  const updated = { ...course, ...patch };
  store.courses.set(id, updated);
  return updated;
}

export function listCourseInstitutions(courseId: Id): InstitutionDto[] {
  const ids = store.courseInstitutions.filter((ci) => ci.courseId === courseId).map((ci) => ci.institutionId);
  return ids.map((id) => store.institutions.get(id)!).filter(Boolean);
}

export function replaceCourseInstitutions(courseId: Id, institutionIds: Id[]): CourseInstitutionDto[] {
  store.courseInstitutions = store.courseInstitutions.filter((ci) => ci.courseId !== courseId);
  const rows = institutionIds.map((institutionId) => ({ courseId, institutionId }));
  store.courseInstitutions.push(...rows);
  return rows;
}

// ---------------------------------------------------------------------------
// Learning modules + versions
// ---------------------------------------------------------------------------

function createLearningModuleInternal(
  courseId: Id,
  stableCode: string,
  version: UpsertLearningModuleVersionRequest,
): { learningModule: LearningModuleDto; currentVersion: LearningModuleVersionDto } {
  const learningModule: LearningModuleDto = {
    id: nextId("lm"),
    courseId,
    stableCode,
    currentVersionId: null,
    archivedAt: null,
  };
  store.learningModules.set(learningModule.id, learningModule);
  const currentVersion = createLearningModuleVersionInternal(learningModule.id, version);
  if (version.publish) {
    learningModule.currentVersionId = currentVersion.id;
  }
  return { learningModule, currentVersion };
}

function createLearningModuleVersionInternal(
  learningModuleId: Id,
  version: UpsertLearningModuleVersionRequest,
): LearningModuleVersionDto {
  const priorVersions = [...store.learningModuleVersions.values()].filter(
    (v) => v.learningModuleId === learningModuleId,
  );
  const revision = priorVersions.length + 1;
  const dto: LearningModuleVersionDto = {
    id: nextId("lmv"),
    learningModuleId,
    revision,
    title: version.title,
    description: version.description ?? null,
    studentDescription: version.studentDescription ?? null,
    learningObjectives: version.learningObjectives ?? [],
    notes: version.notes ?? null,
    defaultSequence: version.defaultSequence ?? null,
    changeSummary: version.changeSummary ?? null,
    publishedAt: version.publish ? now() : null,
    topics: version.topics ?? [],
  };
  store.learningModuleVersions.set(dto.id, dto);
  return dto;
}

function upsertLearningModuleVersionInternal(
  learningModuleId: Id,
  version: UpsertLearningModuleVersionRequest,
): LearningModuleVersionDto {
  const learningModule = store.learningModules.get(learningModuleId);
  if (!learningModule) throw new MockNotFoundError(`LearningModule ${learningModuleId} not found`);
  if (version.expectedCurrentVersionId !== undefined && version.expectedCurrentVersionId !== learningModule.currentVersionId) {
    throw new MockConflictError(
      "Learning module was updated by someone else — refresh before saving (optimistic concurrency check failed).",
    );
  }
  const newVersion = createLearningModuleVersionInternal(learningModuleId, version);
  if (version.publish) {
    learningModule.currentVersionId = newVersion.id;
    store.learningModules.set(learningModuleId, learningModule);
  }
  return newVersion;
}

export function listLearningModules(courseId: Id): LearningModuleDto[] {
  return [...store.learningModules.values()].filter((lm) => lm.courseId === courseId && !lm.archivedAt);
}

export function getLearningModule(id: Id): { learningModule: LearningModuleDto; currentVersion: LearningModuleVersionDto | null } {
  const learningModule = store.learningModules.get(id);
  if (!learningModule) throw new MockNotFoundError(`LearningModule ${id} not found`);
  const currentVersion = learningModule.currentVersionId
    ? (store.learningModuleVersions.get(learningModule.currentVersionId) ?? null)
    : null;
  return { learningModule, currentVersion };
}

export function listLearningModuleVersions(learningModuleId: Id): LearningModuleVersionDto[] {
  return [...store.learningModuleVersions.values()]
    .filter((v) => v.learningModuleId === learningModuleId)
    .sort((a, b) => a.revision - b.revision);
}

export function createLearningModule(
  courseId: Id,
  stableCode: string,
  version: UpsertLearningModuleVersionRequest,
): { learningModule: LearningModuleDto; currentVersion: LearningModuleVersionDto } {
  return createLearningModuleInternal(courseId, stableCode, version);
}

export function createLearningModuleVersion(
  learningModuleId: Id,
  version: UpsertLearningModuleVersionRequest,
): LearningModuleVersionDto {
  return upsertLearningModuleVersionInternal(learningModuleId, version);
}

/** Restore-as-new-revision: copy an older version's content into a fresh, published revision. */
export function restoreLearningModuleVersion(learningModuleId: Id, versionId: Id, changeSummary?: string): LearningModuleVersionDto {
  const source = store.learningModuleVersions.get(versionId);
  if (!source || source.learningModuleId !== learningModuleId) {
    throw new MockNotFoundError(`Version ${versionId} not found on module ${learningModuleId}`);
  }
  return upsertLearningModuleVersionInternal(learningModuleId, {
    title: source.title,
    description: source.description,
    studentDescription: source.studentDescription,
    learningObjectives: source.learningObjectives,
    notes: source.notes,
    defaultSequence: source.defaultSequence,
    topics: source.topics,
    changeSummary: changeSummary ?? `Restored from revision ${source.revision}.`,
    publish: true,
  });
}

// ---------------------------------------------------------------------------
// Topics + versions + prerequisites
// ---------------------------------------------------------------------------

function createTopicInternal(
  courseId: Id,
  stableCode: string,
  learningModuleId: Id | null,
  version: UpsertTopicVersionRequest,
): { topic: TopicDto; currentVersion: TopicVersionDto | null } {
  const topic: TopicDto = {
    id: nextId("topic"),
    courseId,
    learningModuleId,
    stableCode,
    currentVersionId: null,
    archivedAt: null,
  };
  store.topics.set(topic.id, topic);
  const currentVersion = createTopicVersionInternal(topic.id, version);
  if (version.publish) topic.currentVersionId = currentVersion.id;
  return { topic, currentVersion: version.publish ? currentVersion : null };
}

function createTopicVersionInternal(topicId: Id, version: UpsertTopicVersionRequest): TopicVersionDto {
  const priorVersions = [...store.topicVersions.values()].filter((v) => v.topicId === topicId);
  const dto: TopicVersionDto = {
    id: nextId("tv"),
    topicId,
    revision: priorVersions.length + 1,
    title: version.title,
    category: version.category ?? null,
    description: version.description ?? null,
    changeSummary: version.changeSummary ?? null,
    publishedAt: version.publish ? now() : null,
  };
  store.topicVersions.set(dto.id, dto);
  return dto;
}

export function listTopics(courseId: Id): TopicDto[] {
  return [...store.topics.values()].filter((t) => t.courseId === courseId && !t.archivedAt);
}

export function getTopic(id: Id): { topic: TopicDto; currentVersion: TopicVersionDto | null } {
  const topic = store.topics.get(id);
  if (!topic) throw new MockNotFoundError(`Topic ${id} not found`);
  const currentVersion = topic.currentVersionId ? (store.topicVersions.get(topic.currentVersionId) ?? null) : null;
  return { topic, currentVersion };
}

export function getTopicVersion(id: Id): TopicVersionDto {
  const version = store.topicVersions.get(id);
  if (!version) throw new MockNotFoundError(`TopicVersion ${id} not found`);
  return version;
}

export function listTopicVersions(topicId: Id): TopicVersionDto[] {
  return [...store.topicVersions.values()].filter((v) => v.topicId === topicId).sort((a, b) => a.revision - b.revision);
}

export function createTopic(
  courseId: Id,
  stableCode: string,
  learningModuleId: Id | null,
  version: UpsertTopicVersionRequest,
): { topic: TopicDto; currentVersion: TopicVersionDto | null } {
  return createTopicInternal(courseId, stableCode, learningModuleId, version);
}

export function createTopicVersion(topicId: Id, version: UpsertTopicVersionRequest): TopicVersionDto {
  const topic = store.topics.get(topicId);
  if (!topic) throw new MockNotFoundError(`Topic ${topicId} not found`);
  const newVersion = createTopicVersionInternal(topicId, version);
  if (version.publish) {
    topic.currentVersionId = newVersion.id;
    store.topics.set(topicId, topic);
  }
  return newVersion;
}

/** LM assignment is an editable property of the Topic (v2.1 §9.1), not creation-time only. */
export function assignTopicLearningModule(topicId: Id, learningModuleId: Id | null): TopicDto {
  const topic = store.topics.get(topicId);
  if (!topic) throw new MockNotFoundError(`Topic ${topicId} not found`);
  const updated = { ...topic, learningModuleId };
  store.topics.set(topicId, updated);
  return updated;
}

export function listTopicPrerequisites(courseId: Id): TopicPrerequisiteDto[] {
  const topicIds = new Set(listTopics(courseId).map((t) => t.id));
  return store.topicPrerequisites.filter((p) => topicIds.has(p.topicId));
}

function replaceTopicPrerequisitesInternal(topicId: Id, prerequisiteTopicIds: Id[]): TopicPrerequisiteDto[] {
  store.topicPrerequisites = store.topicPrerequisites.filter((p) => p.topicId !== topicId);
  const rows = prerequisiteTopicIds.map((prerequisiteTopicId) => ({ topicId, prerequisiteTopicId }));
  store.topicPrerequisites.push(...rows);
  return rows;
}

export function replaceTopicPrerequisites(topicId: Id, prerequisiteTopicIds: Id[]): TopicPrerequisiteDto[] {
  if (prerequisiteTopicIds.includes(topicId)) {
    throw new MockConflictError("A topic cannot be its own prerequisite.");
  }
  if (wouldCreateCycle(topicId, prerequisiteTopicIds)) {
    throw new MockConflictError("That prerequisite would create a cycle in the topic progression.");
  }
  return replaceTopicPrerequisitesInternal(topicId, prerequisiteTopicIds);
}

function wouldCreateCycle(topicId: Id, newPrereqs: Id[]): boolean {
  const adjacency = new Map<Id, Id[]>();
  for (const p of store.topicPrerequisites) {
    if (p.topicId === topicId) continue;
    adjacency.set(p.topicId, [...(adjacency.get(p.topicId) ?? []), p.prerequisiteTopicId]);
  }
  adjacency.set(topicId, newPrereqs);

  const visited = new Set<Id>();
  const stack = new Set<Id>();
  function visit(node: Id): boolean {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    stack.add(node);
    for (const next of adjacency.get(node) ?? []) {
      if (visit(next)) return true;
    }
    stack.delete(node);
    return false;
  }
  return visit(topicId);
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

function createTermInternal(input: {
  courseId: Id;
  institutionId: Id;
  academicCalendarId: Id;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  meetingPattern?: unknown;
}): TermDto {
  const term: TermDto = {
    id: nextId("term"),
    courseId: input.courseId,
    institutionId: input.institutionId,
    academicCalendarId: input.academicCalendarId,
    code: input.code,
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    meetingPattern: input.meetingPattern ?? null,
    status: "planned",
    closedAt: null,
    clonedFromId: null,
    archivedAt: null,
  };
  store.terms.set(term.id, term);
  return term;
}

export function listTerms(courseId?: Id): TermDto[] {
  return [...store.terms.values()].filter((t) => !t.archivedAt && (!courseId || t.courseId === courseId));
}

export function getTerm(id: Id): TermDto {
  const term = store.terms.get(id);
  if (!term) throw new MockNotFoundError(`Term ${id} not found`);
  return term;
}

export function createTerm(input: {
  courseId: Id;
  institutionId: Id;
  academicCalendarId: Id;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  meetingPattern?: unknown;
}): TermDto {
  return createTermInternal(input);
}

export function updateTerm(
  id: Id,
  patch: Partial<Pick<TermDto, "code" | "name" | "startDate" | "endDate" | "meetingPattern" | "academicCalendarId">>,
): TermDto {
  const term = getTerm(id);
  if (term.status === "closed") {
    throw new MockConflictError("Term is closed and read-only. Reopen it before editing.");
  }
  const updated = { ...term, ...patch };
  store.terms.set(id, updated);
  return updated;
}

const TERM_TRANSITIONS: Record<TermStatus, Partial<Record<TermLifecycleTransition, TermStatus>>> = {
  planned: { activate: "active" },
  active: { close: "closed" },
  closed: { reopen: "active" },
};

function transitionTermInternal(id: Id, transition: TermLifecycleTransition, expectedStatus: TermStatus): TermDto {
  const term = getTerm(id);
  if (term.status !== expectedStatus) {
    throw new MockConflictError(`Term status changed since you loaded it (now "${term.status}").`);
  }
  const nextStatus = TERM_TRANSITIONS[term.status]?.[transition];
  if (!nextStatus) {
    throw new MockConflictError(`Cannot ${transition} a term in status "${term.status}".`);
  }
  const updated: TermDto = {
    ...term,
    status: nextStatus,
    closedAt: nextStatus === "closed" ? now() : nextStatus === "active" ? null : term.closedAt,
  };
  store.terms.set(id, updated);
  return updated;
}

export function transitionTerm(id: Id, transition: TermLifecycleTransition, expectedStatus: TermStatus): TermDto {
  return transitionTermInternal(id, transition, expectedStatus);
}

export function previewCloneTerm(
  sourceTermId: Id,
): CloneTermPreviewResponse {
  const source = getTerm(sourceTermId);
  const learningModuleCount = listTermLearningModules(sourceTermId).length;
  const sessionCount = listTermSessions(sourceTermId).length;
  const assessmentCount = listTermAssessments(sourceTermId).length;
  const calendarSlotCount = listCalendarSlots(sourceTermId).length;
  const unresolvedDates = listTermSessions(sourceTermId)
    .filter((s) => s.date !== null)
    .map((s) => ({ sourceDate: s.date as string, sourceSessionId: s.id, reason: "No matching class day in the target calendar yet — dates will need to be re-picked." }));
  return {
    kind: "preview",
    sourceTermId: source.id,
    learningModuleCount,
    sessionCount,
    assessmentCount,
    calendarSlotCount,
    unresolvedDates,
    warnings: sessionCount === 0 ? ["Source term has no sessions yet — clone will only bring over learning module adoption."] : [],
    learningModuleChoices: [],
  };
}

export function applyCloneTerm(
  sourceTermId: Id,
  input: {
    code: string;
    name: string;
    startDate: string;
    endDate: string;
    institutionId: Id;
    academicCalendarId: Id;
    meetingPattern?: unknown;
  },
): CloneTermApplyResponse {
  const source = getTerm(sourceTermId);
  const term = createTermInternal({ ...input, courseId: source.courseId });
  term.clonedFromId = source.id;
  store.terms.set(term.id, term);
  for (const tlm of listTermLearningModules(sourceTermId)) {
    adoptTermLearningModuleInternal(term.id, {
      learningModuleId: tlm.learningModuleId,
      learningModuleVersionId: tlm.learningModuleVersionId,
      sequence: tlm.sequence,
      notes: tlm.notes,
    });
  }
  return { kind: "applied", term };
}

// ---------------------------------------------------------------------------
// Calendar slots
// ---------------------------------------------------------------------------

export function listCalendarSlots(termId: Id): CalendarSlotDto[] {
  return [...store.calendarSlots.values()]
    .filter((s) => s.termId === termId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function updateCalendarSlotCapacity(
  id: Id,
  patch: Pick<CalendarSlotDto, "instructionalCapacity" | "capacitySource" | "capacityReason">,
): CalendarSlotDto {
  const slot = store.calendarSlots.get(id);
  if (!slot) throw new MockNotFoundError(`CalendarSlot ${id} not found`);
  const updated = { ...slot, ...patch };
  store.calendarSlots.set(id, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Term learning modules (planned + delivered)
// ---------------------------------------------------------------------------

function adoptTermLearningModuleInternal(
  termId: Id,
  input: { learningModuleId: Id; learningModuleVersionId: Id; sequence: number; notes?: string | null },
): TermLearningModuleDto {
  const term = getTerm(termId);
  const dto: TermLearningModuleDto = {
    id: nextId("tlm"),
    termId,
    courseId: term.courseId,
    learningModuleId: input.learningModuleId,
    learningModuleVersionId: input.learningModuleVersionId,
    deliveredLearningModuleVersionId: null,
    sequence: input.sequence,
    notes: input.notes ?? null,
  };
  store.termLearningModules.set(dto.id, dto);
  return dto;
}

export function adoptTermLearningModule(
  termId: Id,
  input: { learningModuleId: Id; learningModuleVersionId: Id; sequence: number; notes?: string | null },
): TermLearningModuleDto {
  const term = getTerm(termId);
  if (term.status === "closed") throw new MockConflictError("Term is closed and read-only.");
  return adoptTermLearningModuleInternal(termId, input);
}

export function listTermLearningModules(termId: Id): TermLearningModuleDto[] {
  return [...store.termLearningModules.values()].filter((t) => t.termId === termId).sort((a, b) => a.sequence - b.sequence);
}

export function getTermLearningModule(id: Id): TermLearningModuleDto {
  const tlm = store.termLearningModules.get(id);
  if (!tlm) throw new MockNotFoundError(`TermLearningModule ${id} not found`);
  return tlm;
}

export function updateTermLearningModule(id: Id, patch: { sequence?: number; notes?: string | null }): TermLearningModuleDto {
  const tlm = getTermLearningModule(id);
  const term = getTerm(tlm.termId);
  if (term.status === "closed") throw new MockConflictError("Term is closed and read-only.");
  const updated = { ...tlm, ...patch };
  store.termLearningModules.set(id, updated);
  return updated;
}

/** The delivered pointer only moves through this service-owned command (v2.2 §10.5). */
function createDeliveredRevisionInternal(
  termLearningModuleId: Id,
  request: CreateDeliveredRevisionRequest,
): CreateDeliveredRevisionResponse {
  const tlm = getTermLearningModule(termLearningModuleId);
  if (request.expectedDeliveredLearningModuleVersionId !== tlm.deliveredLearningModuleVersionId) {
    throw new MockConflictError(
      "The delivered version changed since you loaded it — refresh before editing again.",
    );
  }
  const deliveredVersion = createLearningModuleVersionInternal(tlm.learningModuleId, {
    title: request.title,
    description: request.description,
    studentDescription: request.studentDescription,
    learningObjectives: request.learningObjectives,
    notes: request.notes,
    defaultSequence: request.defaultSequence,
    changeSummary: request.changeSummary,
    topics: request.topics,
    publish: true,
  });
  const updated: TermLearningModuleDto = { ...tlm, deliveredLearningModuleVersionId: deliveredVersion.id };
  store.termLearningModules.set(tlm.id, updated);
  return { termLearningModule: updated, deliveredVersion };
}

export function createDeliveredRevision(
  termLearningModuleId: Id,
  request: CreateDeliveredRevisionRequest,
): CreateDeliveredRevisionResponse {
  const tlm = getTermLearningModule(termLearningModuleId);
  const term = getTerm(tlm.termId);
  if (term.status !== "active") {
    throw new MockConflictError("Only an active term's delivered curriculum can be amended.");
  }
  return createDeliveredRevisionInternal(termLearningModuleId, request);
}

export function getPlannedDeliveredDiff(termLearningModuleId: Id): PlannedDeliveredDiffResponse {
  const tlm = getTermLearningModule(termLearningModuleId);
  const planned = store.learningModuleVersions.get(tlm.learningModuleVersionId);
  const delivered = tlm.deliveredLearningModuleVersionId
    ? store.learningModuleVersions.get(tlm.deliveredLearningModuleVersionId)
    : null;
  if (!planned) throw new MockNotFoundError(`Planned version missing for ${termLearningModuleId}`);

  const topicChanges: PlannedDeliveredTopicChange[] = [];
  if (delivered) {
    const plannedByTopicVersion = new Map(planned.topics.map((t) => [t.topicVersionId, t]));
    const deliveredByTopicVersion = new Map(delivered.topics.map((t) => [t.topicVersionId, t]));
    const allTopicVersionIds = new Set([...plannedByTopicVersion.keys(), ...deliveredByTopicVersion.keys()]);
    for (const topicVersionId of allTopicVersionIds) {
      const topicVersion = store.topicVersions.get(topicVersionId);
      const topicId = topicVersion?.topicId ?? topicVersionId;
      const inPlanned = plannedByTopicVersion.get(topicVersionId);
      const inDelivered = deliveredByTopicVersion.get(topicVersionId);
      if (inPlanned && !inDelivered) {
        topicChanges.push({
          topicId,
          kind: "removed",
          plannedTopicVersionId: topicVersionId,
          deliveredTopicVersionId: null,
          plannedSequence: inPlanned.sequence,
          deliveredSequence: null,
        });
      } else if (!inPlanned && inDelivered) {
        topicChanges.push({
          topicId,
          kind: "added",
          plannedTopicVersionId: null,
          deliveredTopicVersionId: topicVersionId,
          plannedSequence: null,
          deliveredSequence: inDelivered.sequence,
        });
      } else if (inPlanned && inDelivered && inPlanned.sequence !== inDelivered.sequence) {
        topicChanges.push({
          topicId,
          kind: "reordered",
          plannedTopicVersionId: topicVersionId,
          deliveredTopicVersionId: topicVersionId,
          plannedSequence: inPlanned.sequence,
          deliveredSequence: inDelivered.sequence,
        });
      }
    }
    if (planned.learningObjectives.join("|") !== delivered.learningObjectives.join("|")) {
      topicChanges.push({
        topicId: "__module_objectives__",
        kind: "changed",
        plannedTopicVersionId: null,
        deliveredTopicVersionId: null,
        plannedSequence: null,
        deliveredSequence: null,
      });
    }
  }

  return {
    termLearningModuleId,
    plannedLearningModuleVersionId: planned.id,
    deliveredLearningModuleVersionId: tlm.deliveredLearningModuleVersionId,
    topicChanges,
  };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function listTermSessions(termId: Id): SessionDto[] {
  return [...store.sessions.values()].filter((s) => s.termId === termId).sort((a, b) => a.sequence - b.sequence);
}

export function getSession(id: Id): SessionDto {
  const session = store.sessions.get(id);
  if (!session) throw new MockNotFoundError(`Session ${id} not found`);
  return session;
}

// ---------------------------------------------------------------------------
// Coverage health (lightweight, for gap visibility per design principle #4)
// ---------------------------------------------------------------------------

export function computeCoverageHealth(termId: Id): CoverageHealthDto {
  const tlms = listTermLearningModules(termId);
  const topicVersionIds = new Set<Id>();
  for (const tlm of tlms) {
    const version = store.learningModuleVersions.get(tlm.deliveredLearningModuleVersionId ?? tlm.learningModuleVersionId);
    for (const t of version?.topics ?? []) topicVersionIds.add(t.topicVersionId);
  }
  const sessionIds = new Set(listTermSessions(termId).map((s) => s.id));
  const coverageByTopic = new Map<Id, Set<string>>();
  for (const coverage of store.coverages.values()) {
    if (!sessionIds.has(coverage.sessionId)) continue;
    const set = coverageByTopic.get(coverage.topicVersionId) ?? new Set();
    set.add(coverage.level);
    coverageByTopic.set(coverage.topicVersionId, set);
  }
  let fullyCovered = 0;
  let partiallyCovered = 0;
  let uncovered = 0;
  for (const topicVersionId of topicVersionIds) {
    const levels = coverageByTopic.get(topicVersionId);
    if (!levels || levels.size === 0) uncovered += 1;
    else if (levels.size === 3) fullyCovered += 1;
    else partiallyCovered += 1;
  }
  return { totalTopics: topicVersionIds.size, fullyCovered, partiallyCovered, uncovered };
}

// ---------------------------------------------------------------------------
// Assessments / artifacts (read paths only — enough for term overview)
// ---------------------------------------------------------------------------

export function listTermAssessments(termId: Id): AssessmentDto[] {
  return [...store.assessments.values()].filter((a) => a.termId === termId);
}

export function listArtifactsForTopicVersion(topicVersionId: Id): ArtifactDto[] {
  return [...store.artifacts.values()].filter((a) => a.topicVersionId === topicVersionId);
}

// Initialize on module load so pages/tests get a populated store immediately.
resetMockBackend();
