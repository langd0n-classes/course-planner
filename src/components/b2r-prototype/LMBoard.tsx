"use client";

import { useState } from "react";
import type {
  Activity,
  ActivityType,
  Id,
  LearningModule,
  Topic,
  TopicAction,
} from "@/lib/b2r-prototype-fixture";
import ActivityCard from "./ActivityCard";

interface Props {
  learningModules: LearningModule[];
  activities: Activity[];
  activityTypes: ActivityType[];
  topicActions: TopicAction[];
  topics: Topic[];
  selectedActivityId: Id | null;
  duplicateTopicActionIds: Set<string>;
  searchQuery: string;
  onRegisterCardRef: (activityId: Id, element: HTMLElement | null) => void;
  onSelectActivity: (id: Id) => void;
  onMoveActivity: (activityId: Id, toLmId: Id | null) => void;
}

function matchesSearch(activity: Activity, topics: Topic[], topicActions: TopicAction[], query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  if (activity.title.toLowerCase().includes(q)) return true;
  const actTopicIds = new Set(topicActions.filter((ta) => ta.activityId === activity.id).map((ta) => ta.topicId));
  return [...actTopicIds].some((tid) => {
    const t = topics.find((tp) => tp.id === tid);
    return t?.title.toLowerCase().includes(q) || t?.code.toLowerCase().includes(q);
  });
}

export default function LMBoard({
  learningModules,
  activities,
  activityTypes,
  topicActions,
  topics,
  selectedActivityId,
  duplicateTopicActionIds,
  searchQuery,
  onRegisterCardRef,
  onSelectActivity,
  onMoveActivity,
}: Props) {
  const [draggingId, setDraggingId] = useState<Id | null>(null);
  const [dragOverLm, setDragOverLm] = useState<Id | null | "UNSET">("UNSET");
  const [movingId, setMovingId] = useState<Id | null>(null);

  const columns: Array<{ id: Id | null; label: string; code: string | null }> = [
    { id: null, label: "Unassigned / Cross-cutting", code: null },
    ...learningModules.map((lm) => ({ id: lm.id, label: `${lm.code}: ${lm.title}`, code: lm.code })),
  ];

  function getColumnActivities(lmId: Id | null) {
    return activities.filter(
      (a) =>
        a.primaryLmId === lmId &&
        matchesSearch(a, topics, topicActions, searchQuery),
    );
  }

  function handleDragStart(e: React.DragEvent, activityId: Id) {
    setDraggingId(activityId);
    e.dataTransfer.setData("text/plain", activityId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, lmId: Id | null) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverLm(lmId ?? "UNSET");
  }

  function handleDrop(e: React.DragEvent, lmId: Id | null) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) onMoveActivity(id, lmId);
    setDraggingId(null);
    setDragOverLm("UNSET");
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverLm("UNSET");
  }

  function openKeyboardMove(activityId: Id) {
    setMovingId(activityId);
  }

  function applyKeyboardMove(activityId: Id, lmId: Id | null) {
    onMoveActivity(activityId, lmId);
    setMovingId(null);
  }

  return (
    <div className="flex-1 overflow-x-auto">
      {/* Keyboard move dialog */}
      {movingId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Move activity to module"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
        >
          <div className="bg-[--color-surface] border border-[--color-line] rounded shadow-lg p-4 w-72 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-[--color-ink]">Move to module</h2>
            <p className="text-xs text-[--color-ink-muted]">
              {activities.find((a) => a.id === movingId)?.title}
            </p>
            <ul className="flex flex-col gap-1">
              <li>
                <button
                  type="button"
                  onClick={() => applyKeyboardMove(movingId, null)}
                  className="w-full text-left px-2 py-1.5 text-xs rounded border border-[--color-line] hover:bg-[--color-accent-tint] text-[--color-ink-soft]"
                >
                  Unassigned / Cross-cutting
                </button>
              </li>
              {learningModules.map((lm) => (
                <li key={lm.id}>
                  <button
                    type="button"
                    onClick={() => applyKeyboardMove(movingId, lm.id)}
                    className="w-full text-left px-2 py-1.5 text-xs rounded border border-[--color-line] hover:bg-[--color-accent-tint] text-[--color-ink]"
                  >
                    {lm.code}: {lm.title}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setMovingId(null)}
              className="text-xs text-[--color-ink-muted] self-end hover:text-[--color-ink]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 p-3 min-w-max h-full">
        {columns.map((col) => {
          const colActivities = getColumnActivities(col.id);
          const isDropTarget = dragOverLm === (col.id ?? "UNSET") || (col.id === null && dragOverLm === "UNSET");

          return (
            <div
              key={col.id ?? "__unassigned__"}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              onDragLeave={() => setDragOverLm("UNSET")}
              className={`flex flex-col w-52 shrink-0 rounded border transition-colors ${
                isDropTarget && draggingId
                  ? "border-[--color-accent] bg-[--color-accent-tint]"
                  : "border-[--color-line] bg-[--color-paper-inset]"
              }`}
            >
              {/* Column header */}
              <div className="px-2 py-1.5 border-b border-[--color-line] flex items-center gap-1.5">
                {col.code && (
                  <span className="text-[10px] font-mono text-[--color-ink-faint]">{col.code}</span>
                )}
                <span className="text-xs font-medium text-[--color-ink-soft] leading-tight">
                  {col.label}
                </span>
                <span className="ml-auto text-[10px] text-[--color-ink-faint]">{colActivities.length}</span>
              </div>

              {/* Cards */}
              <div
                onDragEnd={handleDragEnd}
                className="flex flex-col gap-1.5 p-2 flex-1 min-h-[80px]"
              >
                {colActivities.length === 0 && (
                  <p className="text-[10px] text-[--color-ink-faint] italic text-center mt-2">
                    {searchQuery ? "No matches" : "Drag here to assign"}
                  </p>
                )}
                {colActivities.map((act) => {
                  const actType = activityTypes.find((t) => t.id === act.typeId);
                  const actTopicActions = topicActions.filter((ta) => ta.activityId === act.id);
                  return (
                    <ActivityCard
                      key={act.id}
                      activity={act}
                      activityType={actType}
                      topicActions={actTopicActions}
                      topics={topics}
                      isSelected={selectedActivityId === act.id}
                      isDragging={draggingId === act.id}
                      duplicateTopicActionIds={duplicateTopicActionIds}
                      onSelect={() => onSelectActivity(act.id)}
                      onDragStart={(e) => handleDragStart(e, act.id)}
                      onKeyboardMove={openKeyboardMove}
                      registerRef={(element) => onRegisterCardRef(act.id, element)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
