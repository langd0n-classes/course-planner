"use client";

import type { IpaAction, TopicAction } from "@/lib/b2r-prototype-fixture";

interface Props {
  topicTitle: string;
  action: IpaAction;
  totalActivities: number;
  otherOccurrences: TopicAction[];
  activityTitleById: Map<string, string>;
  onNavigate: (activityId: string) => void;
}

const ACTION_LABEL: Record<IpaAction, string> = { I: "Introduced", P: "Practiced", A: "Assessed" };

export default function DuplicateWarning({
  topicTitle,
  action,
  totalActivities,
  otherOccurrences,
  activityTitleById,
  onNavigate,
}: Props) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex flex-col gap-1 px-2 py-1.5 bg-amber-50 border border-amber-300 rounded text-xs"
    >
      <span className="font-medium text-amber-800">
        &quot;{topicTitle}&quot; is {ACTION_LABEL[action]} in {totalActivities} activities
      </span>
      <span className="text-amber-700">This may be intentional. Navigate to other occurrences:</span>
      <ul className="flex flex-col gap-0.5 mt-0.5">
        {otherOccurrences.map((ta) => (
          <li key={ta.id}>
            <button
              type="button"
              onClick={() => onNavigate(ta.activityId)}
              className="text-[--color-accent] underline underline-offset-2 hover:text-[--color-accent-hover] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--color-accent] rounded"
            >
              {activityTitleById.get(ta.activityId) ?? "Unknown activity"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
