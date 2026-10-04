import { createHash, randomUUID } from "node:crypto";
import { DomainInvariantError } from "./errors";
import type { RedesignDb, RedesignTx } from "./types";

type BehaviorFamily = "meeting" | "coursework" | "assessment";
type CoverageAction = "introduced" | "practiced" | "assessed";

type ExemplarSnapshot = {
  snapshotId: string;
  course: { title: string; number: string; description?: string | null };
  activityTypes: Array<{
    key: string;
    behaviorFamily: BehaviorFamily;
    label: string;
    description?: string | null;
  }>;
  learningModules: Array<{
    stableCode: string;
    title: string;
    description?: string | null;
    objectives?: string[];
  }>;
  topics: Array<{
    stableCode: string;
    learningModuleCode: string;
    title: string;
    category?: string | null;
    description?: string | null;
  }>;
  activities: Array<{
    stableCode: string;
    typeKey: string;
    learningModuleCode?: string | null;
    title: string;
    summary?: string | null;
    topicActions?: Array<{
      topicRef: string;
      action: CoverageAction;
      notes?: string | null;
      answerKey?: unknown;
      solutionKey?: unknown;
      scores?: unknown;
    }>;
  }>;
};

type StagedExemplarImport = {
  snapshot: ExemplarSnapshot;
  snapshotFingerprint: string;
  exclusions: Array<{ path: string; reason: string }>;
};

type PreviewEntityKind =
  | "course"
  | "activity_type"
  | "learning_module"
  | "topic"
  | "activity"
  | "topic_action"
  | "activity_topic_scope";

type ExemplarPreview = {
  snapshotId: string;
  snapshotFingerprint: string;
  creates: Array<{ kind: PreviewEntityKind; stableKey: string; label: string }>;
  provenance: Array<{
    kind: PreviewEntityKind;
    stableKey: string;
    origin: { snapshotId: string; path: string; fingerprint: string };
  }>;
  ambiguities: Array<{ path: string; reference: string; candidates: string[]; reason: string }>;
  exclusions: StagedExemplarImport["exclusions"];
};

type ExemplarApplyResult = {
  courseId: string;
  snapshotFingerprint: string;
  createdOrReused: Record<PreviewEntityKind, number>;
  provenance: ExemplarPreview["provenance"];
  ambiguities: ExemplarPreview["ambiguities"];
  exclusions: StagedExemplarImport["exclusions"];
};

const GRADING_EXCLUDED_KEYS = new Set([
  "answerKey",
  "answer_key",
  "solutionKey",
  "solution_key",
  "rubricSolution",
  "rubric_solution",
  "scores",
  "studentScores",
  "student_scores",
  "perStudentScores",
  "per_student_scores",
]);

export const genericDemoExemplarSnapshot = {
  snapshotId: "generic-intro-data-science-v1",
  course: {
    title: "Intro Data Science",
    number: "IDS 101",
    description: "Generic invented demo course for importer validation.",
  },
  activityTypes: [
    {
      key: "lecture",
      behaviorFamily: "meeting",
      label: "Class Meeting",
      description: "Synchronous class meeting.",
    },
    {
      key: "practice",
      behaviorFamily: "coursework",
      label: "Practice Work",
      description: "Independent practice activity.",
    },
  ],
  learningModules: [
    {
      stableCode: "LM-DATA",
      title: "Working With Data",
      description: "Students inspect, clean, and summarize small datasets.",
      objectives: ["Describe tabular data", "Summarize variables"],
    },
    {
      stableCode: "LM-MODEL",
      title: "Simple Models",
      description: "Students connect questions to simple predictive models.",
      objectives: ["Explain model inputs", "Evaluate simple model output"],
    },
  ],
  topics: [
    {
      stableCode: "TOPIC-TABLES",
      learningModuleCode: "LM-DATA",
      title: "Tabular Data",
      category: "Data",
      description: "Rows, columns, variables, and observations.",
    },
    {
      stableCode: "TOPIC-SUMMARY",
      learningModuleCode: "LM-DATA",
      title: "Summary Measures",
      category: "Data",
      description: "Counts, centers, and spread for generic datasets.",
    },
    {
      stableCode: "TOPIC-MODEL",
      learningModuleCode: "LM-MODEL",
      title: "Model Fit",
      category: "Modeling",
      description: "Compare simple model predictions with observed values.",
    },
  ],
  activities: [
    {
      stableCode: "ACT-INTRO-DATA",
      typeKey: "lecture",
      learningModuleCode: "LM-DATA",
      title: "Data Tables Studio",
      summary: "Introduce tabular structure using invented examples.",
      topicActions: [
        { topicRef: "TOPIC-TABLES", action: "introduced" },
        { topicRef: "TOPIC-SUMMARY", action: "introduced" },
      ],
    },
    {
      stableCode: "ACT-SUMMARY-PRACTICE",
      typeKey: "practice",
      learningModuleCode: "LM-DATA",
      title: "Summary Practice",
      summary: "Practice computing summaries on invented values.",
      topicActions: [{ topicRef: "TOPIC-SUMMARY", action: "practiced" }],
    },
    {
      stableCode: "ACT-MODEL-CHECK",
      typeKey: "practice",
      learningModuleCode: "LM-MODEL",
      title: "Model Check",
      summary: "Assess interpretation of simple generic model output.",
      topicActions: [
        { topicRef: "TOPIC-MODEL", action: "introduced" },
        { topicRef: "TOPIC-MODEL", action: "assessed" },
      ],
    },
  ],
} satisfies ExemplarSnapshot;

