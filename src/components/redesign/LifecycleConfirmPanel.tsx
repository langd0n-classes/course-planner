"use client";

import type { TermLifecycleTransition, TermStatus } from "@/lib/redesign-contract";

const TRANSITION_COPY: Record<
  TermLifecycleTransition,
  { heading: string; consequence: string; confirmLabel: string; tone: "warn" | "danger" | "neutral" }
> = {
  activate: {
    heading: "Activate this term?",
    consequence:
      "The term becomes active. Instructors can record in-term delivery changes as immutable revision history. " +
      "Planned content remains pinned; in-term edits create new delivered revisions without altering the plan. " +
      "You can close the term later when the semester ends.",
    confirmLabel: "Activate term",
    tone: "warn",
  },
  close: {
    heading: "Close this term?",
    consequence:
      "The term becomes closed and its delivered snapshot is preserved read-only. " +
      "No further edits can be made to delivered revisions. " +
      "You can reopen the term to resume recording if needed.",
    confirmLabel: "Close term",
    tone: "danger",
  },
  reopen: {
    heading: "Reopen this term?",
    consequence:
      "The term becomes active again. Delivery change recording resumes. " +
      "The preserved delivered snapshot remains intact; new revisions extend the history forward.",
    confirmLabel: "Reopen term",
    tone: "neutral",
  },
};

type Props = {
  transition: TermLifecycleTransition;
  expectedStatus: TermStatus;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function LifecycleConfirmPanel({ transition, busy, onConfirm, onCancel }: Props) {
  const copy = TRANSITION_COPY[transition];

  const borderColor =
    copy.tone === "danger"
      ? "border-rose-200 bg-rose-50"
      : copy.tone === "warn"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-slate-50";

  const headingColor =
    copy.tone === "danger"
      ? "text-rose-900"
      : copy.tone === "warn"
        ? "text-amber-900"
        : "text-slate-900";

  const bodyColor =
    copy.tone === "danger" ? "text-rose-800" : copy.tone === "warn" ? "text-amber-800" : "text-slate-700";

  const confirmBg =
    copy.tone === "danger"
      ? "bg-rose-700 hover:bg-rose-800 disabled:bg-rose-300"
      : copy.tone === "warn"
        ? "bg-amber-700 hover:bg-amber-800 disabled:bg-amber-300"
        : "bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400";

  return (
    <div className={`mt-4 rounded-2xl border p-5 ${borderColor}`}>
      <h3 className={`text-base font-semibold ${headingColor}`}>{copy.heading}</h3>
      <p className={`mt-2 text-sm ${bodyColor}`}>{copy.consequence}</p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed ${confirmBg}`}
        >
          {busy ? "Updating..." : copy.confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
