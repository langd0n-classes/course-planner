"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Id } from "@/lib/redesign-contract";
import {
  suggestTopicStableCode,
  type TopicBrowserEntry,
} from "@/lib/redesign-workspace";

export type TopicSaveResult = {
  saveError: string | null;
  reloadError: string | null;
  savedVersionId: Id | null;
};

type ServerSnapshot = {
  versionId: Id | null;
  stableCode: string;
  prerequisiteTopicIds: Id[];
};

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
  ) => Promise<TopicSaveResult>;
  onReloadTopic: () => Promise<string | null>;
};

export default function TopicEditor({
  topicId,
  entries,
  topicTitleById,
  onSaveTopic,
  onReloadTopic,
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
  const [saveCompleted, setSaveCompleted] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [baseVersionId, setBaseVersionId] = useState<Id | null>(null);
  const [baseCode, setBaseCode] = useState("");
  const [basePrerequisites, setBasePrerequisites] = useState<Id[]>([]);
  const [baseTopicId, setBaseTopicId] = useState<Id | null>(null);
  const [savedVersionId, setSavedVersionId] = useState<Id | null>(null);
  const [approvedServerSnapshot, setApprovedServerSnapshot] =
    useState<ServerSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const conflictHeadingRef = useRef<HTMLHeadingElement>(null);

  const selected = entries.find((entry) => entry.topic.id === topicId) ?? null;
  const suggestedCode = suggestTopicStableCode(draftTitle);
  const currentVersionId = selected?.currentVersion?.id ?? null;
  const currentPrerequisites = [...(selected?.prerequisiteTopicIds ?? [])].sort();
  const currentServerSnapshot: ServerSnapshot | null = selected
    ? {
        versionId: currentVersionId,
        stableCode: selected.topic.stableCode,
        prerequisiteTopicIds: currentPrerequisites,
      }
    : null;
  const baseStateIsSet = baseTopicId === selected?.topic.id;
  const versionChanged = Boolean(
    baseStateIsSet &&
    currentVersionId &&
    baseVersionId &&
    currentVersionId !== baseVersionId &&
    currentVersionId !== savedVersionId,
  );
  const codeChanged =
    baseStateIsSet &&
    baseCode !== selected?.topic.stableCode &&
    draftCode !== selected?.topic.stableCode;
  const prerequisitesChanged =
    baseStateIsSet &&
    [...basePrerequisites].sort().join("\u0000") !==
      currentPrerequisites.join("\u0000") &&
    [...selectedPrerequisites].sort().join("\u0000") !==
      currentPrerequisites.join("\u0000");
  const serverChanged = versionChanged || codeChanged || prerequisitesChanged;
  const fieldDifferences = selected
    ? [
        ["Topic title", draftTitle, selected.currentVersion?.title ?? ""],
        ["Topic code", draftCode, selected.topic.stableCode],
        ["Category", draftCategory, selected.currentVersion?.category ?? ""],
        [
          "Topic description",
          draftDescription,
          selected.currentVersion?.description ?? "",
        ],
        ...(changeSummary
          ? [
              [
                "Topic change summary",
                changeSummary,
                selected.currentVersion?.changeSummary ?? "",
              ],
            ]
          : []),
        [
          "Prerequisites",
          [...selectedPrerequisites]
            .sort()
            .map((id) => topicTitleById.get(id) ?? id)
            .join(", "),
          [...selected.prerequisiteTopicIds]
            .sort()
            .map((id) => topicTitleById.get(id) ?? id)
            .join(", "),
        ],
      ].filter(([, draft, server]) => draft !== server)
    : [];
  const choiceDifferences = fieldDifferences.filter(
    ([label]) => label !== "Topic change summary",
  );
  const approvalMatchesServer = Boolean(
    approvedServerSnapshot &&
      currentServerSnapshot &&
      approvedServerSnapshot.versionId === currentServerSnapshot.versionId &&
      approvedServerSnapshot.stableCode === currentServerSnapshot.stableCode &&
      approvedServerSnapshot.prerequisiteTopicIds.join("\u0000") ===
        currentServerSnapshot.prerequisiteTopicIds.join("\u0000"),
  );
  const conflictIsVisible = serverChanged && fieldDifferences.length > 0;
  const conflictSnapshotKey = currentServerSnapshot
    ? [
        currentServerSnapshot.versionId,
        currentServerSnapshot.stableCode,
        currentServerSnapshot.prerequisiteTopicIds.join("\u0000"),
      ].join("\u0001")
    : "";
  const needsChoice =
    conflictIsVisible &&
    choiceDifferences.length > 0 &&
    !approvalMatchesServer;

  const resetDraftFromServer = useEffectEvent(() => {
    setDraftDescription(selected?.currentVersion?.description ?? "");
    setChangeSummary("");
    setDraftTitle(selected?.currentVersion?.title ?? "");
    setDraftCode(selected?.topic.stableCode ?? "");
    setDraftCategory(selected?.currentVersion?.category ?? "");
    setSelectedPrerequisites(selected?.prerequisiteTopicIds ?? []);
    setCodeOverridden(false);
    setError(null);
    setSaveCompleted(false);
    setReloadError(null);
    setBaseVersionId(selected?.currentVersion?.id ?? null);
    setBaseCode(selected?.topic.stableCode ?? "");
    setBasePrerequisites(selected?.prerequisiteTopicIds ?? []);
    setBaseTopicId(selected?.topic.id ?? null);
    setSavedVersionId(null);
    setApprovedServerSnapshot(null);
  });

  useEffect(() => {
    resetDraftFromServer();
  }, [resetCount, selected?.topic.id]);

  const focusConflictHeading = useEffectEvent(() => {
    if (conflictIsVisible) conflictHeadingRef.current?.focus();
  });

  useEffect(() => {
    focusConflictHeading();
  }, [conflictSnapshotKey]);

  function handleTitleChange(value: string) {
    setDraftTitle(value);
    if (!codeOverridden) {
      setDraftCode(suggestTopicStableCode(value));
    }
  }

  async function handleSaveTopic() {
    if (!selected || needsChoice || reloadError) return;
    setSaving(true);
    setError(null);
    setSaveCompleted(false);
    try {
      const result = await onSaveTopic(selected.topic.id, {
        stableCode: draftCode,
        title: draftTitle,
        category: draftCategory,
        description: draftDescription,
        changeSummary,
        prerequisiteTopicIds: selectedPrerequisites,
      });
      if (result.savedVersionId) setSavedVersionId(result.savedVersionId);
      setSaveCompleted(!result.saveError);
      setError(
        result.saveError ??
          (result.reloadError
            ? "Changes saved, but the latest Topic could not be reloaded."
            : null),
      );
      setReloadError(result.reloadError);
      if (!result.saveError && !result.reloadError)
        setResetCount((count) => count + 1);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save topic.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleReloadTopic() {
    setSaving(true);
    const nextError = await onReloadTopic();
    setReloadError(nextError);
    if (!nextError && saveCompleted) setResetCount((count) => count + 1);
    setSaving(false);
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
            <div role="alert" className="text-sm text-rose-700">
              <p>{error}</p>
              {reloadError ? (
                <p>Reload failed: {reloadError}. Your draft is still here.</p>
              ) : null}
            </div>
          ) : null}

          {reloadError ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleReloadTopic()}
              className="rounded-lg border border-rose-300 px-4 py-2 text-sm"
            >
              Reload saved Topic
            </button>
          ) : null}

          {conflictIsVisible ? (
            <div
              id="topic-save-conflict"
              role="region"
              aria-labelledby="topic-save-conflict-heading"
              className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
            >
              <h2
                ref={conflictHeadingRef}
                id="topic-save-conflict-heading"
                tabIndex={-1}
                className="font-semibold"
              >
                {versionChanged
                  ? "The saved Topic version changed while you were editing."
                  : "The saved Topic changed while you were editing."}
              </h2>
              <p>Review these differences before saving your draft again.</p>
              <dl className="mt-3 space-y-2">
                {fieldDifferences.map(([label, draft, server]) => (
                  <div key={label}>
                    <dt className="font-medium">{label}</dt>
                    <dd>Your draft: {draft || "(empty)"}</dd>
                    <dd>Saved version: {server || "(empty)"}</dd>
                  </div>
                ))}
              </dl>
              {needsChoice ? (
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setResetCount((count) => count + 1)}
                    className="rounded-lg border border-slate-400 px-3 py-2"
                  >
                    Use saved version
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setApprovedServerSnapshot(currentServerSnapshot)
                    }
                    className="rounded-lg border border-amber-500 px-3 py-2"
                  >
                    Keep my draft
                  </button>
                </div>
              ) : approvalMatchesServer ? (
                <p className="mt-3 font-medium">
                  You chose to keep your draft. Saving will replace the
                  differing saved values.
                </p>
              ) : null}
            </div>
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
                needsChoice ||
                Boolean(reloadError) ||
                !selected.currentVersion ||
                !draftTitle.trim() ||
                !draftCode.trim()
              }
              aria-describedby={needsChoice ? "topic-save-conflict" : undefined}
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