export class ExemplarImportService {
  stage(input: unknown): StagedExemplarImport {
    const exclusions: StagedExemplarImport["exclusions"] = [];
    const sanitized = sanitizeGradingFields(input, [], exclusions);
    const snapshot = validateSnapshot(sanitized);

    return {
      snapshot,
      snapshotFingerprint: fingerprint(snapshot),
      exclusions,
    };
  }

  preview(staged: StagedExemplarImport): ExemplarPreview {
    const creates: ExemplarPreview["creates"] = [];
    const provenance: ExemplarPreview["provenance"] = [];
    const ambiguities = findAmbiguities(staged.snapshot);

    const add = (kind: PreviewEntityKind, stableKey: string, label: string, path: string) => {
      creates.push({ kind, stableKey, label });
      provenance.push({
        kind,
        stableKey,
        origin: {
          snapshotId: staged.snapshot.snapshotId,
          path,
          fingerprint: fingerprint({ snapshot: staged.snapshotFingerprint, path, stableKey }),
        },
      });
    };

    add("course", courseStableKey(staged.snapshot), staged.snapshot.course.title, "$.course");
    staged.snapshot.activityTypes.forEach((type, index) =>
      add("activity_type", type.key, type.label, `$.activityTypes[${index}]`),
    );
    staged.snapshot.learningModules.forEach((module, index) =>
      add("learning_module", module.stableCode, module.title, `$.learningModules[${index}]`),
    );
    staged.snapshot.topics.forEach((topic, index) =>
      add("topic", topic.stableCode, topic.title, `$.topics[${index}]`),
    );
    staged.snapshot.activities.forEach((activity, activityIndex) => {
      add("activity", activity.stableCode, activity.title, `$.activities[${activityIndex}]`);
      activity.topicActions?.forEach((action, actionIndex) => {
        const topic = resolveTopicRef(staged.snapshot, action.topicRef);
        if (topic.kind !== "one") return;
        add(
          "topic_action",
          `${activity.stableCode}:${topic.topic.stableCode}:${action.action}`,
          `${activity.title} ${action.action} ${topic.topic.title}`,
          `$.activities[${activityIndex}].topicActions[${actionIndex}]`,
        );
        add(
          "activity_topic_scope",
          `${activity.stableCode}:${topic.topic.stableCode}`,
          `${activity.title} scope ${topic.topic.title}`,
          `$.activities[${activityIndex}].topicActions[${actionIndex}]`,
        );
      });
    });

    return stablePreview({
      snapshotId: staged.snapshot.snapshotId,
      snapshotFingerprint: staged.snapshotFingerprint,
      creates,
      provenance,
      ambiguities,
      exclusions: staged.exclusions,
    });
  }

