import { createHash } from "node:crypto";
import { createActivity } from "./activity-service";
import { createActivityType } from "./activity-type-service";
import {
  replaceActivityTopicActionsForInstructor,
  replaceActivityTopicScopeForInstructor,
} from "./activity-relationship-service";
import { DomainInvariantError } from "./errors";
import { createLearningModule, createTopic, reviseLearningModule } from "./revision-service";
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

    await db.$transaction(async (tx) => {
      const course = await tx.course.findUnique({
        where: { id_instructorId: { id: input.courseId, instructorId: input.instructorId } },
      });
      if (!course) throw new DomainInvariantError("Course not found");

      const moduleIds = new Map<string, string>();
      const moduleVersionIds = new Map<string, string>();
      const topicIds = new Map<string, string>();
      const topicVersionIds = new Map<string, string>();
      const activityTypeVersionIds = new Map<string, string>();
      const activityIds = new Map<string, string>();
      const activityVersionIds = new Map<string, string>();

      for (const type of staged.snapshot.activityTypes) {
        const version = await findOrCreateActivityTypeVersion(tx, input.instructorId, type);
        activityTypeVersionIds.set(type.key, version.id);
        await tx.courseActivityTypeVersion.upsert({
          where: {
            courseId_activityTypeVersionId: {
              courseId: input.courseId,
              activityTypeVersionId: version.id,
            },
          },
          create: { courseId: input.courseId, activityTypeVersionId: version.id },
          update: {},
        });
        counts.activity_type += 1;
      }

      for (const module of staged.snapshot.learningModules) {
        const existing = await tx.learningModule.findUnique({
          where: { courseId_stableCode: { courseId: input.courseId, stableCode: module.stableCode } },
          include: { currentVersion: true },
        });
        const created =
          existing ??
          (await createLearningModule(transactional(tx), {
            courseId: input.courseId,
            stableCode: module.stableCode,
            createdByInstructorId: input.instructorId,
            draft: {
              title: module.title,
              description: module.description,
              learningObjectives: module.objectives ?? [],
              notes: provenanceNote(staged, `learningModules.${module.stableCode}`),
              defaultSequence: staged.snapshot.learningModules.indexOf(module),
              changeSummary: "Imported from generic exemplar snapshot",
            },
          }));
        moduleIds.set(module.stableCode, created.id);
        moduleVersionIds.set(module.stableCode, created.currentVersionId);
        counts.learning_module += 1;
      }

      for (const topic of staged.snapshot.topics) {
        const learningModuleId = moduleIds.get(topic.learningModuleCode);
        if (!learningModuleId) throw new DomainInvariantError("Topic Learning Module not found");
        const existing = await tx.topic.findUnique({
          where: { courseId_stableCode: { courseId: input.courseId, stableCode: topic.stableCode } },
          include: { currentVersion: true },
        });
        const created =
          existing ??
          (await createTopic(transactional(tx), {
            courseId: input.courseId,
            learningModuleId,
            stableCode: topic.stableCode,
            createdByInstructorId: input.instructorId,
            draft: {
              title: topic.title,
              category: topic.category,
              description: withProvenanceText(topic.description, staged, `topics.${topic.stableCode}`),
              changeSummary: "Imported from generic exemplar snapshot",
            },
          }));
        topicIds.set(topic.stableCode, created.id);
        topicVersionIds.set(topic.stableCode, created.currentVersionId);
        counts.topic += 1;
      }

      for (const activity of staged.snapshot.activities) {
        const activityTypeVersionId = activityTypeVersionIds.get(activity.typeKey);
        if (!activityTypeVersionId) throw new DomainInvariantError("Activity Type not found");
        const existing = await tx.activity.findUnique({
          where: { courseId_stableCode: { courseId: input.courseId, stableCode: activity.stableCode } },
          include: { currentVersion: true },
        });
        const behaviorFamily = staged.snapshot.activityTypes.find((type) => type.key === activity.typeKey)
          ?.behaviorFamily;
        if (!behaviorFamily) throw new DomainInvariantError("Activity Type not found");
        const created =
          existing ??
          (await createActivity(transactional(tx), {
            instructorId: input.instructorId,
            courseId: input.courseId,
            stableCode: activity.stableCode,
            createdByInstructorId: input.instructorId,
            draft: {
              title: activity.title,
              summary: withProvenanceText(activity.summary, staged, `activities.${activity.stableCode}`),
              activityTypeVersionId,
              changeSummary: "Imported from generic exemplar snapshot",
              detail: defaultActivityDetail(behaviorFamily),
            },
          }));
        activityIds.set(activity.stableCode, created.id);
        activityVersionIds.set(activity.stableCode, created.currentVersionId);
        counts.activity += 1;
      }

      for (const activity of staged.snapshot.activities) {
        const activityId = activityIds.get(activity.stableCode);
        const activityVersionId = activityVersionIds.get(activity.stableCode);
        if (!activityId || !activityVersionId) throw new DomainInvariantError("Activity not found");

        const actionInputs = (activity.topicActions ?? []).map((action) => {
          const topic = resolveTopicRef(staged.snapshot, action.topicRef);
          if (topic.kind !== "one") throw new DomainInvariantError("Ambiguous Topic reference");
          const topicVersionId = topicVersionIds.get(topic.topic.stableCode);
          if (!topicVersionId) throw new DomainInvariantError("Topic version not found");
          return {
            topicVersionId,
            action: action.action,
            notes: action.notes ?? null,
            provenance: provenancePayload(staged, `activities.${activity.stableCode}.topicActions.${topic.topic.stableCode}.${action.action}`),
          };
        });
        const existingActions = await tx.activityVersionTopicAction.findMany({
          where: { activityVersionId },
        });
        if (!sameTopicActions(existingActions, actionInputs)) {
          await replaceActivityTopicActionsForInstructor(transactional(tx), {
            instructorId: input.instructorId,
            activityVersionId,
            actions: actionInputs,
          });
        }
        counts.topic_action += actionInputs.length;

        const topicScopeIds = [
          ...new Set(
            (activity.topicActions ?? []).map((action) => {
              const topic = resolveTopicRef(staged.snapshot, action.topicRef);
              if (topic.kind !== "one") throw new DomainInvariantError("Ambiguous Topic reference");
              const topicId = topicIds.get(topic.topic.stableCode);
              if (!topicId) throw new DomainInvariantError("Topic not found");
              return topicId;
            }),
          ),
        ];
        const scopeInputs = topicScopeIds.map((topicId) => ({
            topicId,
            provenance: provenancePayload(staged, `activities.${activity.stableCode}.topicScope.${topicId}`),
          }));
        const existingScopes = await tx.activityTopicScope.findMany({ where: { activityId } });
        if (!sameTopicScopes(existingScopes, scopeInputs)) {
          await replaceActivityTopicScopeForInstructor(transactional(tx), {
            instructorId: input.instructorId,
            activityId,
            scopes: scopeInputs,
          });
        }
        counts.activity_topic_scope += topicScopeIds.length;
      }

      for (const module of staged.snapshot.learningModules) {
        const moduleId = moduleIds.get(module.stableCode);
        const currentVersionId = moduleVersionIds.get(module.stableCode);
        if (!moduleId || !currentVersionId) continue;
        const existingMembership = await tx.learningModuleVersion.findUnique({
          where: { id: currentVersionId },
          include: { topics: true, activities: true },
        });
        const topics = staged.snapshot.topics
          .filter((topic) => topic.learningModuleCode === module.stableCode)
          .map((topic, index) => ({ topicVersionId: topicVersionIds.get(topic.stableCode)!, sequence: index }));
        const activities = staged.snapshot.activities
          .filter((activity) => activity.learningModuleCode === module.stableCode)
          .map((activity, index) => ({
            activityVersionId: activityVersionIds.get(activity.stableCode)!,
            sequence: index,
            notes: provenanceNote(staged, `learningModules.${module.stableCode}.activities.${activity.stableCode}`),
          }));
        if ((existingMembership?.topics.length ?? 0) === topics.length && (existingMembership?.activities.length ?? 0) === activities.length) {
          continue;
        }
        const revised = await reviseLearningModule(transactional(tx), {
          learningModuleId: moduleId,
          expectedCurrentVersionId: currentVersionId,
          createdByInstructorId: input.instructorId,
          publish: false,
          draft: {
            title: module.title,
            description: module.description,
            learningObjectives: module.objectives ?? [],
            notes: provenanceNote(staged, `learningModules.${module.stableCode}`),
            defaultSequence: staged.snapshot.learningModules.indexOf(module),
            changeSummary: "Attached imported exemplar Topic and Activity memberships",
            topics,
            activities,
          },
        });
        moduleVersionIds.set(module.stableCode, revised.id);
      }
    });

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

