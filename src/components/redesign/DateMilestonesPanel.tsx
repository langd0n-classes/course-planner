"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  MilestoneDatingPreviewResponse,
  MilestoneDatingReason,
} from "@/lib/redesign-contract";

const reasons: Record<MilestoneDatingReason, string> = {
  linked_meeting_undated: "The linked meeting has no date.",
  linked_activity_not_a_meeting: "The linked Activity is not a meeting.",
  no_template: "The source template is missing.",
  no_default_time: "The template has no default time.",
  no_time_zone: "The template has no time zone.",
  local_time_does_not_exist:
    "This local time does not exist because the clocks move forward. Change the template time and preview again.",
};
type Props = {
  termId: string;
  timeZone: string | null;
  onApplied: () => void | Promise<void>;
};
export default function DateMilestonesPanel({
  termId,
  timeZone,
  onApplied,
}: Props) {
  const headingId = useId();
  const [preview, setPreview] = useState<MilestoneDatingPreviewResponse | null>(
    null,
  );
  const [busy, setBusy] = useState(true);
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const applying = useRef(false);
  const generation = useRef({ value: 0 });
  const load = useCallback(async () => {
    const request = ++generation.current.value;
    setBusy(true);
    setError(null);
    setFresh(false);
    try {
      const result = await redesignApi.previewMilestoneDating(termId, {});
      if (request !== generation.current.value) return;
      setPreview(result);
      setFresh(true);
    } catch (caught) {
      if (request === generation.current.value)
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to preview milestones.",
        );
    } finally {
      if (request === generation.current.value) setBusy(false);
    }
  }, [termId]);
  useEffect(() => {
    const requests = generation.current;
    void load();
    return () => {
      requests.value++;
    };
  }, [load]);
  async function apply() {
    if (applying.current || busy || !fresh || !preview) return;
    applying.current = true;
    setBusy(true);
    setError(null);
    setFresh(false);
    try {
      await redesignApi.applyMilestoneDating(termId, {
        previewToken: preview.previewToken,
      });
      await onApplied();
    } catch (caught) {
      setError(
        typeof caught === "object" &&
          caught !== null &&
          "status" in caught &&
          caught.status === 409
          ? "The Term changed. Preview again."
          : caught instanceof Error
            ? caught.message
            : "Unable to date milestones.",
      );
    } finally {
      applying.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={busy}
      className="mt-4 space-y-4 border-t border-slate-200 pt-4 text-sm text-slate-700"
    >
      <h2 id={headingId} className="text-lg font-semibold text-slate-900">
        Date milestones
      </h2>
      <p>
        Moving a meeting later does not change a dated milestone. Edit its date
        by hand.
      </p>
      <div aria-live="polite">
        {busy
          ? "Working…"
          : preview
            ? `${preview.dates.length} milestones to date; ${preview.creates.length} to create.`
            : ""}
      </div>
      {error ? (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void load()}
        className="font-medium text-sky-800 underline disabled:opacity-50"
      >
        Preview again
      </button>
      {preview ? (
        <>
          <p>{preview.alreadyDatedCount} milestone(s) already dated.</p>
          <h3 className="font-medium text-slate-900">
            Milestones to date ({preview.dates.length})
          </h3>
          <ul className="divide-y divide-slate-100">
            {preview.dates.map((m) => {
              const zone = timeZone ?? m.timeZone;
              return (
                <li
                  key={`${m.termActivityId}:${m.milestoneId ?? m.sourceTemplateId}`}
                  className="py-2"
                >
                  {m.adoptedLabel} · {m.label} ·{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    timeZone: zone,
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                  }).format(new Date(m.occursAt))}{" "}
                  ({zone}) · follows {m.linkedMeetingLabel}
                </li>
              );
            })}
          </ul>
          <h3 className="font-medium text-slate-900">
            Milestones to create ({preview.creates.length})
          </h3>
          <ul>
            {preview.creates.map((m) => (
              <li key={`${m.termActivityId}:${m.sourceTemplateId}`}>
                {m.adoptedLabel} · {m.label} · follows {m.linkedMeetingLabel}
              </li>
            ))}
          </ul>
          {preview.undated.length ? (
            <>
              <h3 className="font-medium text-slate-900">
                Milestones that cannot be dated
              </h3>
              <ul>
                {preview.undated.map((m) => (
                  <li
                    key={`${m.termActivityId}:${m.milestoneId ?? m.sourceTemplateId}`}
                  >
                    {m.label}: {reasons[m.reason]}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {!preview.dates.length && !preview.creates.length ? (
            <p>No milestones ready to date or create.</p>
          ) : null}
        </>
      ) : null}
      <button
        type="button"
        disabled={
          busy ||
          !fresh ||
          !preview ||
          (!preview.dates.length && !preview.creates.length)
        }
        onClick={() => void apply()}
        className="rounded-lg bg-sky-700 px-4 py-2 font-medium text-white hover:bg-sky-800 disabled:opacity-50"
      >
        Apply
      </button>
    </section>
  );
}
