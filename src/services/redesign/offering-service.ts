import { DomainInvariantError } from "./errors";
import { assertSameCourse } from "./invariants";
import type { RedesignDb } from "./types";

export async function adoptLearningModuleForTerm(
  db: RedesignDb,
  input: {
    termId: string;
    learningModuleId: string;
    learningModuleVersionId: string;
    sequence: number;
    notes?: string | null;
  },
) {
  return db.$transaction(async (tx) => {
    const [term, learningModule, version] = await Promise.all([
      tx.term.findUnique({ where: { id: input.termId } }),
      tx.learningModule.findUnique({ where: { id: input.learningModuleId } }),
      tx.learningModuleVersion.findUnique({
        where: { id_learningModuleId: {
          id: input.learningModuleVersionId,
          learningModuleId: input.learningModuleId,
        } },
      }),
    ]);

    if (!term || !learningModule || !version) {
      throw new DomainInvariantError("Term, Learning Module, or version not found");
    }
    assertSameCourse(term.courseId, learningModule.courseId, "Term Learning Module adoption");

    return tx.termLearningModule.create({
      data: {
        termId: term.id,
        learningModuleId: learningModule.id,
        learningModuleVersionId: version.id,
        courseId: term.courseId,
        sequence: input.sequence,
        notes: input.notes ?? null,
      },
    });
  });
}

export async function reviseDeliveredLearningModuleForTerm(
  db: RedesignDb,
  input: {
    termLearningModuleId: string;
    deliveredLearningModuleVersionId: string;
  },
) {
  return db.$transaction(async (tx) => {
    const offering = await tx.termLearningModule.findUnique({
      where: { id: input.termLearningModuleId },
    });
    if (!offering) throw new DomainInvariantError("Term Learning Module not found");

    const delivered = await tx.learningModuleVersion.findUnique({
      where: { id_learningModuleId: {
        id: input.deliveredLearningModuleVersionId,
        learningModuleId: offering.learningModuleId,
      } },
    });
    if (!delivered) {
      throw new DomainInvariantError(
        "Delivered Learning Module version must belong to the adopted Learning Module",
      );
    }

    return tx.termLearningModule.update({
      where: { id: offering.id },
      data: { deliveredLearningModuleVersionId: delivered.id },
    });
  });
}
