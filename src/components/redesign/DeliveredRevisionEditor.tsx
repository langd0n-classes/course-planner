"use client";

import { useMemo, useState } from "react";
import type {
  CreateDeliveredRevisionRequest,
  LearningModuleVersionDto,
  TopicVersionDto,
} from "@/lib/redesign-contract";
import DeliveredEditBanner from "./DeliveredEditBanner";

type Props = {
  plannedVersion: LearningModuleVersionDto;
  deliveredVersion: LearningModuleVersionDto | null;
  availableTopicVersions: TopicVersionDto[];
  onCancel: () => void;
  onSave: (request: CreateDeliveredRevisionRequest) => Promise<void>;
};

type TopicSelection = {
  topicVersionId: string;
  included: boolean;
  sequence: number;
};

function buildInitialSelections(
  availableTopicVersions: TopicVersionDto[],
  sourceVersion: LearningModuleVersionDto,
): TopicSelection[] {
  return availableTopicVersions.map((topicVersion, index) => {
    const match = sourceVersion.topics.find((topic) => topic.topicVersionId === topicVersion.id);
    return {
      topicVersionId: topicVersion.id,
      included: Boolean(match),
      sequence: match?.sequence ?? index + 1,
    };
  });
}

export default function DeliveredRevisionEditor({
  plannedVersion,
  deliveredVersion,
  availableTopicVersions,
  onCancel,
  onSave,
}: Props) {
  const sourceVersion = deliveredVersion ?? plannedVersion;
  const [title, setTitle] = useState(sourceVersion.title);
  const [description, setDescription] = useState(sourceVersion.description ?? "");
  const [notes, setNotes] = useState(sourceVersion.notes ?? "");
  const [learningObjectives, setLearningObjectives] = useState(sourceVersion.learningObjectives.join("\n"));
  const [changeSummary, setChangeSummary] = useState("");
  const [selections, setSelections] = useState<TopicSelection[]>(
    buildInitialSelections(availableTopicVersions, sourceVersion),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = useMemo(
    () => selections.filter((selection) => selection.included).length,
    [selections],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        expectedDeliveredLearningModuleVersionId: deliveredVersion?.id ?? null,
        title,
        description,
        notes,
        learningObjectives: learningObjectives
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        changeSummary,
        topics: selections
          .filter((selection) => selection.included)
          .sort((left, right) => left.sequence - right.sequence)
          .map((selection) => ({
            topicVersionId: selection.topicVersionId,
            sequence: selection.sequence,
          })),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save delivered revision.");
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-amber-300 bg-surface p-5">
      <DeliveredEditBanner />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-ink-soft md:col-span-2">
          <span className="mb-1 block font-medium">Delivered title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-line-strong px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-ink-soft md:col-span-2">
          <span className="mb-1 block font-medium">Delivered description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-24 w-full rounded-lg border border-line-strong px-3 py-2"
          />
        </label>

        <label className="text-sm text-ink-soft md:col-span-2">
          <span className="mb-1 block font-medium">Learning objectives</span>
          <textarea
            value={learningObjectives}
            onChange={(event) => setLearningObjectives(event.target.value)}
            className="min-h-28 w-full rounded-lg border border-line-strong px-3 py-2"
          />
        </label>

        <label className="text-sm text-ink-soft md:col-span-2">
          <span className="mb-1 block font-medium">Change summary</span>
          <textarea
            value={changeSummary}
            onChange={(event) => setChangeSummary(event.target.value)}
            placeholder="Explain what changed during delivery and why."
            className="min-h-20 w-full rounded-lg border border-line-strong px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-ink-soft md:col-span-2">
          <span className="mb-1 block font-medium">Delivery notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20 w-full rounded-lg border border-line-strong px-3 py-2"
          />
        </label>
      </div>

      <div className="mt-5 rounded-lg border border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium text-ink">Delivered topic lineup</h3>
          <p className="text-sm text-ink-muted">{selectedCount} included</p>
        </div>
        <div className="mt-3 space-y-3">
          {availableTopicVersions.map((topicVersion) => {
            const selection = selections.find((item) => item.topicVersionId === topicVersion.id);
            if (!selection) return null;
            return (
              <div key={topicVersion.id} className="grid gap-3 rounded-lg border border-line px-3 py-3 md:grid-cols-[minmax(0,1fr)_7rem]">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selection.included}
                    onChange={(event) =>
                      setSelections((current) =>
                        current.map((item) =>
                          item.topicVersionId === topicVersion.id
                            ? { ...item, included: event.target.checked }
                            : item,
                        ),
                      )
                    }
                  />
                  <span>
                    <span className="block font-medium text-ink">{topicVersion.title}</span>
                    <span className="block text-xs text-ink-faint">{topicVersion.category ?? "Uncategorized"}</span>
                  </span>
                </label>

                <label className="text-sm text-ink-soft">
                  <span className="mb-1 block font-medium">Order</span>
                  <input
                    type="number"
                    min={1}
                    value={selection.sequence}
                    onChange={(event) =>
                      setSelections((current) =>
                        current.map((item) =>
                          item.topicVersionId === topicVersion.id
                            ? { ...item, sequence: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    disabled={!selection.included}
                    className="w-full rounded-lg border border-line-strong px-3 py-2"
                  />
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-soft"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink-faint"
        >
          {saving ? "Saving..." : "Save delivered revision"}
        </button>
      </div>
    </form>
  );
}
