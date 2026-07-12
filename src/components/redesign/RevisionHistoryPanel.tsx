"use client";

import { useState } from "react";
import type { Id, LearningModuleDto, LearningModuleVersionDto, TopicVersionDto } from "@/lib/redesign-contract";
import { compareLearningModuleVersions } from "@/lib/redesign-workspace";
import GapNotice from "./GapNotice";

type Props = {
  learningModules: LearningModuleDto[];
  currentVersionsByLearningModuleId: Map<Id, LearningModuleVersionDto | null>;
  versionsByLearningModuleId: Map<Id, LearningModuleVersionDto[]>;
  topicVersionsById: Map<Id, TopicVersionDto>;
  onRestoreVersion: (learningModuleId: Id, versionId: Id) => Promise<void>;
};

export default function RevisionHistoryPanel({
  learningModules,
  currentVersionsByLearningModuleId,
  versionsByLearningModuleId,
  topicVersionsById,
  onRestoreVersion,
}: Props) {
  const [selectedLearningModuleId, setSelectedLearningModuleId] = useState(learningModules[0]?.id ?? "");
  const [compareVersionId, setCompareVersionId] = useState("");
  const [restoreState, setRestoreState] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });

  const selectedVersions = versionsByLearningModuleId.get(selectedLearningModuleId) ?? [];
  const currentVersion = currentVersionsByLearningModuleId.get(selectedLearningModuleId) ?? null;

  const comparedVersion =
    selectedVersions.find((version) => version.id === compareVersionId) ??
    currentVersion ??
    selectedVersions[selectedVersions.length - 1] ??
    null;

  const comparison =
    currentVersion && comparedVersion
      ? compareLearningModuleVersions({
          base: currentVersion,
          compare: comparedVersion,
          topicVersionsById,
        })
      : null;

  async function handleRestore(versionId: Id) {
    setRestoreState({ busy: true, error: null });
    try {
      await onRestoreVersion(selectedLearningModuleId, versionId);
      setCompareVersionId("");
    } catch (caught) {
      setRestoreState({
        busy: false,
        error: caught instanceof Error ? caught.message : "Unable to restore revision.",
      });
      return;
    }
    setRestoreState({ busy: false, error: null });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Revision History</h2>
          <p className="mt-1 text-sm text-slate-600">
            Compare immutable learning module revisions before restoring older curriculum decisions as a new revision.
          </p>
        </div>
        <label className="text-sm text-slate-700">
          <span className="mr-2 font-medium">Learning module</span>
          <select
            value={selectedLearningModuleId}
            onChange={(event) => {
              setSelectedLearningModuleId(event.target.value);
              setCompareVersionId("");
            }}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            {learningModules.map((learningModule) => (
              <option key={learningModule.id} value={learningModule.id}>
                {currentVersionsByLearningModuleId.get(learningModule.id)?.title ?? learningModule.stableCode}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedVersions.length === 0 ? (
        <div className="mt-4">
          <GapNotice title="No revisions yet.">This learning module has not been versioned yet.</GapNotice>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-medium text-slate-900">Published revisions</h3>
              <select
                value={compareVersionId}
                onChange={(event) => setCompareVersionId(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Compare current version to itself</option>
                {selectedVersions.map((version) => (
                  <option key={version.id} value={version.id}>
                    Revision {version.revision}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              {selectedVersions
                .slice()
                .sort((left, right) => right.revision - left.revision)
                .map((version) => {
                  const isCurrent = version.id === currentVersion?.id;
                  return (
                    <div key={version.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Revision {version.revision}</p>
                          <p className="text-sm text-slate-600">{version.changeSummary ?? "No change summary recorded."}</p>
                        </div>
                        {isCurrent ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                            Current
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestore(version.id)}
                            disabled={restoreState.busy}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                          >
                            Restore as new revision
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-medium text-slate-900">Comparison</h3>
            {comparison ? (
              <div className="mt-3 space-y-4 text-sm text-slate-700">
                <div>
                  <p className="font-medium text-slate-900">
                    Current revision {currentVersion?.revision} vs. revision {comparedVersion?.revision}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {comparison.summary.length === 0 ? (
                      <li>No prose-level changes in title, description, notes, or objectives.</li>
                    ) : (
                      comparison.summary.map((line) => <li key={line}>{line}</li>)
                    )}
                  </ul>
                </div>

                <div>
                  <p className="font-medium text-slate-900">Topic changes</p>
                  {comparison.topicChanges.length === 0 ? (
                    <p className="mt-2">No topic additions, removals, or reordering.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {comparison.topicChanges.map((change) => (
                        <div key={`${change.kind}-${change.title}`} className="rounded-lg bg-white px-3 py-2">
                          <p className="font-medium text-slate-900">{change.title}</p>
                          <p className="text-slate-600">
                            {change.kind === "added"
                              ? `Added at position ${change.compareSequence}.`
                              : change.kind === "removed"
                                ? `Removed from position ${change.baseSequence}.`
                                : `Moved from ${change.baseSequence} to ${change.compareSequence}.`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Select a module with at least one published revision to compare.</p>
            )}

            {restoreState.error ? <p className="mt-4 text-sm text-rose-700">{restoreState.error}</p> : null}
          </div>
        </div>
      )}
    </section>
  );
}
