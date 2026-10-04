"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type { Id } from "@/lib/redesign-contract";
import type { TopicBrowserEntry } from "@/lib/redesign-workspace";
import TopicEditor from "./TopicEditor";

type Props = { courseId: Id; topicId: Id };

export default function TopicWorkspacePage({ courseId, topicId }: Props) {
  const [entries, setEntries] = useState<TopicBrowserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTopic(showLoading = true) {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [topics, prerequisites] = await Promise.all([
        redesignApi.listTopics(courseId),
        redesignApi.listTopicPrerequisites(courseId),
      ]);
      if (!topics.some((topic) => topic.id === topicId)) {
        throw new Error("Topic not found in this course.");
      }
      const details = await Promise.all(
        topics.map((topic) => redesignApi.getTopic(topic.id)),
      );
      setEntries(
        details.map((detail) => ({
          ...detail,
          prerequisiteTopicIds: prerequisites
            .filter((edge) => edge.topicId === detail.topic.id)
            .map((edge) => edge.prerequisiteTopicId),
        })),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load Topic.",
      );
    } finally {
      setLoading(false);
    }
  }

  const loadFromEffect = useEffectEvent(loadTopic);
  useEffect(() => {
    void loadFromEffect();
  }, [courseId, topicId]);

  async function saveTopic(
    id: Id,
    input: Parameters<
      React.ComponentProps<typeof TopicEditor>["onSaveTopic"]
    >[1],
  ) {
    const selected = entries.find((entry) => entry.topic.id === id);
    if (!selected?.currentVersion)
      throw new Error("This Topic has no current version to edit.");
    if (selected.topic.stableCode !== input.stableCode) {
      await redesignApi.updateTopic(id, { stableCode: input.stableCode });
    }
    await redesignApi.replaceTopicPrerequisites(id, input.prerequisiteTopicIds);
    const current = selected.currentVersion;
    if (
      current.title !== input.title ||
      (current.category ?? "") !== input.category ||
      (current.description ?? "") !== input.description ||
      !!input.changeSummary
    ) {
      await redesignApi.createTopicVersion(id, {
        expectedCurrentVersionId: current.id,
        title: input.title,
        category: input.category || null,
        description: input.description || null,
        changeSummary: input.changeSummary || null,
        publish: false,
      });
    }
    await loadTopic(false);
  }

  return (
    <div className="space-y-4">
      <nav
        aria-label="Topic navigation"
        className="flex flex-wrap gap-4 text-sm font-medium text-sky-800"
      >
        <Link href={`/courses/${courseId}`}>← Activity board</Link>
        <Link href={`/courses/${courseId}#topics`}>Browse topics</Link>
      </nav>
      {loading ? (
        <p role="status">Loading Topic…</p>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <p role="alert">{error}</p>
          <button
            type="button"
            onClick={() => void loadTopic()}
            className="mt-4 rounded-lg border border-rose-300 px-4 py-2"
          >
            Try again
          </button>
        </div>
      ) : (
        <TopicEditor
          key={topicId}
          topicId={topicId}
          entries={entries}
          topicTitleById={
            new Map(
              entries.map((entry) => [
                entry.topic.id,
                entry.currentVersion?.title ?? entry.topic.stableCode,
              ]),
            )
          }
          onSaveTopic={saveTopic}
        />
      )}
    </div>
  );
}
