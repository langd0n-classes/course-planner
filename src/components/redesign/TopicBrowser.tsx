"use client";

import Link from "next/link";
import type { Id, TopicDto, TopicVersionDto } from "@/lib/redesign-contract";
import GapNotice from "./GapNotice";

type Props = {
  courseId: Id;
  topics: TopicDto[];
  currentVersionsByTopicId: Map<Id, TopicVersionDto | null>;
};

export default function TopicBrowser({
  courseId,
  topics,
  currentVersionsByTopicId,
}: Props) {
  return (
    <div
      data-testid="topic-list"
      className="min-w-0 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
    >
      {topics.length === 0 ? (
        <GapNotice title="No topics yet.">
          Create a Topic, then connect it to activities with introduced,
          practiced, or assessed actions.
        </GapNotice>
      ) : (
        topics.map((topic) => {
          const version = currentVersionsByTopicId.get(topic.id);
          return (
            <Link
              key={topic.id}
              href={`/courses/${courseId}/topics/${topic.id}`}
              className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-slate-300"
            >
              <p className="break-words font-medium text-slate-900">
                {version?.title ?? "Draft topic"}
              </p>
              <p className="mt-1 break-words text-xs text-slate-500">
                {topic.stableCode}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {version?.category ?? "Uncategorized"}
              </p>
            </Link>
          );
        })
      )}
    </div>
  );
}
