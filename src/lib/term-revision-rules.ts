/** Delivered facts take precedence over plans. */
export function effectiveRevision<T>(revisions: { planned?: T | null; delivered?: T | null } | null | undefined): T | null {
  return revisions?.delivered ?? revisions?.planned ?? null;
}

/** Only an undelivered, unslotted and undated planned meeting can be placed. */
export function isUndatedMeeting(revisions: { delivered?: unknown; planned?: { startsAt?: Date | string | null; calendarSlotId?: string | null } | null }): boolean {
  return !revisions.delivered && Boolean(revisions.planned) && !revisions.planned?.startsAt && !revisions.planned?.calendarSlotId;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
/**
 * The calendar date of a DTO value. A date-only value is returned as written.
 * An instant is converted to its local date in `timeZone`; with no zone the
 * UTC date is used. Invalid zones throw RangeError.
 */
export function localDate(
  value: Date | string | null | undefined,
  timeZone?: string | null,
): string | null {
  if (!value) return null;
  if (value instanceof Date) value = value.toISOString();
  if (value.length <= 10) return value;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return value.slice(0, 10);
  if (!timeZone) return instant.toISOString().slice(0, 10);
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export const dateOnly = (date: Date | string): string =>
  typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
