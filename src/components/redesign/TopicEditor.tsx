"use client";

import { useEffect, useState } from "react";
import type { Id } from "@/lib/redesign-contract";
import {
  suggestTopicStableCode,
  type TopicBrowserEntry,
} from "@/lib/redesign-workspace";

type Props = {
  topicId: Id;
  entries: TopicBrowserEntry[];
  topicTitleById: Map<Id, string>;
  onSaveTopic: (
    topicId: Id,
    input: {
      stableCode: string;
      title: string;
      category: string;
      description: string;
      changeSummary: string;
      prerequisiteTopicIds: Id[];
    },
  ) => Promise<void>;
};

export default function TopicEditor({
  topicId,
  entries,
  topicTitleById,
  onSaveTopic,
}: Props) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCode, setDraftCode] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [resetCount, setResetCount] = useState(0);
  const [selectedPrerequisites, setSelectedPrerequisites] = useState<Id[]>([]);
  const [codeOverridden, setCodeOverridden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = entries.find((entry) => entry.topic.id === topicId) ?? null;
  const suggestedCode = suggestTopicStableCode(draftTitle);

  useEffect(() => {
    setDraftDescription(selected?.currentVersion?.description ?? "");
    setChangeSummary("");
    setDraftTitle(selected?.currentVersion?.title ?? "");
    setDraftCode(selected?.topic.stableCode ?? "");
    setDraftCategory(selected?.currentVersion?.category ?? "");
    setSelectedPrerequisites(selected?.prerequisiteTopicIds ?? []);
    setCodeOverridden(false);
    setError(null);
  }, [
    resetCount,
    selected?.currentVersion?.id,
    selected?.currentVersion?.description,
    selected?.currentVersion?.category,
    selected?.currentVersion?.title,
    selected?.prerequisiteTopicIds,
    selected?.topic.id,
    selected?.topic.stableCode,
  ]);

  function handleTitleChange(value: string) {
    setDraftTitle(value);
    if (!codeOverridden) {
      setDraftCode(suggestTopicStableCode(value));
    }
  }

  async function handleSaveTopic() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveTopic(selected.topic.id, {
        stableCode: draftCode,
        title: draftTitle,
        category: draftCategory,
        description: draftDescription,
        changeSummary,
        prerequisiteTopicIds: selectedPrerequisites,
      });
      setChangeSummary("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save topic.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="topic-details-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h1
        id="topic-details-heading"
        className="text-xl font-semibold text-slate-900"
      >
        Topic details
      </h1>
      {selected ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {selected.currentVersion?.title ?? "Draft topic"}
              <span className="ml-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                {selected.topic.stableCode}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {selected.currentVersion?.description ?? "No description yet."}
            </p>
          </div>

          {selected.currentVersion ? (
            <div className="text-sm text-slate-600">
              <p>
                Revision {selected.currentVersion.revision} ·{" "}
                {selected.currentVersion.publishedAt ? "Published" : "Draft"}.
                Content edits create a new draft version; existing Activity and
                Term pins stay unchanged.
              </p>
              {selected.currentVersion.changeSummary ? (
                <p>Last change: {selected.currentVersion.changeSummary}</p>
              ) : null}
            </div>
          ) : (
            <p role="alert">This Topic has no current version to edit.</p>
          )}

          <div className="grid gap-3">
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Topic title</span>
              <input
                value={draftTitle}
                onChange={(event) => handleTitleChange(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                disabled={saving}
              />
            </label>

            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Topic code</span>
              <input
                value={draftCode}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDraftCode(nextValue);
                  setCodeOverridden(
                    nextValue !== "" && nextValue !== suggestedCode,
                  );
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Tab" &&
                    !event.shiftKey &&
                    !codeOverridden &&
                    suggestedCode &&
                    draftCode !== suggestedCode
                  ) {
                    setDraftCode(suggestedCode);
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                disabled={saving}
                aria-describedby="topic-code-suggestion"
              />
            </label>
            <p id="topic-code-suggestion" className="text-xs text-slate-500">
              {suggestedCode
                ? `Suggested code: ${suggestedCode}. Press Tab to accept it.`
                : "Enter a stable code for exports and cross-references."}
            </p>

            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Category</span>
              <input
                value={draftCategory}
                onChange={(event) => setDraftCategory(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                disabled={saving}
              />
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Topic description</span>
              <textarea
                rows={5}
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                disabled={saving}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">
                Topic change summary
              </span>
              <textarea
                value={changeSummary}
                onChange={(event) => setChangeSummary(event.target.value)}
                disabled={saving}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          <fieldset disabled={saving}>
            <legend className="text-sm font-medium text-slate-700">
              Prerequisites
            </legend>
            <div className="mt-2 space-y-2">
              {entries
                .filter((entry) => entry.topic.id !== selected.topic.id)
                .map((entry) => {
                  const checked = selectedPrerequisites.includes(
                    entry.topic.id,
                  );
                  return (
                    <label
                      key={entry.topic.id}
                      className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedPrerequisites((current) =>
                            checked
                              ? current.filter(
                                  (value) => value !== entry.topic.id,
                                )
                              : [...current, entry.topic.id],
                          )
                        }
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          {entry.currentVersion?.title ??
                            entry.topic.stableCode}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {entry.currentVersion?.category ?? "Uncategorized"}
                        </span>
                      </span>
                    </label>
                  );
                })}
            </div>
          </fieldset>

          <div
            role="status"
            className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600"
          >
            Current chain:{" "}
            {selected.prerequisiteTopicIds.length === 0
              ? "No prerequisites"
              : selected.prerequisiteTopicIds
                  .map((topicId) => topicTitleById.get(topicId) ?? topicId)
                  .join(", ")}
          </div>

          {error ? (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => setResetCount((count) => count + 1)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
            >
              Cancel edits
            </button>
            <button
              type="button"
              onClick={handleSaveTopic}
              disabled={
                saving ||
                !selected.currentVersion ||
                !draftTitle.trim() ||
                !draftCode.trim()
              }
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Save topic"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-600">
          Select a topic to edit its title, code, and prerequisites.
        </p>
      )}
    </section>
  );
}
