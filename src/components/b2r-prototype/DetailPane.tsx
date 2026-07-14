"use client";

import { useState } from "react";
import type {
  Activity,
  ActivityType,
  IpaAction,
  LearningModule,
  Topic,
  TopicAction,
} from "@/lib/b2r-prototype-fixture";
import MilestoneEditor from "./MilestoneEditor";
import DuplicateWarning from "./DuplicateWarning";
import { getDuplicateTopicActions } from "@/lib/b2r-prototype-fixture";
import type { MilestoneDraft } from "./MilestoneEditor";

interface Props {
  activity: Activity;
  activityType: ActivityType | undefined;
  learningModules: LearningModule[];
  meetingActivities: Activity[];
  topicActions: TopicAction[];
  allTopicActions: TopicAction[];
  topics: Topic[];
  activityTitleById: Map<string, string>;
  onClose: () => void;
  onTitleChange: (activityId: string, title: string) => void;
  onLmChange: (activityId: string, lmId: string | null) => void;
  onAddMilestone: (activityId: string, draft: MilestoneDraft) => void | Promise<void>;
  onRemoveMilestone: (activityId: string, milestoneId: string) => void | Promise<void>;
  onRemoveTopicAction: (taId: string) => void;
  onNavigateToActivity: (activityId: string) => void;
}

const IPA_FULL: Record<IpaAction, string> = { I: "Introduced", P: "Practiced", A: "Assessed" };

const MILESTONE_ROLE_LABEL: Record<string, string> = {
  released: "Released",
  "work-time": "Work time",
  "phase-released": "Phase released",
  review: "Review",
  due: "Due",
};

