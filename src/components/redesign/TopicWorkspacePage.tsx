"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type { Id } from "@/lib/redesign-contract";
import type { TopicBrowserEntry } from "@/lib/redesign-workspace";
import TopicEditor, { type TopicSaveResult } from "./TopicEditor";

type Props = { courseId: Id; topicId: Id };

export default function TopicWorkspacePage({ courseId, topicId }: Props) {
  const [entries, setEntries] = useState<TopicBrowserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTopic(showLoading = true) {
    if (showLoading) setLoading(true);
    if (showLoading) setError(null);
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
      return null;
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to load Topic.";
      if (showLoading) setError(message);
      return message;
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
  ): Promise<TopicSaveResult> {
    const selected = entries.find((entry) => entry.topic.id === id);
    if (!selected?.currentVersion)
      throw new Error("This Topic has no current version to edit.");
    const current = selected.currentVersion;
    let savedVersionId: Id | null = null;
    const savedParts: string[] = [];
    let failedStep = "version";
    let saveError: string | null = null;
    try {
      if (
        current.title !== input.title ||
        (current.category ?? "") !== input.category ||
        (current.description ?? "") !== input.description ||
        (!!input.changeSummary && current.changeSummary !== input.changeSummary)
      ) {
        const created = await redesignApi.createTopicVersion(id, {
          expectedCurrentVersionId: current.id,
          title: input.title,
          category: input.category || null,
          description: input.description || null,
          changeSummary: input.changeSummary || null,
          publish: false,
        });
        savedVersionId = created.id;
        savedParts.push("Topic version");
      }
      failedStep = "code";
      if (selected.topic.stableCode !== input.stableCode) {
        await redesignApi.updateTopic(id, { stableCode: input.stableCode });
        savedParts.push("code");
      }
      failedStep = "prerequisites";
      await redesignApi.replaceTopicPrerequisites(
        id,
        input.prerequisiteTopicIds,
      );
    } catch (caught) {
      const detail =
        caught instanceof Error ? caught.message : "Unable to save Topic.";
      const completed =
        savedParts.length === 0
          ? "Nothing saved"
          : `${savedParts.join(" and ")} saved, but ${failedStep} failed`;
      saveError = `${completed}. ${detail}`;
    }
    const reloadError = await loadTopic(false);
    return { saveError, reloadError, savedVersionId };
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
          onReloadTopic={() => loadTopic(false)}
        />
      )}
    </div>
  );
}