  async apply(
    db: RedesignDb,
    input: { instructorId: string; courseId: string; snapshot: unknown },
  ): Promise<ExemplarApplyResult> {
    const staged = this.stage(input.snapshot);
    const preview = this.preview(staged);
    if (preview.ambiguities.length > 0) {
      return {
        courseId: input.courseId,
        snapshotFingerprint: staged.snapshotFingerprint,
        createdOrReused: zeroCounts(),
        provenance: preview.provenance,
        ambiguities: preview.ambiguities,
        exclusions: preview.exclusions,
      };
    }

    const counts = zeroCounts();

    await db.$transaction(
      async (tx) => {
        const course = await tx.course.findUnique({
          where: {
            id_instructorId: {
              id: input.courseId,
              instructorId: input.instructorId,
            },
          },
        });
        if (!course) throw new DomainInvariantError("Course not found");

        await applyBatched(tx, staged, input, counts);
      },
      // Keep the remote-import timeout while batching database round trips.
      { timeout: 300_000, maxWait: 30_000 },
    );

    return {
      courseId: input.courseId,
      snapshotFingerprint: staged.snapshotFingerprint,
      createdOrReused: counts,
      provenance: preview.provenance,
      ambiguities: preview.ambiguities,
      exclusions: preview.exclusions,
    };
  }
}

function validateSnapshot(value: unknown): ExemplarSnapshot {
  if (!isRecord(value)) throw new DomainInvariantError("Exemplar snapshot must be an object");
  const snapshot = value as ExemplarSnapshot;
  if (!snapshot.snapshotId || !snapshot.course?.title || !snapshot.course?.number) {
    throw new DomainInvariantError("Exemplar snapshot is missing required course identity");
  }
  for (const collection of ["activityTypes", "learningModules", "topics", "activities"] as const) {
    if (!Array.isArray(snapshot[collection])) {
      throw new DomainInvariantError(`Exemplar snapshot ${collection} must be an array`);
    }
  }
  return snapshot;
}

function sanitizeGradingFields(
  value: unknown,
  path: Array<string | number>,
  exclusions: StagedExemplarImport["exclusions"],
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry, index) => sanitizeGradingFields(entry, [...path, index], exclusions));
  }
  if (!isRecord(value)) return value;
  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (GRADING_EXCLUDED_KEYS.has(key)) {
      exclusions.push({ path: jsonPath([...path, key]), reason: "grading_artifact_excluded" });
      continue;
    }
    sanitized[key] = sanitizeGradingFields(entry, [...path, key], exclusions);
  }
  return sanitized;
}

function findAmbiguities(snapshot: ExemplarSnapshot): ExemplarPreview["ambiguities"] {
  const ambiguities: ExemplarPreview["ambiguities"] = [];
  snapshot.activities.forEach((activity, activityIndex) => {
    activity.topicActions?.forEach((action, actionIndex) => {
      const resolved = resolveTopicRef(snapshot, action.topicRef);
      if (resolved.kind === "ambiguous") {
        ambiguities.push({
          path: `$.activities[${activityIndex}].topicActions[${actionIndex}].topicRef`,
          reference: action.topicRef,
          candidates: resolved.candidates,
          reason: "multiple_topics_match_reference",
        });
      }
      if (resolved.kind === "none") {
        ambiguities.push({
          path: `$.activities[${activityIndex}].topicActions[${actionIndex}].topicRef`,
          reference: action.topicRef,
          candidates: [],
          reason: "no_topic_matches_reference",
        });
      }
    });
  });
  return ambiguities.sort((left, right) => left.path.localeCompare(right.path));
}

function resolveTopicRef(snapshot: ExemplarSnapshot, ref: string) {
  const byCode = snapshot.topics.filter((topic) => topic.stableCode === ref);
  if (byCode.length === 1) return { kind: "one" as const, topic: byCode[0] };
  if (byCode.length > 1) return { kind: "ambiguous" as const, candidates: byCode.map((topic) => topic.stableCode) };
  const byTitle = snapshot.topics.filter((topic) => topic.title === ref);
  if (byTitle.length === 1) return { kind: "one" as const, topic: byTitle[0] };
  if (byTitle.length > 1) return { kind: "ambiguous" as const, candidates: byTitle.map((topic) => topic.stableCode) };
  return { kind: "none" as const };
}

function zeroCounts(): Record<PreviewEntityKind, number> {
  return {
    course: 0,
    activity_type: 0,
    learning_module: 0,
    topic: 0,
    activity: 0,
    topic_action: 0,
    activity_topic_scope: 0,
  };
}

function provenancePayload(staged: Pick<StagedExemplarImport, "snapshot" | "snapshotFingerprint">, path: string) {
  return {
    importer: "generic_exemplar_importer",
    snapshotId: staged.snapshot.snapshotId,
    snapshotFingerprint: staged.snapshotFingerprint,
    path,
    oneWay: true,
  };
}