export default function DetailPane({
  activity,
  activityType,
  learningModules,
  meetingActivities,
  topicActions,
  allTopicActions,
  topics,
  activityTitleById,
  onClose,
  onTitleChange,
  onLmChange,
  onAddMilestone,
  onRemoveMilestone,
  onRemoveTopicAction,
  onNavigateToActivity,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(activity.title);

  const topicMap = new Map(topics.map((t) => [t.id, t]));

  const duplicates = getDuplicateTopicActions(allTopicActions);

  function commitTitle() {
    if (draftTitle.trim() && draftTitle !== activity.title) {
      onTitleChange(activity.id, draftTitle.trim());
    }
    setEditingTitle(false);
  }

  return (
    <aside
      aria-label={`Details for ${activity.title}`}
      className="flex flex-col bg-[--color-surface] border-l border-[--color-line] w-80 shrink-0 overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[--color-line]">
        <span className="text-[10px] font-mono text-[--color-ink-muted] uppercase tracking-wide">
          {activityType?.label ?? activity.kind}{activity.ordinal != null ? ` ${activity.ordinal}` : ""}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail pane"
          className="text-[--color-ink-muted] hover:text-[--color-ink] text-sm px-1 rounded"
        >
          ×
        </button>
      </div>

      <div className="flex flex-col gap-4 px-3 py-3 text-xs overflow-y-auto">
        {/* Title — inline editable */}
        <div>
          <label className="block text-[10px] font-medium text-[--color-ink-muted] uppercase tracking-wide mb-1">
            Title
          </label>
          {editingTitle ? (
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setDraftTitle(activity.title);
                  setEditingTitle(false);
                }
              }}
              className="w-full px-2 py-1 bg-[--color-paper-inset] border border-[--color-accent] rounded text-[--color-ink] text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              aria-label={`Edit title: ${activity.title}`}
              className="w-full text-left px-2 py-1 rounded border border-transparent hover:border-[--color-line] hover:bg-[--color-paper-inset] text-[--color-ink] font-medium"
            >
              {activity.title}
            </button>
          )}
        </div>

        {/* Primary LM */}
        <div>
          <label
            htmlFor={`lm-select-${activity.id}`}
            className="block text-[10px] font-medium text-[--color-ink-muted] uppercase tracking-wide mb-1"
          >
            Primary module
          </label>
          <select
            id={`lm-select-${activity.id}`}
            value={activity.primaryLmId ?? ""}
            onChange={(e) => onLmChange(activity.id, e.target.value || null)}
            className="w-full px-2 py-1 bg-[--color-paper-inset] border border-[--color-line] rounded text-[--color-ink] text-xs"
          >
            <option value="">— Unassigned / Cross-cutting —</option>
            {learningModules.map((lm) => (
              <option key={lm.id} value={lm.id}>
                {lm.code}: {lm.title}
              </option>
            ))}
          </select>
          <p className="mt-0.5 text-[10px] text-[--color-ink-faint]">
            One primary module determines board placement.
          </p>
        </div>

        {/* Date */}
        {activity.date && (
          <div>
            <span className="block text-[10px] font-medium text-[--color-ink-muted] uppercase tracking-wide mb-1">
              Scheduled
            </span>
            <span className="text-[--color-ink]">{activity.date}</span>
          </div>
        )}

        {/* Milestones */}
        {activity.kind !== "project" && activity.milestones.length > 0 && (
          <div>
            <span className="block text-[10px] font-medium text-[--color-ink-muted] uppercase tracking-wide mb-1">
              Milestones
            </span>
            <ul className="flex flex-col gap-1">
              {activity.milestones.map((ms) => (
                <li key={ms.id} className="flex items-center gap-2 px-2 py-1 rounded bg-amber-50 border border-amber-200">
                  <span className="font-medium text-amber-800 capitalize">
                    {MILESTONE_ROLE_LABEL[ms.role] ?? ms.role}
                  </span>
                  <span className="text-[--color-ink-soft] truncate">{ms.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activity.kind === "project" && (
          <MilestoneEditor
            activity={activity}
            meetingActivities={meetingActivities}
            onAdd={(draft) => onAddMilestone(activity.id, draft)}
            onRemove={(milestoneId) => onRemoveMilestone(activity.id, milestoneId)}
          />
        )}

        {/* Topic actions */}
        <div>
          <span className="block text-[10px] font-medium text-[--color-ink-muted] uppercase tracking-wide mb-1">
            Topics ({topicActions.length})
          </span>
          {topicActions.length === 0 && (
            <p className="text-[--color-ink-muted] italic py-1">
              No topics attached. Use the Topic bank to add I/P/A actions.
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {topicActions.map((ta) => {
              const topic = topicMap.get(ta.topicId);
              const dupeKey = `${ta.topicId}:${ta.action}`;
              const dupeList = duplicates.get(dupeKey) ?? [];
              const otherOccurrences = dupeList.filter((duplicate) => duplicate.activityId !== activity.id);
              const isDupe = dupeList.length > 1;

              return (
                <li key={ta.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-[--color-line] bg-[--color-paper]">
                    <span className="font-mono text-[10px] text-[--color-ink-muted] w-4 shrink-0">
                      {ta.action}
                    </span>
                    <span className="flex-1 text-[--color-ink] leading-tight">{topic?.title ?? ta.topicId}</span>
                    <span className="text-[10px] font-mono text-[--color-ink-faint]">{topic?.code}</span>
                    {isDupe && (
                      <span
                        aria-label="Duplicate action"
                        title="This topic+action appears in multiple activities"
                        className="text-amber-500 text-[11px]"
                        aria-hidden="true"
                      >
                        ⚠
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${IPA_FULL[ta.action]} action for ${topic?.title ?? ta.topicId}`}
                      onClick={() => onRemoveTopicAction(ta.id)}
                      className="text-[--color-ink-faint] hover:text-rose-600 px-0.5 rounded ml-1"
                    >
                      ×
                    </button>
                  </div>
                  {isDupe && topic && (
                    <DuplicateWarning
                      topicTitle={topic.title}
                      action={ta.action}
                      totalActivities={dupeList.length}
                      otherOccurrences={otherOccurrences}
                      activityTitleById={activityTitleById}
                      onNavigate={onNavigateToActivity}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Scope LMs */}
        {activity.scopeLmIds.length > 0 && (
          <div>
            <span className="block text-[10px] font-medium text-[--color-ink-muted] uppercase tracking-wide mb-1">
              Module scope
            </span>
            <p className="text-[10px] text-[--color-ink-faint] mb-1">
              This activity&apos;s scope spans multiple modules (does not affect board placement).
            </p>
            <ul className="flex flex-wrap gap-1">
              {activity.scopeLmIds.map((lmId) => (
                <li key={lmId} className="px-1.5 py-0.5 rounded border border-[--color-line] bg-[--color-paper-inset] text-[10px] text-[--color-ink-soft] font-mono">
                  {lmId.toUpperCase()}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
