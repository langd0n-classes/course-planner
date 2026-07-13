import { ConcurrencyConflictError, DomainInvariantError } from "./errors";
import { getOwnedTermForInstructor } from "./ownership-service";
import type { RedesignDb } from "./types";

export type TermStatus = "planned" | "active" | "closed";
export type TermLifecycleTransition = "activate" | "close" | "reopen";

// planned -> active (activate), active -> closed (close), closed -> active
// (reopen, an explicit un-close). There is no direct planned -> closed or
// closed -> planned edge: an instructor must reopen before returning to
// planning, and a Term must be activated before it can be closed.
const ALLOWED_TRANSITIONS: Record<TermLifecycleTransition, { from: TermStatus; to: TermStatus }> = {
  activate: { from: "planned", to: "active" },
  close: { from: "active", to: "closed" },
  reopen: { from: "closed", to: "active" },
};

export async function transitionTermLifecycle(
  db: RedesignDb,
  input: {
    instructorId: string;
    termId: string;
    transition: TermLifecycleTransition;
    expectedStatus: TermStatus;
  },
) {
  return db.$transaction(async (tx) => {
    const term = await getOwnedTermForInstructor(tx, input.instructorId, input.termId);

    const edge = ALLOWED_TRANSITIONS[input.transition];
    if (term.status !== input.expectedStatus) {
      throw new ConcurrencyConflictError("Term status changed while this transition was in progress");
    }
    if (term.status !== edge.from) {
      throw new DomainInvariantError(
        `Cannot ${input.transition} a Term in status "${term.status}" (expected "${edge.from}")`,
      );
    }

    const closedAt = edge.to === "closed" ? new Date() : null;
    const result = await tx.term.updateMany({
      where: { id: term.id, status: input.expectedStatus },
      data: {
        status: edge.to,
        closedAt,
      },
    });
    if (result.count !== 1) {
      throw new ConcurrencyConflictError("Term status changed while this transition was in progress");
    }

    return { ...term, status: edge.to, closedAt };
  });
}
