"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import type { Activity, Milestone, MilestoneRole } from "@/lib/b2r-prototype-fixture";

const ROLE_ORDER: MilestoneRole[] = ["released", "work-time", "phase-released", "review", "due"];

const ROLE_META: Record<MilestoneRole, { label: string; tone: string }> = {
  released: {
    label: "Released",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  "work-time": {
    label: "Work time",
    tone: "border-sky-200 bg-sky-50 text-sky-800",
  },
  "phase-released": {
    label: "Phase released",
    tone: "border-violet-200 bg-violet-50 text-violet-800",
  },
  review: {
    label: "Review",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
  due: {
    label: "Due",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
  },
};

type PlacementMode = "meeting" | "date";

export interface MilestoneDraft {
  role: MilestoneRole;
  label: string;
  linkedActivityId: string | null;
  date: string | null;
  time?: string | null;
}

export interface MilestoneEditorProps {
  activity: Activity;
  meetingActivities: Activity[];
  onAdd: (draft: MilestoneDraft) => void | Promise<void>;
  onRemove: (milestoneId: string) => void | Promise<void>;
}

function formatIsoDate(value: string): string {
  const [year, month, day] = value.split("-");
  const monthIndex = Number(month) - 1;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (!year || !month || !day || monthIndex < 0 || monthIndex >= monthNames.length) {
    return value;
  }

  return `${monthNames[monthIndex]} ${Number(day)}, ${year}`;
}

function formatDateTime(date: string, time?: string | null): string {
  return time ? `${formatIsoDate(date)} · ${time}` : formatIsoDate(date);
}

function sortMilestones(a: Milestone, b: Milestone): number {
  const roleDiff = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
  if (roleDiff !== 0) return roleDiff;

  const labelDiff = a.label.localeCompare(b.label);
  if (labelDiff !== 0) return labelDiff;

  return (a.date ?? "").localeCompare(b.date ?? "");
}

function sortMeetings(a: Activity, b: Activity): number {
  const dateDiff = (a.date ?? "").localeCompare(b.date ?? "");
  if (dateDiff !== 0) return dateDiff;

  const ordinalDiff = (a.ordinal ?? Number.MAX_SAFE_INTEGER) - (b.ordinal ?? Number.MAX_SAFE_INTEGER);
  if (ordinalDiff !== 0) return ordinalDiff;

  return a.title.localeCompare(b.title);
}

export default function MilestoneEditor({ activity, meetingActivities, onAdd, onRemove }: MilestoneEditorProps) {
  const sortedMeetings = useMemo(
    () => meetingActivities.filter((meeting) => meeting.kind === "meeting").sort(sortMeetings),
    [meetingActivities],
  );
  const sortedMilestones = useMemo(() => [...activity.milestones].sort(sortMilestones), [activity.milestones]);
  const meetingMap = useMemo(() => new Map(sortedMeetings.map((meeting) => [meeting.id, meeting])), [sortedMeetings]);

  const [role, setRole] = useState<MilestoneRole>("due");
  const [label, setLabel] = useState("");
  const [placementMode, setPlacementMode] = useState<PlacementMode>(sortedMeetings.length > 0 ? "meeting" : "date");
  const [linkedActivityId, setLinkedActivityId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const trimmedLabel = label.trim();
  const canSubmit =
    trimmedLabel.length > 0 &&
    (placementMode === "meeting" ? linkedActivityId.trim().length > 0 : date.trim().length > 0);

  const listLabel = `Existing milestones for ${activity.title}`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    const draft: MilestoneDraft = {
      role,
      label: trimmedLabel,
      linkedActivityId: placementMode === "meeting" ? linkedActivityId : null,
      date: placementMode === "date" ? date : null,
      time: placementMode === "date" && time.trim().length > 0 ? time : null,
    };

    void onAdd(draft);

    setLabel("");
    setDate("");
    setTime("");
    setLinkedActivityId("");
    setPlacementMode(sortedMeetings.length > 0 ? "meeting" : "date");
  }

  function handlePlacementMode(nextMode: PlacementMode) {
    setPlacementMode(nextMode);
    if (nextMode === "meeting") {
      setDate("");
      setTime("");
    } else {
      setLinkedActivityId("");
    }
  }

  return (
    <section
      aria-label={`Milestone editor for ${activity.title}`}
      className="rounded border border-[--color-line] bg-[--color-surface] px-3 py-3 text-[--color-ink]"
    >
      <header className="flex flex-col gap-2 border-b border-[--color-line] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[--color-ink-faint]">
            Cross-cutting project ledger
          </span>
          <span className="rounded border border-[--color-line] bg-[--color-paper-inset] px-1.5 py-0.5 text-[10px] font-mono text-[--color-ink-muted]">
            LM-independent
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-[--color-ink]">{activity.title}</h2>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[--color-ink-faint]">
            {activity.milestones.length} milestone{activity.milestones.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="text-xs leading-5 text-[--color-ink-muted]">
          Attach release, work-time, review, phase-release, or due milestones to the project, either by meeting or
          by exact date.
        </p>
      </header>

      <div className="mt-3 grid gap-3">
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[--color-ink-faint]">
              Existing milestones
            </h3>
            <span className="text-[10px] text-[--color-ink-faint]">
              {activity.milestones.length === 0 ? "Nothing pinned yet" : "Sorted by role"}
            </span>
          </div>

          {sortedMilestones.length === 0 ? (
            <p className="rounded border border-dashed border-[--color-line] bg-[--color-paper-inset] px-2 py-2 text-xs italic text-[--color-ink-muted]">
              No milestones yet. Add the first release, review, or due marker below.
            </p>
          ) : (
            <ul aria-label={listLabel} className="grid gap-1">
              {sortedMilestones.map((milestone) => {
                const linkedMeeting = milestone.linkedActivityId
                  ? meetingMap.get(milestone.linkedActivityId)
                  : null;

                const summary = linkedMeeting
                  ? `Pinned to ${linkedMeeting.title}${linkedMeeting.date ? ` · ${formatIsoDate(linkedMeeting.date)}` : ""}`
                  : milestone.date
                    ? `Exact date ${formatDateTime(milestone.date, milestone.time)}`
                    : "Standalone milestone";

                return (
                  <li
                    key={milestone.id}
                    aria-label={`Milestone ${ROLE_META[milestone.role].label} ${milestone.label}`}
                    className="grid gap-2 border border-[--color-line] bg-[--color-paper-inset] px-2 py-1.5 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none ${ROLE_META[milestone.role].tone}`}
                      >
                        {ROLE_META[milestone.role].label}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-[--color-ink]">{milestone.label}</div>
                      <div className="truncate text-[10px] text-[--color-ink-muted]">{summary}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void onRemove(milestone.id)}
                      aria-label={`Remove ${ROLE_META[milestone.role].label.toLowerCase()} milestone ${milestone.label}`}
                      className="justify-self-start rounded border border-transparent px-1.5 py-0.5 text-[10px] text-[--color-ink-muted] hover:border-[--color-line] hover:text-rose-700"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form onSubmit={handleSubmit} className="grid gap-3 border-t border-[--color-line] pt-3">
          <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <label className="grid gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint]">
                Milestone role
              </span>
              <select
                aria-label="Milestone role"
                value={role}
                onChange={(event) => setRole(event.target.value as MilestoneRole)}
                className="min-h-9 w-full border border-[--color-line] bg-[--color-surface] px-2 py-1.5 text-sm text-[--color-ink]"
              >
                {ROLE_ORDER.map((item) => (
                  <option key={item} value={item}>
                    {ROLE_META[item].label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint]">
                Label
              </span>
              <input
                aria-label="Milestone label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. Draft ready"
                className="min-h-9 w-full border border-[--color-line] bg-[--color-surface] px-2 py-1.5 text-sm text-[--color-ink] placeholder:text-[--color-ink-faint]"
              />
            </label>
          </div>

          <fieldset className="grid gap-2 rounded border border-[--color-line] bg-[--color-paper-inset] p-2">
            <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint]">
              Placement
            </legend>

            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer gap-2 rounded border px-2 py-2 text-xs ${
                  placementMode === "meeting"
                    ? "border-[--color-accent] bg-[--color-surface] text-[--color-ink]"
                    : "border-[--color-line] bg-[--color-paper] text-[--color-ink-soft]"
                }`}
              >
                <input
                  type="radio"
                  name={`milestone-placement-${activity.id}`}
                  checked={placementMode === "meeting"}
                  onChange={() => handlePlacementMode("meeting")}
                  className="mt-0.5 shrink-0"
                />
                <span className="grid gap-0.5">
                  <span className="font-medium">Pin to meeting</span>
                  <span className="text-[10px] text-[--color-ink-muted]">
                    Attach this milestone to a specific scheduled meeting.
                  </span>
                </span>
              </label>

              <label
                className={`flex cursor-pointer gap-2 rounded border px-2 py-2 text-xs ${
                  placementMode === "date"
                    ? "border-[--color-accent] bg-[--color-surface] text-[--color-ink]"
                    : "border-[--color-line] bg-[--color-paper] text-[--color-ink-soft]"
                }`}
              >
                <input
                  type="radio"
                  name={`milestone-placement-${activity.id}`}
                  checked={placementMode === "date"}
                  onChange={() => handlePlacementMode("date")}
                  className="mt-0.5 shrink-0"
                />
                <span className="grid gap-0.5">
                  <span className="font-medium">Use exact date</span>
                  <span className="text-[10px] text-[--color-ink-muted]">
                    Set a calendar date, with optional time, independent of any meeting.
                  </span>
                </span>
              </label>
            </div>

            {placementMode === "meeting" ? (
              <div className="grid gap-1">
                <label className="grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint]">
                    Meeting
                  </span>
                  <select
                    aria-label="Meeting"
                    value={linkedActivityId}
                    onChange={(event) => setLinkedActivityId(event.target.value)}
                    className="min-h-9 w-full border border-[--color-line] bg-[--color-surface] px-2 py-1.5 text-sm text-[--color-ink]"
                  >
                    <option value="">Choose a meeting</option>
                    {sortedMeetings.map((meeting) => (
                      <option key={meeting.id} value={meeting.id}>
                        {meeting.title}
                        {meeting.date ? ` · ${formatIsoDate(meeting.date)}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[10px] text-[--color-ink-muted]">
                  The milestone inherits the selected meeting&apos;s schedule.
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <label className="grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint]">
                    Date
                  </span>
                  <input
                    aria-label="Date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="min-h-9 w-full border border-[--color-line] bg-[--color-surface] px-2 py-1.5 text-sm text-[--color-ink]"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint]">
                    Time
                  </span>
                  <input
                    aria-label="Time"
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    className="min-h-9 w-full border border-[--color-line] bg-[--color-surface] px-2 py-1.5 text-sm text-[--color-ink]"
                  />
                </label>
              </div>
            )}
          </fieldset>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] text-[--color-ink-muted]">
              Meeting-linked milestones stay tied to the meeting; exact-date milestones stay independent.
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded border border-[--color-accent] bg-[--color-accent] px-2.5 py-1.5 text-xs font-medium text-white disabled:border-[--color-line] disabled:bg-[--color-paper-inset] disabled:text-[--color-ink-faint]"
            >
              Add milestone
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
