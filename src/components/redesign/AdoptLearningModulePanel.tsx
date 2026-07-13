"use client";

import { useEffect, useMemo, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  Id,
  LearningModuleDto,
  LearningModuleVersionDto,
} from "@/lib/redesign-contract";

type Props = {
  termId: Id;
  learningModules: LearningModuleDto[];
  currentVersionsByLearningModuleId: Map<Id, LearningModuleVersionDto | null>;
  versionsByLearningModuleId: Map<Id, LearningModuleVersionDto[]>;
  existingLearningModuleIds: Set<Id>;
  nextSequence: number;
  onAdopted: () => void | Promise<void>;
};

export default function AdoptLearningModulePanel({
  termId,
  learningModules,
  currentVersionsByLearningModuleId,
  versionsByLearningModuleId,
  existingLearningModuleIds,
  nextSequence,
  onAdopted,
}: Props) {
  const available = useMemo(
    () => learningModules.filter((lm) => !existingLearningModuleIds.has(lm.id)),
    [learningModules, existingLearningModuleIds],
  );

  const [selectedLmId, setSelectedLmId] = useState(available[0]?.id ?? "");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [sequence, setSequence] = useState(String(nextSequence));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedVersions = useMemo(
    () => (selectedLmId ? (versionsByLearningModuleId.get(selectedLmId) ?? []) : []),
    [selectedLmId, versionsByLearningModuleId],
  );

  const currentVersionId = useMemo(
    () => currentVersionsByLearningModuleId.get(selectedLmId)?.id ?? selectedVersions[selectedVersions.length - 1]?.id ?? "",
    [selectedLmId, currentVersionsByLearningModuleId, selectedVersions],
  );

  const effectiveVersionId = selectedVersionId || currentVersionId;

  useEffect(() => {
    if (available.length === 0) {
      if (selectedLmId !== "") setSelectedLmId("");
      return;
    }

    if (!available.some((lm) => lm.id === selectedLmId)) {
      setSelectedLmId(available[0]!.id);
      setSelectedVersionId("");
    }
  }, [available, selectedLmId]);

  useEffect(() => {
    setSequence(String(nextSequence));
  }, [nextSequence]);

  function handleLmChange(lmId: Id) {
    setSelectedLmId(lmId);
    setSelectedVersionId("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLmId || !effectiveVersionId) return;
    const seq = parseInt(sequence, 10);
    if (isNaN(seq) || seq < 1) return;
    setSubmitting(true);
    setError(null);
    try {
      await redesignApi.adoptTermLearningModule(termId, {
        learningModuleId: selectedLmId,
        learningModuleVersionId: effectiveVersionId,
        sequence: seq,
        notes: notes.trim() || null,
      });
      await onAdopted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adopt learning module.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  }

  if (available.length === 0) {
    return (
      <p className="text-sm text-ink-faint italic">All course learning modules are already adopted for this term.</p>
    );
  }

  const selectedVersionLabel = (v: LearningModuleVersionDto) =>
    `Rev. ${v.revision}${v.title ? ` — ${v.title}` : ""}${v.publishedAt ? " (published)" : ""}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-ink-soft">
          <span className="mb-1 block font-medium">Learning module</span>
          <select
            aria-label="Learning module"
            value={selectedLmId}
            onChange={(e) => handleLmChange(e.target.value)}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2"
            disabled={submitting}
            required
          >
            {available.map((lm) => {
              const v = currentVersionsByLearningModuleId.get(lm.id);
              return (
                <option key={lm.id} value={lm.id}>
                  {v?.title ?? lm.stableCode}
                </option>
              );
            })}
          </select>
        </label>

        <label className="text-sm text-ink-soft">
          <span className="mb-1 block font-medium">Version to plan</span>
          <select
            aria-label="Version to plan"
            value={effectiveVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2"
            disabled={submitting || selectedVersions.length === 0}
          >
            {selectedVersions.map((v) => (
              <option key={v.id} value={v.id}>
                {selectedVersionLabel(v)}
                {v.id === currentVersionId ? " (current)" : ""}
              </option>
            ))}
          </select>
          {selectedVersions.length === 0 ? (
            <p className="mt-1 text-xs text-amber-800">No versions exist for this module yet.</p>
          ) : null}
        </label>

        <label className="text-sm text-ink-soft">
          <span className="mb-1 block font-medium">Sequence</span>
          <input
            aria-label="Sequence"
            type="number"
            min={1}
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 font-mono"
            disabled={submitting}
            required
          />
          <p className="mt-1 text-xs text-ink-faint">Order within the term (1 = first).</p>
        </label>

        <label className="text-sm text-ink-soft">
          <span className="mb-1 block font-medium">Notes (optional)</span>
          <textarea
            aria-label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any adoption notes for this term"
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2"
            disabled={submitting}
          />
        </label>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting || !selectedLmId || !effectiveVersionId}
        className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink-faint"
      >
        {submitting ? "Adopting..." : "Adopt learning module"}
      </button>
    </form>
  );
}
