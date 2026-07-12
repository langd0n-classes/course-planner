"use client";

import { useEffect, useMemo, useState } from "react";
import type { Id, LearningModuleDto, TopicDto } from "@/lib/redesign-contract";
import type { TopicBrowserBucket } from "@/lib/redesign-workspace";
import GapNotice from "./GapNotice";

type Props = {
  buckets: TopicBrowserBucket[];
  learningModules: LearningModuleDto[];
  topicTitleById: Map<Id, string>;
  onAssignTopic: (topicId: Id, learningModuleId: Id | null) => Promise<void>;
  onSavePrerequisites: (topicId: Id, prerequisiteTopicIds: Id[]) => Promise<void>;
};

export default function TopicBrowser({
  buckets,
  learningModules,
  topicTitleById,
  onAssignTopic,
  onSavePrerequisites,
}: Props) {
  const flatTopics = useMemo(
    () => buckets.flatMap((bucket) => bucket.topics),
    [buckets],
  );
  const [selectedTopicId, setSelectedTopicId] = useState<Id | null>(flatTopics[0]?.topic.id ?? null);
  const [selectedPrerequisites, setSelectedPrerequisites] = useState<Id[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = flatTopics.find((entry) => entry.topic.id === selectedTopicId) ?? null;

  useEffect(() => {
    if (!selectedTopicId && flatTopics[0]) {
      setSelectedTopicId(flatTopics[0].topic.id);
      return;
    }
    if (selectedTopicId && !flatTopics.some((entry) => entry.topic.id === selectedTopicId)) {
      setSelectedTopicId(flatTopics[0]?.topic.id ?? null);
    }
  }, [flatTopics, selectedTopicId]);

  useEffect(() => {
    setSelectedPrerequisites(selected?.prerequisiteTopicIds ?? []);
    setError(null);
  }, [selected?.topic.id, selected?.prerequisiteTopicIds]);

  async function handleModuleChange(topic: TopicDto, learningModuleId: Id | null) {
    setSaving(true);
    setError(null);
    try {
      await onAssignTopic(topic.id, learningModuleId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to move topic.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePrerequisites() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await onSavePrerequisites(selected.topic.id, selectedPrerequisites);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save prerequisites.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
      <div className="space-y-4">
        {buckets.map((bucket) => (
          <section key={bucket.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{bucket.label}</h2>
                <p className="text-sm text-slate-600">
                  {bucket.isUnassigned
                    ? "Topics waiting for a learning module home."
                    : `${bucket.topics.length} topic${bucket.topics.length === 1 ? "" : "s"} in this module.`}
                </p>
              </div>
              {bucket.isUnassigned ? (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                  Gap
                </span>
              ) : null}
            </div>

            {bucket.topics.length === 0 ? (
              <GapNotice title={bucket.isUnassigned ? "No unassigned topics." : "No topics in this module yet."}>
                This empty space is intentional. It makes curriculum gaps visible instead of hiding them in a blank list.
              </GapNotice>
            ) : (
              <div className="grid gap-2">
                {bucket.topics.map((entry) => {
                  const active = entry.topic.id === selectedTopicId;
                  return (
                    <button
                      key={entry.topic.id}
                      type="button"
                      onClick={() => setSelectedTopicId(entry.topic.id)}
                      className={`rounded-xl border px-3 py-3 text-left ${
                        active
                          ? "border-sky-300 bg-sky-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {entry.topic.stableCode}
                          </p>
                          <p className="font-medium text-slate-900">
                            {entry.currentVersion?.title ?? "Draft topic"}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                          {entry.currentVersion?.category ?? "Uncategorized"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {entry.currentVersion?.description ?? "No description yet."}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {entry.prerequisiteTopicIds.length} prerequisite
                        {entry.prerequisiteTopicIds.length === 1 ? "" : "s"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Topic Details</h2>
        {selected ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{selected.topic.stableCode}</p>
              <p className="text-lg font-semibold text-slate-900">{selected.currentVersion?.title ?? "Draft topic"}</p>
              <p className="mt-1 text-sm text-slate-600">{selected.currentVersion?.description ?? "No description yet."}</p>
            </div>

            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Learning Module</span>
              <select
                value={selected.topic.learningModuleId ?? ""}
                onChange={(event) =>
                  handleModuleChange(selected.topic, event.target.value || null)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                disabled={saving}
              >
                <option value="">Unassigned</option>
                {learningModules.map((learningModule) => (
                  <option key={learningModule.id} value={learningModule.id}>
                    {learningModule.stableCode}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Prerequisites</legend>
              <div className="mt-2 space-y-2">
                {flatTopics
                  .filter((entry) => entry.topic.id !== selected.topic.id)
                  .map((entry) => {
                    const checked = selectedPrerequisites.includes(entry.topic.id);
                    return (
                      <label key={entry.topic.id} className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedPrerequisites((current) =>
                              checked
                                ? current.filter((value) => value !== entry.topic.id)
                                : [...current, entry.topic.id],
                            )
                          }
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-900">
                            {entry.currentVersion?.title ?? entry.topic.stableCode}
                          </span>
                          <span className="block text-xs text-slate-500">{entry.currentVersion?.category ?? "Uncategorized"}</span>
                        </span>
                      </label>
                    );
                  })}
              </div>
            </fieldset>

            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              Current chain:{" "}
              {selected.prerequisiteTopicIds.length === 0
                ? "No prerequisites"
                : selected.prerequisiteTopicIds
                    .map((topicId) => topicTitleById.get(topicId) ?? topicId)
                    .join(", ")}
            </div>

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSavePrerequisites}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {saving ? "Saving..." : "Save prerequisites"}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">Select a topic to edit its learning module and prerequisite chain.</p>
        )}
      </aside>
    </div>
  );
}
