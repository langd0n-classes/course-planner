"use client";

import { useMemo } from "react";
import type {
  FixtureData,
  MilestoneRole,
} from "@/lib/b2r-prototype-fixture";
import { getUpcomingItems } from "@/lib/b2r-prototype-fixture";

interface Props {
  fixture: FixtureData;
}

const MILESTONE_ROLE_LABEL: Record<MilestoneRole, string> = {
  released: "Released",
  "work-time": "Work time",
  "phase-released": "Phase released",
  review: "Review",
  due: "Due",
};

const MILESTONE_COLOR: Record<MilestoneRole, string> = {
  released: "text-emerald-700 bg-emerald-50 border-emerald-200",
  "work-time": "text-sky-700 bg-sky-50 border-sky-200",
  "phase-released": "text-violet-700 bg-violet-50 border-violet-200",
  review: "text-amber-700 bg-amber-50 border-amber-200",
  due: "text-rose-700 bg-rose-50 border-rose-200",
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function formatDateTime(iso: string, time?: string | null): string {
  return time ? `${formatDate(iso)} · ${time}` : formatDate(iso);
}

function daysUntil(iso: string, from: string): number {
  const a = new Date(from + "T00:00:00Z");
  const b = new Date(iso + "T00:00:00Z");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export default function RunViewport({ fixture }: Props) {
  const { activities, learningModules, activityTypes, topicActions, topics, calendar, termExceptions, currentDate } = fixture;

  // Current meeting = most recent past/today meeting
  const currentMeeting = useMemo(() => {
    return [...activities]
      .filter((a) => a.kind === "meeting" && a.date && a.date <= currentDate)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .at(0) ?? null;
  }, [activities, currentDate]);

  // Next meeting
  const nextMeeting = useMemo(() => {
    return [...activities]
      .filter((a) => a.kind === "meeting" && a.date && a.date > currentDate)
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
      .at(0) ?? null;
  }, [activities, currentDate]);

  // Current LM
  const currentLm = useMemo(() => {
    if (!currentMeeting) return null;
    return learningModules.find((lm) => lm.id === currentMeeting.primaryLmId) ?? null;
  }, [currentMeeting, learningModules]);

  // Active topics (from current meeting)
  const activeTopicActions = useMemo(() => {
    if (!currentMeeting) return [];
    return topicActions.filter((ta) => ta.activityId === currentMeeting.id);
  }, [topicActions, currentMeeting]);

  const topicMap = new Map(topics.map((t) => [t.id, t]));

  // Next release/due milestone
  const nextMilestone = useMemo(() => {
    const all: Array<{ label: string; date: string; role: MilestoneRole; activityTitle: string; time?: string | null }> = [];
    for (const act of activities) {
      for (const ms of act.milestones) {
        const linked = activities.find((a) => a.id === ms.linkedActivityId);
        const msDate = linked?.date ?? ms.date ?? null;
        if (msDate && msDate > currentDate) {
          all.push({
            label: ms.label,
            date: msDate,
            role: ms.role,
            activityTitle: act.title,
            time: ms.linkedActivityId === null ? ms.time ?? undefined : undefined,
          });
        }
      }
    }
    return all.sort((a, b) => a.date.localeCompare(b.date)).at(0) ?? null;
  }, [activities, currentDate]);

  // What must be prepared (topics for next meeting)
  const nextMeetingTopicActions = useMemo(() => {
    if (!nextMeeting) return [];
    return topicActions.filter((ta) => ta.activityId === nextMeeting.id);
  }, [topicActions, nextMeeting]);

  // Upcoming sequence (mixed)
  const upcoming = useMemo(() => getUpcomingItems(activities, currentDate, 14), [activities, currentDate]);

  // Term exceptions relevant
  const recentExceptions = termExceptions.slice(0, 3);

  // Finals period signal
  const finalsSlots = calendar.filter((s) => s.type === "finals");
  const finalsStart = finalsSlots.at(0)?.date ?? null;

  // Recovery signal: canceled exception
  const canceledException = termExceptions.find((e) => e.kind === "canceled");

  // Next meeting type label
  const nextMeetingType = activityTypes.find((t) => t.id === nextMeeting?.typeId);

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      {/* === First viewport === */}
      <section aria-label="Current status" className="grid grid-cols-2 gap-3 lg:grid-cols-4">

        {/* Current LM */}
        <div className="col-span-2 lg:col-span-1 flex flex-col gap-1 px-3 py-2 bg-[--color-surface] border border-[--color-line] rounded">
          <span className="text-[10px] font-medium text-[--color-ink-muted] uppercase tracking-wide">
            Current module
          </span>
          {currentLm ? (
            <>
              <span className="text-sm font-semibold text-[--color-accent]">{currentLm.code}</span>
              <span className="text-xs text-[--color-ink]">{currentLm.title}</span>
              <span className="text-[10px] text-[--color-ink-muted]">{currentLm.description}</span>
            </>
          ) : (
            <span className="text-xs text-[--color-ink-muted] italic">No current module</span>
          )}
        </div>

        {/* Next meeting */}
        <div className="col-span-2 lg:col-span-1 flex flex-col gap-1 px-3 py-2 bg-[--color-surface] border border-[--color-line] rounded">
          <span className="text-[10px] font-medium text-[--color-ink-muted] uppercase tracking-wide">
            Next meeting
          </span>
          {nextMeeting ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-mono text-[--color-ink-faint]">
                  {nextMeetingType?.label?.[0]}{nextMeeting.ordinal}
                </span>
                <span className="text-xs font-semibold text-[--color-ink]">{nextMeeting.title}</span>
              </div>
              <span className="text-[10px] text-[--color-ink-soft]">{nextMeeting.date && formatDate(nextMeeting.date)}</span>
              {nextMeeting.date && (
                <span className="text-[10px] text-[--color-accent]">
                  {daysUntil(nextMeeting.date, currentDate)} days away
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-[--color-ink-muted] italic">No upcoming meetings</span>
          )}
        </div>

        {/* Active topics */}
        <div className="col-span-2 flex flex-col gap-1 px-3 py-2 bg-[--color-surface] border border-[--color-line] rounded">
          <span className="text-[10px] font-medium text-[--color-ink-muted] uppercase tracking-wide">
            Active topics {currentMeeting && `— ${currentMeeting.title}`}
          </span>
          {activeTopicActions.length === 0 ? (
            <p className="text-xs text-[--color-ink-muted] italic">No topics assigned to current meeting.</p>
          ) : (
            <ul className="flex flex-wrap gap-1">
              {activeTopicActions.map((ta) => {
                const topic = topicMap.get(ta.topicId);
                return (
                  <li
                    key={ta.id}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border bg-[--color-paper-inset] border-[--color-line] text-[--color-ink-soft]"
                  >
                    <span className="font-mono text-[--color-ink-faint]">{ta.action}</span>
                    <span>{topic?.code ?? ta.topicId}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* === Next milestone + What to prepare === */}
      <section aria-label="Upcoming work" className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Next milestone */}
        <div className="flex flex-col gap-1 px-3 py-2 bg-[--color-surface] border border-[--color-line] rounded">
          <span className="text-[10px] font-medium text-[--color-ink-muted] uppercase tracking-wide">
            Next milestone
          </span>
          {nextMilestone ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 text-[10px] rounded border font-medium leading-none ${MILESTONE_COLOR[nextMilestone.role]}`}>
                  {MILESTONE_ROLE_LABEL[nextMilestone.role]}
                </span>
                <span className="text-xs font-medium text-[--color-ink]">{nextMilestone.activityTitle}</span>
              </div>
              <span className="text-[10px] text-[--color-ink-soft]">{formatDateTime(nextMilestone.date, nextMilestone.time)}</span>
              <span className="text-[10px] text-[--color-ink-muted]">{nextMilestone.label}</span>
            </div>
          ) : (
            <p className="text-xs text-[--color-ink-muted] italic">No upcoming milestones.</p>
          )}
        </div>

        {/* Prepare for next meeting */}
        <div className="flex flex-col gap-1 px-3 py-2 bg-[--color-surface] border border-[--color-line] rounded">
          <span className="text-[10px] font-medium text-[--color-ink-muted] uppercase tracking-wide">
            Prepare for next meeting
          </span>
          {nextMeetingTopicActions.length === 0 ? (
            <p className="text-xs text-[--color-ink-muted] italic">No preparation needed or topics not yet assigned.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {nextMeetingTopicActions.slice(0, 6).map((ta) => {
                const topic = topicMap.get(ta.topicId);
                return (
                  <li key={ta.id} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-[--color-ink-faint] w-4 text-center">{ta.action}</span>
                    <span className="text-[--color-ink]">{topic?.title ?? ta.topicId}</span>
                    <span className="text-[10px] font-mono text-[--color-ink-faint] ml-auto">{topic?.code}</span>
                  </li>
                );
              })}
              {nextMeetingTopicActions.length > 6 && (
                <li className="text-[10px] text-[--color-ink-faint]">
                  +{nextMeetingTopicActions.length - 6} more topics
                </li>
              )}
            </ul>
          )}
        </div>
      </section>

      {/* === Signals: exceptions, recovery, finals === */}
      <section aria-label="Calendar signals" className="flex flex-col gap-2">
        {/* Term-only exception */}
        {recentExceptions.length > 0 && (
          <div className="px-3 py-2 bg-amber-50 border border-amber-300 rounded flex flex-col gap-1">
            <span className="text-[10px] font-medium text-amber-800 uppercase tracking-wide">
              Term exceptions
            </span>
            <ul className="flex flex-col gap-0.5">
              {recentExceptions.map((ex, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                  <span className="font-mono text-amber-600 shrink-0">{ex.date}</span>
                  <span className="capitalize text-[10px] px-1 py-0.5 rounded bg-amber-200 shrink-0">{ex.kind}</span>
                  <span>{ex.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recovery/carry-forward signal */}
        {canceledException && (
          <div
            role="status"
            aria-label="Recovery notice"
            className="px-3 py-2 bg-sky-50 border border-sky-300 rounded flex items-start gap-2 text-xs text-sky-800"
          >
            <span aria-hidden="true" className="shrink-0">↻</span>
            <div>
              <span className="font-medium">Carry-forward:</span>{" "}
              Content from the canceled {canceledException.date} meeting has been redistributed.{" "}
              <button type="button" className="underline text-sky-700 hover:text-sky-900">Review redistribution plan →</button>
            </div>
          </div>
        )}

        {/* Finals / oral interview special period */}
        {finalsStart && daysUntil(finalsStart, currentDate) < 60 && (
          <div
            role="status"
            aria-label="Finals period notice"
            className="px-3 py-2 bg-violet-50 border border-violet-300 rounded flex items-start gap-2 text-xs text-violet-800"
          >
            <span aria-hidden="true" className="shrink-0">★</span>
            <div>
              <span className="font-medium">Finals / oral interview period</span> begins {formatDate(finalsStart)}.{" "}
              Different scheduling rules apply.{" "}
              <button type="button" className="underline text-violet-700 hover:text-violet-900">
                View finals calendar →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* === Upcoming sequence === */}
      <section aria-label="Upcoming sequence">
        <h2 className="text-[10px] font-medium text-[--color-ink-muted] uppercase tracking-wide mb-2">
          Upcoming ({upcoming.length})
        </h2>
        <ol className="flex flex-col gap-0.5">
          {upcoming.map((item, i) => (
            <li
              key={i}
              className={`flex items-center gap-3 px-3 py-1.5 rounded border text-xs ${
                item.type === "milestone"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-[--color-surface] border-[--color-line] text-[--color-ink]"
              }`}
            >
              <span className="font-mono text-[10px] text-[--color-ink-faint] shrink-0 w-28">{formatDateTime(item.date, item.time)}</span>
              {item.type === "milestone" && item.role && (
                <span className={`text-[9px] px-1 py-0.5 rounded border font-medium leading-none shrink-0 ${MILESTONE_COLOR[item.role]}`}>
                  {MILESTONE_ROLE_LABEL[item.role]}
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* === Coverage summary (secondary) === */}
      <section aria-label="Coverage summary" className="mt-2">
        <details className="group">
          <summary className="text-[10px] font-medium text-[--color-ink-muted] uppercase tracking-wide cursor-pointer hover:text-[--color-ink] list-none flex items-center gap-1">
            <span aria-hidden="true" className="group-open:rotate-90 transition-transform inline-block">▶</span>
            Coverage summary (secondary)
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="px-3 py-2 bg-[--color-surface] border border-[--color-line] rounded">
              <span className="block text-[10px] text-[--color-ink-muted] mb-1">Activities</span>
              <span className="font-semibold">{activities.length}</span> total,{" "}
              <span>{activities.filter((a) => a.kind === "meeting").length}</span> meetings,{" "}
              <span>{activities.filter((a) => a.kind === "assignment").length}</span> assignments
            </div>
            <div className="px-3 py-2 bg-[--color-surface] border border-[--color-line] rounded">
              <span className="block text-[10px] text-[--color-ink-muted] mb-1">Topic actions</span>
              <span className="font-semibold">{topicActions.length}</span> I/P/A actions across{" "}
              <span>{new Set(topicActions.map((ta) => ta.topicId)).size}</span> topics
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
