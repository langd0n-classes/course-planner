"use client";

import { useEffect, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  DefaultMeetingTimeDto,
  MeetingPlacementPreviewResponse,
} from "@/lib/redesign-contract";

type Props = { termId: string; onApplied: () => void | Promise<void> };
const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const buttonClass =
  "rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50";
export default function PlaceMeetingsPanel({ termId, onApplied }: Props) {
  const [preview, setPreview] =
    useState<MeetingPlacementPreviewResponse | null>(null);
  const [needsTime, setNeedsTime] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [zone, setZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const [previewTime, setPreviewTime] = useState<DefaultMeetingTimeDto | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    redesignApi
      .previewMeetingPlacement(termId, { defaultMeetingTime: null })
      .then((result) => {
        if (!active) return;
        setPreview(result);
        setNeedsTime(result.missingMeetingTime);
        setFresh(true);
        setBusy(false);
      })
      .catch((caught) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to preview meetings.",
        );
        setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [termId]);
  async function previewAgain(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFresh(false);
    const defaultMeetingTime = needsTime
      ? { startTimeLocal: start, endTimeLocal: end || null, timeZone: zone }
      : null;
    try {
      const result = await redesignApi.previewMeetingPlacement(termId, {
        defaultMeetingTime,
      });
      setPreview(result);
      setPreviewTime(defaultMeetingTime);
      setNeedsTime(needsTime || result.missingMeetingTime);
      setFresh(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to preview meetings.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!preview || !fresh) return;
    setBusy(true);
    setError(null);
    try {
      await redesignApi.applyMeetingPlacement(termId, {
        defaultMeetingTime: previewTime,
        previewToken: preview.previewToken,
      });
      setFresh(false);
      await onApplied();
    } catch (caught) {
      setFresh(false);
      setError(
        typeof caught === "object" &&
          caught !== null &&
          "status" in caught &&
          caught.status === 409
          ? "The Term changed. Preview again."
          : caught instanceof Error
            ? caught.message
            : "Unable to place meetings.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-labelledby="place-meetings-heading"
      className="mt-4 space-y-4 border-t border-slate-200 pt-4"
      aria-busy={busy}
    >
      <h2
        id="place-meetings-heading"
        className="text-lg font-semibold text-slate-900"
      >
        Place meetings on the calendar
      </h2>
      <form onSubmit={previewAgain} className="space-y-4">
        {needsTime ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm text-slate-700">
              Start time
              <input
                className={fieldClass}
                type="time"
                required
                value={start}
                disabled={busy}
                onChange={(e) => {
                  setStart(e.target.value);
                  setFresh(false);
                }}
              />
            </label>
            <label className="text-sm text-slate-700">
              End time (optional)
              <input
                className={fieldClass}
                type="time"
                value={end}
                disabled={busy}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setFresh(false);
                }}
              />
            </label>
            <label className="text-sm text-slate-700">
              Time zone
              <input
                className={fieldClass}
                required
                placeholder="America/New_York"
                value={zone}
                disabled={busy}
                onChange={(e) => {
                  setZone(e.target.value);
                  setFresh(false);
                }}
              />
            </label>
          </div>
        ) : null}
        <button
          className="text-sm font-medium text-sky-800 underline disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          Preview again
        </button>
      </form>
      {busy ? (
        <p role="status" className="text-sm text-slate-600">
          Working…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {preview ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p>{preview.alreadyDatedCount} meeting(s) already dated.</p>
          <h3 className="font-medium text-slate-900">
            Meetings to place ({preview.placements.length})
          </h3>
          {preview.placements.length ? (
            <ol className="divide-y divide-slate-100">
              {[...preview.placements]
                .sort(
                  (a, b) =>
                    a.date.localeCompare(b.date) ||
                    a.startsAt.localeCompare(b.startsAt),
                )
                .map((p) => (
                  <li key={p.termActivityId} className="py-2">
                    {p.date} · {p.adoptedLabel} ·{" "}
                    {new Intl.DateTimeFormat(undefined, {
                      timeZone: p.timeZone,
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                    }).format(new Date(p.startsAt))}
                    {p.endsAt
                      ? `–${new Intl.DateTimeFormat(undefined, { timeZone: p.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(p.endsAt))}`
                      : ""}{" "}
                    ({p.timeZone})
                  </li>
                ))}
            </ol>
          ) : (
            <p>No meetings ready to place.</p>
          )}
          {preview.unplacedMeetings.length ? (
            <>
              <h3 className="font-medium text-slate-900">
                Meetings not placed
              </h3>
              <ul>
                {preview.unplacedMeetings.map((m) => (
                  <li key={m.termActivityId}>
                    {m.adoptedLabel}:{" "}
                    {m.reason === "no_learning_module"
                      ? "No Learning Module assigned"
                      : "No class day left"}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {preview.emptySlots.length ? (
            <>
              <h3 className="font-medium text-slate-900">Empty class days</h3>
              <ul>
                {preview.emptySlots.map((s) => (
                  <li key={s.calendarSlotId}>{s.date}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
      <button
        className={buttonClass}
        type="button"
        disabled={
          busy ||
          !fresh ||
          !preview?.placements.length ||
          preview.missingMeetingTime
        }
        onClick={apply}
      >
        Apply
      </button>
    </section>
  );
}
