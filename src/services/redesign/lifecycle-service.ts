import { ConcurrencyConflictError, DomainInvariantError } from "./errors";
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
    termId: string;
    transition: TermLifecycleTransition;
    expectedStatus: TermStatus;
  },
) {
  return db.$transaction(async (tx) => {
    const term = await tx.term.findUnique({ where: { id: input.termId } });
    if (!term) throw new DomainInvariantError("Term not found");

    const edge = ALLOWED_TRANSITIONS[input.transition];
    if (term.status !== input.expectedStatus) {
      throw new ConcurrencyConflictError("Term status changed while this transition was in progress");
    }
    if (term.status !== edge.from) {
      throw new DomainInvariantError(
        `Cannot ${input.transition} a Term in status "${term.status}" (expected "${edge.from}")`,
      );
    }

    return tx.term.update({
      where: { id: term.id },
      data: {
        status: edge.to,
        closedAt: edge.to === "closed" ? new Date() : null,
      },
    });
  });
}