function stablePreview(preview: ExemplarPreview): ExemplarPreview {
  return {
    ...preview,
    creates: [...preview.creates].sort(compareByKindAndKey),
    provenance: [...preview.provenance].sort(compareByKindAndKey),
    ambiguities: [...preview.ambiguities].sort((left, right) => left.path.localeCompare(right.path)),
    exclusions: [...preview.exclusions].sort((left, right) => left.path.localeCompare(right.path)),
  };
}

function compareByKindAndKey(left: { kind: string; stableKey: string }, right: { kind: string; stableKey: string }) {
  return left.kind.localeCompare(right.kind) || left.stableKey.localeCompare(right.stableKey);
}

function sameTopicActions(
  existing: Array<{ topicVersionId: string; action: string; notes?: string | null; provenance?: unknown }>,
  next: Array<{ topicVersionId: string; action: string; notes?: string | null; provenance?: unknown }>,
) {
  return stableJson(
    existing.map((row) => ({
      topicVersionId: row.topicVersionId,
      action: row.action,
      notes: row.notes ?? null,
      provenance: row.provenance ?? null,
    })),
  ) === stableJson(next.map((row) => ({ ...row, notes: row.notes ?? null, provenance: row.provenance ?? null })));
}

function sameTopicScopes(
  existing: Array<{ topicId: string; notes?: string | null; provenance?: unknown }>,
  next: Array<{ topicId: string; notes?: string | null; provenance?: unknown }>,
) {
  return stableJson(
    existing.map((row) => ({
      topicId: row.topicId,
      notes: row.notes ?? null,
      provenance: row.provenance ?? null,
    })),
  ) === stableJson(next.map((row) => ({ ...row, notes: row.notes ?? null, provenance: row.provenance ?? null })));
}

function stableJson(rows: unknown[]) {
  // Relationships have no database ordering. Compare their content without
  // rewriting unchanged rows when PostgreSQL chooses a different query plan.
  return JSON.stringify(
    rows
      .map((row) =>
        JSON.stringify(row, (_key, entry) => {
          if (!isRecord(entry)) return entry;
          return Object.fromEntries(
            Object.entries(entry).sort(([left], [right]) =>
              left.localeCompare(right),
            ),
          );
        }),
      )
      .sort(),
  );
}

