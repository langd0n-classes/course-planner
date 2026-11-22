import type { MilestoneDatingPreviewResponse } from "./redesign-contract";

export function countMilestoneDatingChanges(
  preview: Pick<MilestoneDatingPreviewResponse, "dates" | "creates">,
): number {
  return new Set(
    [...preview.dates, ...preview.creates].map((m) =>
      JSON.stringify([m.termActivityId, m.milestoneId ?? m.sourceTemplateId]),
    ),
  ).size;
}
