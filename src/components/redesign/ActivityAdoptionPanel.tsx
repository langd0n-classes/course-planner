"use client";

import { useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type { TermAdoptionPreviewRequest, TermAdoptionPreviewResponse } from "@/lib/redesign-api-client";

type Props = {
  termId: string;
  selections: TermAdoptionPreviewRequest["learningModuleVersionSelections"];
  onAdopted: () => void | Promise<void>;
};

export default function ActivityAdoptionPanel({ termId, selections, onAdopted }: Props) {
  const [preview, setPreview] = useState<TermAdoptionPreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(apply: boolean) {
    setBusy(true);
    setError(null);
    const request = { learningModuleVersionSelections: selections, crossCuttingSelections: [] };
    try {
      if (apply && preview) {
        await redesignApi.applyTermActivityAdoption(termId, {
          ...request, previewToken: preview.previewToken,
          expectedCurrentActivityCount: preview.expectedCurrentActivityCount,
        });
        setPreview(null);
        await onAdopted();
      } else {
        setPreview(await redesignApi.previewTermActivityAdoption(termId, request));
      }
    } catch (err) {
      setPreview(null);
      setError(`${err instanceof Error ? err.message : "Activity adoption failed"}. Preview again to retry.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm text-slate-700">
      <p>Adopt Activities from the planned learning modules. Milestone dates will be set separately.</p>
      <button type="button" disabled={busy} onClick={() => void run(false)}
        className="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-50">
        {busy ? "Working…" : "Preview Activity adoption"}
      </button>
      {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
      {preview ? (
        <div className="space-y-3" aria-live="polite">
          {preview.candidates.length === 0 ? <p>All selected Activities are already adopted.</p> : (
            <>
              <ul className="space-y-3">
                {preview.candidates.map((candidate) => (
                  <li key={candidate.activityId}>
                    <p>{candidate.adoptedLabel}: {candidate.milestoneCount} {candidate.milestoneCount === 1 ? "milestone" : "milestones"} to create.</p>
                    {candidate.standaloneMilestones.map((milestone) => (
                      <p key={milestone.sourceTemplateId} className="mt-1 text-amber-800">
                        {milestone.label} will stand alone: {milestone.reason}.
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
              <button type="button" disabled={busy} onClick={() => void run(true)}
                className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">
                Adopt Activities
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