async function findOrCreateActivityTypeVersion(
  tx: RedesignTx,
  instructorId: string,
  type: ExemplarSnapshot["activityTypes"][number],
) {
  const existing = await tx.activityType.findFirst({
    where: { instructorId, behaviorFamily: type.behaviorFamily, currentVersion: { label: type.label } },
    include: { currentVersion: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing?.currentVersion) return existing.currentVersion;
  const created = await createActivityType(transactional(tx), {
    instructorId,
    behaviorFamily: type.behaviorFamily,
    createdByInstructorId: instructorId,
    publish: false,
    draft: {
      label: type.label,
      description: type.description ?? null,
      changeSummary: "Imported from generic exemplar snapshot",
    },
  });
  return created.currentVersion;
}

function defaultActivityDetail(behaviorFamily: BehaviorFamily) {
  if (behaviorFamily === "meeting") return { behaviorFamily, modality: "standard" };
  if (behaviorFamily === "coursework") return { behaviorFamily, submissionPolicy: "standard" };
  return { behaviorFamily, modality: "standard" };
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

function provenanceNote(staged: Pick<StagedExemplarImport, "snapshot" | "snapshotFingerprint">, path: string) {
  return `Importer provenance: ${JSON.stringify(provenancePayload(staged, path))}`;
}

function withProvenanceText(
  text: string | null | undefined,
  staged: Pick<StagedExemplarImport, "snapshot" | "snapshotFingerprint">,
  path: string,
) {
  const note = provenanceNote(staged, path);
  return text ? `${text}\n\n${note}` : note;
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

function stableJson(value: unknown) {
  return JSON.stringify(value, (_key, entry) => {
    if (!isRecord(entry)) return entry;
    return Object.fromEntries(Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)));
  });
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

function transactional(tx: RedesignTx): RedesignDb {
  return { $transaction: async <T>(fn: (inner: RedesignTx) => Promise<T>) => fn(tx) };
}
