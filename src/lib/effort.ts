export type EffortRange = { minMinutes: number; maxMinutes: number };
export type EffortFields = {
  effortMinMinutes?: number | null;
  effortMaxMinutes?: number | null;
};

export function validateEffort(
  low: number | null | undefined,
  high: number | null | undefined,
): EffortRange | null {
  if (low == null && high == null) return null;
  if (
    low == null ||
    high == null ||
    !Number.isInteger(low) ||
    !Number.isInteger(high) ||
    low < 1 ||
    high < low ||
    high > 60000
  ) {
    throw new Error(
      "Set both effort bounds: low must be at least 1 minute, high at least low and at most 60000 minutes.",
    );
  }
  return { minMinutes: low, maxMinutes: high };
}

export function formatMinutes(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0)
    throw new Error("Minutes must be a nonnegative integer.");
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours
    ? `${hours} h${remainder ? ` ${remainder} min` : ""}`
    : `${remainder} min`;
}

export function formatEffortRange(range: EffortRange): string {
  if (range.minMinutes === range.maxMinutes)
    return formatMinutes(range.minMinutes);
  return `${range.minMinutes < 60 && range.maxMinutes < 60 ? range.minMinutes : formatMinutes(range.minMinutes)} to ${formatMinutes(range.maxMinutes)}`;
}

// Blank hours or minutes mean zero; an entirely blank input is invalid.
export function parseHoursMinutes(hours: string, minutes: string): number {
  const h = hours.trim();
  const m = minutes.trim();
  if (
    (!h && !m) ||
    (h && !/^\d+$/.test(h)) ||
    (m && !/^\d+$/.test(m)) ||
    Number(m) > 59
  )
    throw new Error("Enter whole hours and minutes (0 to 59).");
  const total = Number(h) * 60 + Number(m);
  if (!Number.isSafeInteger(total) || total > 60000)
    throw new Error("Effort must be at most 60000 minutes.");
  return total;
}

export function findEffortSize<T extends EffortRange>(
  sizes: T[],
  range: EffortRange | null,
): T | null {
  return range
    ? (sizes.find(
        (size) =>
          size.minMinutes === range.minMinutes &&
          size.maxMinutes === range.maxMinutes,
      ) ?? null)
    : null;
}

export function sumEffortParts(parts: EffortRange[]): EffortRange | null {
  if (!parts.length) return null;
  const total = parts.reduce(
    (sum, part) => {
      validateEffort(part.minMinutes, part.maxMinutes);
      return {
        minMinutes: sum.minMinutes + part.minMinutes,
        maxMinutes: sum.maxMinutes + part.maxMinutes,
      };
    },
    { minMinutes: 0, maxMinutes: 0 },
  );
  return validateEffort(total.minMinutes, total.maxMinutes);
}

export function effectiveEffort(
  base: EffortFields | null | undefined,
  revision: EffortFields | null | undefined,
): EffortRange | null {
  return (
    validateEffort(revision?.effortMinMinutes, revision?.effortMaxMinutes) ??
    validateEffort(base?.effortMinMinutes, base?.effortMaxMinutes)
  );
}
