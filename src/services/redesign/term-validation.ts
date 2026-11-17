import { ConcurrencyConflictError, DomainInvariantError } from "./errors";
import type { RedesignTx } from "./types";

function termDate(value: Date | string, field: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()) ||
      (typeof value === "string" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || date.toISOString().slice(0, 10) !== value))) {
    throw new DomainInvariantError(`Term ${field} must be a real calendar date`);
  }
  return date;
}

export function validateTermDates(start: Date | string, end: Date | string) {
  const startDate = termDate(start, "startDate");
  const endDate = termDate(end, "endDate");
  const days = (endDate.getTime() - startDate.getTime()) / 86_400_000;
  if (days <= 0) throw new DomainInvariantError("Term end date must be after the start date");
  if (days > 400) throw new DomainInvariantError("A Term cannot be longer than 400 days");
  return { startDate, endDate };
}

export async function assertTermCodeAvailable(tx: RedesignTx, courseId: string, code: string, termId?: string) {
  const existing = await tx.term.findUnique({ where: { courseId_code: { courseId, code } } });
  if (existing && existing.id !== termId) throw termCodeConflict(code);
}

function termCodeConflict(code: string) {
  return new ConcurrencyConflictError(`The Course already uses Term code "${code}"`);
}

export function rethrowTermWriteError(error: unknown, code: string): never {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
    throw termCodeConflict(code);
  }
  throw error;
}
