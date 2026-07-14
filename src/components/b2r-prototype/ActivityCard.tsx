"use client";

import type { Activity, ActivityType, IpaAction, Topic, TopicAction } from "@/lib/b2r-prototype-fixture";

interface Props {
  activity: Activity;
  activityType: ActivityType | undefined;
  topicActions: TopicAction[];
  topics: Topic[];
  isSelected: boolean;
  isDragging: boolean;
  duplicateTopicActionIds: Set<string>;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onKeyboardMove: (activityId: string) => void;
  registerRef: (element: HTMLElement | null) => void;
}

const IPA_COLOR: Record<IpaAction, string> = {
  I: "bg-emerald-100 text-emerald-800 border-emerald-200",
  P: "bg-sky-100 text-sky-800 border-sky-200",
  A: "bg-violet-100 text-violet-800 border-violet-200",
};

const KIND_ICON: Record<string, string> = {
  meeting: "◆",
  assignment: "✎",
  project: "⬡",
  exam: "★",
};

export default function ActivityCard({
  activity,
  activityType,
  topicActions,
  topics,
  isSelected,
  isDragging,
  duplicateTopicActionIds,
  onSelect,
  onDragStart,
  onKeyboardMove,
  registerRef,
}: Props) {
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const hasDupes = topicActions.some((ta) => duplicateTopicActionIds.has(ta.id));

  return (
    <article
      ref={registerRef}
      draggable
      onDragStart={onDragStart}
      aria-current={isSelected ? "true" : undefined}
      aria-label={`${activityType?.label ?? activity.kind} ${activity.ordinal ?? ""}: ${activity.title}`}
      className={`group relative rounded border cursor-grab active:cursor-grabbing select-none transition-shadow ${
        isSelected
          ? "border-[--color-accent] bg-[--color-accent-tint] shadow-sm"
          : "border-[--color-line] bg-[--color-surface] hover:border-[--color-accent] hover:bg-[--color-accent-tint]"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left px-2 py-1.5 focus:outline-none"
      >
        <div className="flex items-start gap-1.5">
          <span
            aria-hidden="true"
            className="text-[--color-ink-faint] text-[10px] mt-0.5 shrink-0"
          >
            {KIND_ICON[activity.kind] ?? "●"}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1">
              {activity.ordinal != null && (
                <span className="text-[10px] font-mono text-[--color-ink-faint] shrink-0">
                  {activityType?.label?.[0] ?? ""}
                  {activity.ordinal}
                </span>
              )}
              <span className="text-xs font-medium text-[--color-ink] leading-tight truncate">
                {activity.title}
              </span>
            </div>

            {activity.milestones.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {activity.milestones.map((ms) => (
                  <span
                    key={ms.id}
                    className="inline-block px-1 py-0.5 text-[9px] rounded bg-amber-100 text-amber-800 border border-amber-200 leading-none"
                  >
                    {ms.role}
                  </span>
                ))}
              </div>
            )}

            {topicActions.length > 0 && (
              <div className="flex flex-wrap gap-0.5 mt-1">
                {topicActions.slice(0, 6).map((ta) => {
                  const topic = topicMap.get(ta.topicId);
                  const isDupe = duplicateTopicActionIds.has(ta.id);
                  return (
                    <span
                      key={ta.id}
                      title={`${topic?.title ?? ta.topicId} — ${ta.action}${isDupe ? " (duplicate)" : ""}`}
                      className={`inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] rounded border leading-none font-mono ${IPA_COLOR[ta.action]} ${isDupe ? "ring-1 ring-amber-400" : ""}`}
                    >
                      {ta.action}:{topic?.code ?? "?"}
                      {isDupe && <span aria-label="duplicate warning" aria-hidden="true">⚠</span>}
                    </span>
                  );
                })}
                {topicActions.length > 6 && (
                  <span className="text-[9px] text-[--color-ink-faint]">+{topicActions.length - 6}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Cross-cutting scope badges */}
      {activity.scopeLmIds.length > 0 && (
        <div className="px-2 pb-1 flex flex-wrap gap-0.5">
          {activity.scopeLmIds.map((lmId) => (
            <span key={lmId} className="text-[9px] px-1 py-0.5 rounded bg-[--color-paper-inset] border border-[--color-line] text-[--color-ink-muted]">
              ↔ {lmId.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {/* Keyboard move action */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onKeyboardMove(activity.id);
        }}
        aria-label={`Move ${activity.title} to another module`}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-[10px] text-[--color-ink-muted] hover:text-[--color-accent] px-1 py-0.5 rounded border border-transparent hover:border-[--color-line] transition-opacity"
      >
        ↕
      </button>

      {hasDupes && (
        <span
          aria-label="Contains duplicate topic actions"
          className="absolute top-0 right-0 w-2 h-2 rounded-full bg-amber-400 translate-x-0.5 -translate-y-0.5"
          aria-hidden="true"
        />
      )}
    </article>
  );
}