function courseStableKey(snapshot: ExemplarSnapshot) {
  return `${snapshot.course.number}:${snapshot.course.title}`;
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function jsonPath(path: Array<string | number>) {
  return `$${path.map((entry) => (typeof entry === "number" ? `[${entry}]` : `.${entry}`)).join("")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function setCurrentVersions(
  tx: RedesignTx,
  table: "topics" | "activities" | "learning_modules" | "activity_types",
  pairs: Array<[string, string]>,
) {
  if (!pairs.length) return;
  const values = pairs
    .map((_, index) => `($${index * 2 + 1}::uuid, $${index * 2 + 2}::uuid)`)
    .join(", ");
  await tx.$executeRawUnsafe(
    `UPDATE ${table} AS target SET current_version_id = source.version_id, updated_at = NOW() FROM (VALUES ${values}) AS source(id, version_id) WHERE target.id = source.id`,
    ...pairs.flat(),
  );
}

async function applyBatched(
  tx: RedesignTx,
  staged: StagedExemplarImport,
  input: { instructorId: string; courseId: string },
  counts: Record<PreviewEntityKind, number>,
) {
  const snapshot = staged.snapshot;
  const typeVersions = new Map<string, string>();
  const existingTypes = await tx.activityType.findMany({
    where: { instructorId: input.instructorId },
    include: { currentVersion: true },
    orderBy: { createdAt: "asc" },
  });
  const newTypes: Array<{
    id: string;
    versionId: string;
    type: ExemplarSnapshot["activityTypes"][number];
  }> = [];
  for (const type of snapshot.activityTypes) {
    const existing = existingTypes.find(
      (row: {
        behaviorFamily: string;
        currentVersion?: { label: string; id: string };
      }) =>
        row.behaviorFamily === type.behaviorFamily &&
        row.currentVersion?.label === type.label,
    );
    const pending = newTypes.find(
      (row) =>
        row.type.behaviorFamily === type.behaviorFamily &&
        row.type.label === type.label,
    );
    if (existing) typeVersions.set(type.key, existing.currentVersion.id);
    else if (pending) typeVersions.set(type.key, pending.versionId);
    else {
      const row = { id: randomUUID(), versionId: randomUUID(), type };
      newTypes.push(row);
      typeVersions.set(type.key, row.versionId);
    }
    counts.activity_type++;
  }
  if (newTypes.length) {
    await tx.activityType.createMany({
      data: newTypes.map(({ id, type }) => ({
        id,
        instructorId: input.instructorId,
        behaviorFamily: type.behaviorFamily,
      })),
    });
    await tx.activityTypeVersion.createMany({
      data: newTypes.map(({ id, versionId, type }) => ({
        id: versionId,
        activityTypeId: id,
        revision: 1,
        label: type.label,
        description: type.description ?? null,
        changeSummary: "Imported from generic exemplar snapshot",
        createdByInstructorId: input.instructorId,
      })),
    });
    await setCurrentVersions(
      tx,
      "activity_types",
      newTypes.map(({ id, versionId }) => [id, versionId]),
    );
  }
  await tx.courseActivityTypeVersion.createMany({
    data: [...typeVersions.values()].map((activityTypeVersionId) => ({
      courseId: input.courseId,
      activityTypeVersionId,
    })),
    skipDuplicates: true,
  });

  const modules = new Map<
    string,
    {
      id: string;
      versionId: string;
      revision: number;
      topics: unknown[];
      activities: unknown[];
    }
  >();
  const existingModules = await tx.learningModule.findMany({
    where: { courseId: input.courseId },
    include: {
      currentVersion: { include: { topics: true, activities: true } },
    },
  });
  const newModules: Array<{
    id: string;
    versionId: string;
    module: ExemplarSnapshot["learningModules"][number];
    index: number;
  }> = [];
  snapshot.learningModules.forEach((module, index) => {
    if (modules.has(module.stableCode)) {
      counts.learning_module++;
      return;
    }
    const existing = existingModules.find(
      (row: { stableCode: string }) => row.stableCode === module.stableCode,
    );
    if (existing)
      modules.set(module.stableCode, {
        id: existing.id,
        versionId: existing.currentVersionId,
        revision: existing.currentVersion.revision,
        topics: existing.currentVersion.topics,
        activities: existing.currentVersion.activities,
      });
    else {
      const id = randomUUID(),
        versionId = randomUUID();
      newModules.push({ id, versionId, module, index });
      modules.set(module.stableCode, {
        id,
        versionId,
        revision: 1,
        topics: [],
        activities: [],
      });
    }
    counts.learning_module++;
  });
  if (newModules.length) {
    await tx.learningModule.createMany({
      data: newModules.map(({ id, module }) => ({
        id,
        courseId: input.courseId,
        stableCode: module.stableCode,
      })),
    });
    await tx.learningModuleVersion.createMany({
      data: newModules.map(({ id, versionId, module, index }) => ({
        id: versionId,
        learningModuleId: id,
        revision: 1,
        title: module.title,
        description: module.description ?? null,
        learningObjectives: module.objectives ?? [],
        notes: null,
        defaultSequence: index,
        changeSummary: "Imported from generic exemplar snapshot",
        createdByInstructorId: input.instructorId,
      })),
    });
    await setCurrentVersions(
      tx,
      "learning_modules",
      newModules.map(({ id, versionId }) => [id, versionId]),
    );
  }

  const topics = new Map<string, { id: string; versionId: string }>();
  const existingTopics = await tx.topic.findMany({
    where: { courseId: input.courseId },
  });
  const newTopics: Array<{
    id: string;
    versionId: string;
    topic: ExemplarSnapshot["topics"][number];
  }> = [];
  for (const topic of snapshot.topics) {
    if (topics.has(topic.stableCode)) {
      counts.topic++;
      continue;
    }
    const existing = existingTopics.find(
      (row: { stableCode: string }) => row.stableCode === topic.stableCode,
    );
    if (existing)
      topics.set(topic.stableCode, {
        id: existing.id,
        versionId: existing.currentVersionId,
      });
    else {
      const row = { id: randomUUID(), versionId: randomUUID(), topic };
      newTopics.push(row);
      topics.set(topic.stableCode, row);
    }
    counts.topic++;
  }
  if (newTopics.length) {
    await tx.topic.createMany({
      data: newTopics.map(({ id, topic }) => ({
        id,
        courseId: input.courseId,
        learningModuleId: null,
        stableCode: topic.stableCode,
      })),
    });
    await tx.topicVersion.createMany({
      data: newTopics.map(({ id, versionId, topic }) => ({
        id: versionId,
        topicId: id,
        revision: 1,
        title: topic.title,
        category: topic.category ?? null,
        description: topic.description ?? null,
        changeSummary: "Imported from generic exemplar snapshot",
        createdByInstructorId: input.instructorId,
      })),
    });
    await setCurrentVersions(
      tx,
      "topics",
      newTopics.map(({ id, versionId }) => [id, versionId]),
    );
  }

  const activities = new Map<string, { id: string; versionId: string }>();
  const existingActivities = await tx.activity.findMany({
    where: { courseId: input.courseId },
  });
  const newActivities: Array<{
    id: string;
    versionId: string;
    activity: ExemplarSnapshot["activities"][number];
    family: BehaviorFamily;
    typeVersionId: string;
  }> = [];
  for (const activity of snapshot.activities) {
    if (activities.has(activity.stableCode)) {
      counts.activity++;
      continue;
    }
    const typeVersionId = typeVersions.get(activity.typeKey);
    const family = snapshot.activityTypes.find(
      (type) => type.key === activity.typeKey,
    )?.behaviorFamily;
    if (!typeVersionId || !family)
      throw new DomainInvariantError("Activity Type not found");
    const existing = existingActivities.find(
      (row: { stableCode: string }) => row.stableCode === activity.stableCode,
    );
    if (existing)
      activities.set(activity.stableCode, {
        id: existing.id,
        versionId: existing.currentVersionId,
      });
    else {
      const row = {
        id: randomUUID(),
        versionId: randomUUID(),
        activity,
        family,
        typeVersionId,
      };
      newActivities.push(row);
      activities.set(activity.stableCode, row);
    }
    counts.activity++;
  }
  if (newActivities.length) {
    await tx.activity.createMany({
      data: newActivities.map(({ id, activity }) => ({
        id,
        courseId: input.courseId,
        stableCode: activity.stableCode,
      })),
    });
    await tx.activityVersion.createMany({
      data: newActivities.map(({ id, versionId, activity, typeVersionId }) => ({
        id: versionId,
        activityId: id,
        revision: 1,
        title: activity.title,
        summary: activity.summary ?? null,
        activityTypeVersionId: typeVersionId,
        changeSummary: "Imported from generic exemplar snapshot",
        createdByInstructorId: input.instructorId,
      })),
    });
    for (const family of ["meeting", "coursework", "assessment"] as const) {
      const rows = newActivities.filter((row) => row.family === family);
      if (!rows.length) continue;
      if (family === "meeting")
        await tx.meetingActivityVersion.createMany({
          data: rows.map(({ versionId }) => ({
            activityVersionId: versionId,
            modality: "standard",
          })),
        });
      if (family === "coursework")
        await tx.courseworkActivityVersion.createMany({
          data: rows.map(({ versionId }) => ({
            activityVersionId: versionId,
            submissionPolicy: "standard",
          })),
        });
      if (family === "assessment")
        await tx.assessmentActivityVersion.createMany({
          data: rows.map(({ versionId }) => ({
            activityVersionId: versionId,
            modality: "standard",
          })),
        });
    }
    await setCurrentVersions(
      tx,
      "activities",
      newActivities.map(({ id, versionId }) => [id, versionId]),
    );
  }

  const actionRows: Array<{
    activityVersionId: string;
    topicVersionId: string;
    action: CoverageAction;
    notes: string | null;
    provenance: ReturnType<typeof provenancePayload>;
  }> = [];
  const scopeRows: Array<{
    activityId: string;
    topicId: string;
    notes: null;
    provenance: ReturnType<typeof provenancePayload>;
  }> = [];
  const existingActions = await tx.activityVersionTopicAction.findMany({
    where: {
      activityVersionId: {
        in: [...activities.values()].map((row) => row.versionId),
      },
    },
  });
  const existingScopes = await tx.activityTopicScope.findMany({
    where: {
      activityId: { in: [...activities.values()].map((row) => row.id) },
    },
  });
  const changedActionVersions: string[] = [],
    changedScopeActivities: string[] = [];
  for (const activity of snapshot.activities) {
    const identity = activities.get(activity.stableCode)!;
    const nextActions = (activity.topicActions ?? []).map((action) => {
      const resolved = resolveTopicRef(snapshot, action.topicRef);
      if (resolved.kind !== "one")
        throw new DomainInvariantError("Ambiguous Topic reference");
      const topic = topics.get(resolved.topic.stableCode)!;
      return {
        activityVersionId: identity.versionId,
        topicVersionId: topic.versionId,
        action: action.action,
        notes: action.notes ?? null,
        provenance: provenancePayload(
          staged,
          `activities.${activity.stableCode}.topicActions.${resolved.topic.stableCode}.${action.action}`,
        ),
      };
    });
    if (
      !sameTopicActions(
        existingActions.filter(
          (row: { activityVersionId: string }) =>
            row.activityVersionId === identity.versionId,
        ),
        nextActions.map(({ topicVersionId, action, notes, provenance }) => ({
          topicVersionId,
          action,
          notes,
          provenance,
        })),
      )
    ) {
      changedActionVersions.push(identity.versionId);
      actionRows.push(...nextActions);
    }
    counts.topic_action += nextActions.length;
    const uniqueTopics = [
      ...new Set(
        (activity.topicActions ?? []).map((action) => {
          const resolved = resolveTopicRef(snapshot, action.topicRef);
          if (resolved.kind !== "one")
            throw new DomainInvariantError("Ambiguous Topic reference");
          return topics.get(resolved.topic.stableCode)!.id;
        }),
      ),
    ];
    const nextScopes = uniqueTopics.map((topicId) => ({
      activityId: identity.id,
      topicId,
      notes: null,
      provenance: provenancePayload(
        staged,
        `activities.${activity.stableCode}.topicScope.${topicId}`,
      ),
    }));
    if (
      !sameTopicScopes(
        existingScopes.filter(
          (row: { activityId: string }) => row.activityId === identity.id,
        ),
        nextScopes.map(({ topicId, notes, provenance }) => ({
          topicId,
          notes,
          provenance,
        })),
      )
    ) {
      changedScopeActivities.push(identity.id);
      scopeRows.push(...nextScopes);
    }
    counts.activity_topic_scope += uniqueTopics.length;
  }
  if (changedActionVersions.length)
    await tx.activityVersionTopicAction.deleteMany({
      where: { activityVersionId: { in: changedActionVersions } },
    });
  if (actionRows.length)
    await tx.activityVersionTopicAction.createMany({ data: actionRows });
  if (changedScopeActivities.length)
    await tx.activityTopicScope.deleteMany({
      where: { activityId: { in: changedScopeActivities } },
    });
  if (scopeRows.length)
    await tx.activityTopicScope.createMany({ data: scopeRows });

  const revisions: Array<{
    moduleId: string;
    newVersionId: string;
    revision: number;
    module: ExemplarSnapshot["learningModules"][number];
    index: number;
    activityVersions: string[];
  }> = [];
  snapshot.learningModules.forEach((module, index) => {
    const current = modules.get(module.stableCode)!;
    const activityVersions = snapshot.activities
      .filter((activity) => activity.learningModuleCode === module.stableCode)
      .map((activity) => activities.get(activity.stableCode)!.versionId);
    if (
      current.topics.length === 0 &&
      current.activities.length === activityVersions.length
    )
      return;
    revisions.push({
      moduleId: current.id,
      newVersionId: randomUUID(),
      revision: current.revision + 1,
      module,
      index,
      activityVersions,
    });
  });
  if (revisions.length) {
    await tx.learningModuleVersion.createMany({
      data: revisions.map(
        ({ moduleId, newVersionId, revision, module, index }) => ({
          id: newVersionId,
          learningModuleId: moduleId,
          revision,
          title: module.title,
          description: module.description ?? null,
          learningObjectives: module.objectives ?? [],
          notes: null,
          defaultSequence: index,
          changeSummary:
            "Attached imported exemplar Topic and Activity memberships",
          createdByInstructorId: input.instructorId,
        }),
      ),
    });
    const memberships = revisions.flatMap(
      ({ newVersionId, activityVersions }) =>
        activityVersions.map((activityVersionId, sequence) => ({
          learningModuleVersionId: newVersionId,
          activityVersionId,
          sequence,
          notes: null,
        })),
    );
    if (memberships.length)
      await tx.learningModuleVersionActivity.createMany({ data: memberships });
    await setCurrentVersions(
      tx,
      "learning_modules",
      revisions.map(({ moduleId, newVersionId }) => [moduleId, newVersionId]),
    );
  }
}
