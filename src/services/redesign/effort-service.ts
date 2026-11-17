import { validateEffort, sumEffortParts } from "@/lib/effort";
import { DomainInvariantError } from "./errors";
import { getOwnedCourseForInstructor } from "./ownership-service";
import type {
  ActivityDetailDraft,
  EffortPartDraft,
  RedesignDb,
  RedesignTx,
} from "./types";

export type CourseEffortKind = "sizes" | "part-kinds";
type VocabularyInput = {
  label: string;
  minMinutes?: number;
  maxMinutes?: number;
};
const delegate = (tx: RedesignTx, kind: CourseEffortKind) =>
  kind === "sizes" ? tx.courseEffortSize : tx.courseEffortPartKind;
const whereCourse = (courseId: string, kind: CourseEffortKind) =>
  kind === "sizes" ? { courseId, scale: "student" } : { courseId };

function label(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new DomainInvariantError("A label is required");
  return trimmed;
}
export function assertEffort(low?: number | null, high?: number | null) {
  try {
    return validateEffort(low, high);
  } catch (error) {
    throw new DomainInvariantError((error as Error).message);
  }
}
function vocabularyData(kind: CourseEffortKind, input: VocabularyInput) {
  if (kind === "part-kinds") return { label: label(input.label) };
  const range = assertEffort(input.minMinutes, input.maxMinutes);
  if (!range)
    throw new DomainInvariantError("A size requires both effort bounds");
  return { label: label(input.label), ...range };
}
async function uniqueWrite<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    )
      throw new DomainInvariantError("Label already exists in this Course");
    throw error;
  }
}
export async function listCourseEffort(
  db: RedesignDb,
  instructorId: string,
  courseId: string,
  kind: CourseEffortKind,
) {
  return db.$transaction(async (tx) => {
    await getOwnedCourseForInstructor(tx, instructorId, courseId);
    return delegate(tx, kind).findMany({
      where: whereCourse(courseId, kind),
      orderBy: [{ sequence: "asc" }, { id: "asc" }],
    });
  });
}
export async function createCourseEffort(
  db: RedesignDb,
  instructorId: string,
  courseId: string,
  kind: CourseEffortKind,
  input: VocabularyInput,
) {
  return uniqueWrite(() =>
    db.$transaction(async (tx) => {
      await getOwnedCourseForInstructor(tx, instructorId, courseId);
      const rows = await delegate(tx, kind).findMany({
        where: whereCourse(courseId, kind),
      });
      const sequence =
        rows.reduce(
          (max: number, row: { sequence: number }) =>
            Math.max(max, row.sequence),
          -1,
        ) + 1;
      return delegate(tx, kind).create({
        data: {
          ...whereCourse(courseId, kind),
          ...vocabularyData(kind, input),
          sequence,
        },
      });
    }),
  );
}
export async function updateCourseEffort(
  db: RedesignDb,
  instructorId: string,
  courseId: string,
  kind: CourseEffortKind,
  id: string,
  input: VocabularyInput,
) {
  return uniqueWrite(() =>
    db.$transaction(async (tx) => {
      await getOwnedCourseForInstructor(tx, instructorId, courseId);
      if (
        !(await delegate(tx, kind).findFirst({
          where: { id, ...whereCourse(courseId, kind) },
        }))
      )
        throw new DomainInvariantError("Effort entry not found");
      return delegate(tx, kind).update({
        where: { id },
        data: vocabularyData(kind, input),
      });
    }),
  );
}
export async function deleteCourseEffort(
  db: RedesignDb,
  instructorId: string,
  courseId: string,
  kind: CourseEffortKind,
  id: string,
) {
  return db.$transaction(async (tx) => {
    await getOwnedCourseForInstructor(tx, instructorId, courseId);
    if (
      !(await delegate(tx, kind).findFirst({
        where: { id, ...whereCourse(courseId, kind) },
      }))
    )
      throw new DomainInvariantError("Effort entry not found");
    await delegate(tx, kind).delete({ where: { id } });
  });
}
export async function reorderCourseEffort(
  db: RedesignDb,
  instructorId: string,
  courseId: string,
  kind: CourseEffortKind,
  ids: string[],
) {
  return db.$transaction(async (tx) => {
    await getOwnedCourseForInstructor(tx, instructorId, courseId);
    const rows: { id: string }[] = await delegate(tx, kind).findMany({
      where: whereCourse(courseId, kind),
    });
    if (
      ids.length !== rows.length ||
      new Set(ids).size !== ids.length ||
      rows.some((row) => !ids.includes(row.id))
    )
      throw new DomainInvariantError(
        "Reorder must include every entry exactly once",
      );
    for (const [sequence, id] of ids.entries())
      await delegate(tx, kind).update({ where: { id }, data: { sequence } });
    return delegate(tx, kind).findMany({
      where: whereCourse(courseId, kind),
      orderBy: [{ sequence: "asc" }, { id: "asc" }],
    });
  });
}

export async function normalizeActivityEffort(
  tx: RedesignTx,
  courseId: string,
  detail: ActivityDetailDraft,
  parts: EffortPartDraft[],
) {
  if (detail.behaviorFamily === "meeting") {
    if (
      parts.length ||
      "effortMinMinutes" in detail ||
      "effortMaxMinutes" in detail
    )
      throw new DomainInvariantError("Meetings do not carry student effort");
    return { detail, parts: [] };
  }
  const sequences = new Set<number>();
  const normalized = [];
  for (const part of parts) {
    if (
      !Number.isInteger(part.sequence) ||
      part.sequence < 0 ||
      sequences.has(part.sequence)
    )
      throw new DomainInvariantError(
        "Part sequence must be nonnegative and unique",
      );
    sequences.add(part.sequence);
    assertEffort(part.minMinutes, part.maxMinutes);
    if (
      part.partKindId &&
      !(await tx.courseEffortPartKind.findFirst({
        where: { id: part.partKindId, courseId },
      }))
    )
      throw new DomainInvariantError("Part kind not found in this Course");
    normalized.push({
      sequence: part.sequence,
      label: label(part.label),
      partKindId: part.partKindId ?? null,
      minMinutes: part.minMinutes,
      maxMinutes: part.maxMinutes,
      note: part.note ?? null,
    });
  }
  let range;
  try {
    range = normalized.length
      ? sumEffortParts(normalized)
      : assertEffort(detail.effortMinMinutes, detail.effortMaxMinutes);
  } catch (error) {
    throw new DomainInvariantError((error as Error).message);
  }
  return {
    detail: {
      ...detail,
      effortMinMinutes: range?.minMinutes ?? null,
      effortMaxMinutes: range?.maxMinutes ?? null,
    },
    parts: normalized,
  };
}
