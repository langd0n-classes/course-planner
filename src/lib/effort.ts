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

export type EffortPart = EffortRange & {
  sequence: number;
  label: string;
  partKindId?: string | null;
  note?: string | null;
};
type EffortDetail = EffortFields & { behaviorFamily: string };

// Only effort is inherited; other version inputs keep replacement semantics.
export function activityEffortDraft<T extends EffortDetail>(
  detail: T,
  parts?: EffortPart[],
  source?: { detail: EffortDetail; parts?: EffortPart[] },
) {
  if (detail.behaviorFamily === "meeting") return { detail, parts: [] };
  if ((detail.effortMinMinutes === undefined) !== (detail.effortMaxMinutes === undefined))
    throw new Error("Set both effort bounds.");
  const hasBounds =
    detail.effortMinMinutes !== undefined ||
    detail.effortMaxMinutes !== undefined;
  if (source?.parts?.length && parts === undefined && hasBounds)
    throw new Error(
      "This estimate is built from parts. Change the parts, or remove them.",
    );
  const inherited =
    source?.detail.behaviorFamily === "meeting" ? undefined : source?.detail;
  return {
    detail: {
      ...detail,
      effortMinMinutes:
        !hasBounds && !parts?.length
          ? inherited?.effortMinMinutes
          : detail.effortMinMinutes,
      effortMaxMinutes:
        !hasBounds && !parts?.length
          ? inherited?.effortMaxMinutes
          : detail.effortMaxMinutes,
    },
    parts: parts ?? source?.parts ?? [],
  };
}

export function normalizeActivityEffort<T extends EffortDetail>(
  detail: T,
  parts: EffortPart[],
) {
  if (detail.behaviorFamily === "meeting") {
    if (
      parts.length ||
      "effortMinMinutes" in detail ||
      "effortMaxMinutes" in detail
    )
      throw new Error("Meetings do not carry student effort");
    return { detail, parts: [] };
  }
  const sequences = new Set<number>();
  const normalized = parts.map((part) => {
    if (
      !Number.isInteger(part.sequence) ||
      part.sequence < 0 ||
      sequences.has(part.sequence)
    )
      throw new Error("Part sequence must be nonnegative and unique");
    sequences.add(part.sequence);
    validateEffort(part.minMinutes, part.maxMinutes);
    if (!part.label.trim()) throw new Error("A label is required");
    return {
      sequence: part.sequence,
      label: part.label.trim(),
      partKindId: part.partKindId ?? null,
      minMinutes: part.minMinutes,
      maxMinutes: part.maxMinutes,
      note: part.note ?? null,
    };
  });
  const explicit = validateEffort(
    detail.effortMinMinutes,
    detail.effortMaxMinutes,
  );
  const range = normalized.length ? sumEffortParts(normalized) : explicit;
  if (
    normalized.length &&
    (detail.effortMinMinutes !== undefined ||
      detail.effortMaxMinutes !== undefined) &&
    (explicit?.minMinutes !== range?.minMinutes ||
      explicit?.maxMinutes !== range?.maxMinutes)
  )
    throw new Error("The estimate must equal the sum of its parts.");
  return {
    detail: {
      ...detail,
      effortMinMinutes: range?.minMinutes ?? null,
      effortMaxMinutes: range?.maxMinutes ?? null,
    },
    parts: normalized,
  };
}

export function keepEffortOverride<T extends EffortDetail>(
  detail: T,
  current?: EffortFields | null,
): T {
  if (detail.behaviorFamily === "meeting") return detail;
  return {
    ...detail,
    effortMinMinutes:
      detail.effortMinMinutes === undefined
        ? (current?.effortMinMinutes ?? null)
        : detail.effortMinMinutes,
    effortMaxMinutes:
      detail.effortMaxMinutes === undefined
        ? (current?.effortMaxMinutes ?? null)
        : detail.effortMaxMinutes,
  };
}
