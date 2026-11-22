"use client";

import { useId } from "react";
import type { Id } from "@/lib/redesign-contract";
import type { TermOrderResult } from "@/lib/term-order-checks";

export type TermOrderFindingsPanelProps = {
  result: TermOrderResult;
  activityLabels: Readonly<Record<Id, string>>;
};

export default function TermOrderFindingsPanel({
  result,
  activityLabels,
}: TermOrderFindingsPanelProps) {
  const headingId = useId();
  const undatedActivities = new Map<Id, number>();
  for (const item of result.undated.items) {
    undatedActivities.set(
      item.termActivityId,
      (undatedActivities.get(item.termActivityId) ?? 0) +
        (item.milestoneId === null ? 0 : 1),
    );
  }
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 text-sm text-slate-700"
    >
      <div>
        <h2 id={headingId} className="font-medium text-slate-900">
          Date order checks
        </h2>
        <p role="status" className="mt-1">
          {result.findings.length}{" "}
          {result.findings.length === 1 ? "finding" : "findings"}
        </p>
      </div>
      {result.findings.length === 0 ? (
        <p>No order problems found.</p>
      ) : (
        <ul
          role="list"
          aria-labelledby={headingId}
          className="divide-y divide-slate-200"
        >
          {result.findings.map((finding, index) => (
            <li
              key={`${finding.kind}-${finding.termActivityIds.join("-")}-${index}`}
              className="space-y-1 py-3 first:pt-0 last:pb-0"
            >
              <p>{finding.sentence}</p>
              <p>
                {finding.termActivityIds.map((id, side) =>
                  id === null ? null : (
                    <span key={side}>
                      {side > 0 ? "; " : ""}
                      {activityLabels[id] ?? id}
                      {finding.dates[side] ? (
                        <>
                          {" "}
                          (
                          <time dateTime={finding.dates[side]!}>
                            {finding.dates[side]}
                          </time>
                          )
                        </>
                      ) : null}
                    </span>
                  ),
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className={result.undated.count ? "text-amber-800" : "text-slate-600"}>
        {result.undated.count} undated{" "}
        {result.undated.count === 1
          ? "Activity or milestone"
          : "Activities or milestones"}
        .
        {result.undated.count > 0
          ? " Check is incomplete; undated items were not compared."
          : ""}
      </p>
      {undatedActivities.size > 0 && (
        <ul role="list" aria-label="Undated Activities">
          {[...undatedActivities].map(([id, count]) => (
            <li key={id}>
              {activityLabels[id] ?? id}: {count} undated{" "}
              {count === 1 ? "milestone" : "milestones"}
            </li>
          ))}
        </ul>
      )}
      {result.unmappedActionCount > 0 && (
        <p>
          {result.unmappedActionCount} Topic{" "}
          {result.unmappedActionCount === 1 ? "action could" : "actions could"}{" "}
          not be checked because the Topic version mapping is missing.
        </p>
      )}
    </section>
  );
}
