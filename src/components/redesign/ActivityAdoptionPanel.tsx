"use client";

import { useId, useRef, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type { TermAdoptionPreviewRequest, TermAdoptionPreviewResponse } from "@/lib/redesign-api-client";

type Props = {
  termId: string;
  selections: TermAdoptionPreviewRequest["learningModuleVersionSelections"];
  onAdopted: () => void | Promise<void>;
};

export default function ActivityAdoptionPanel({ termId, selections, onAdopted }: Props) {
  const headingId = useId();
  const running = useRef(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<TermAdoptionPreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(apply: boolean) {
    if (running.current) return;
    running.current = true;
    setApplying(apply);
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
      if (err && typeof err === "object" && "status" in err && err.status === 409) {
        setPreview(null);
        setError("The Term changed. Preview again.");
      } else {
        setError(err instanceof Error ? err.message : "Activity adoption failed");
      }
    } finally {
      running.current = false;
      setApplying(false);
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
      <h2 id={headingId} className="font-semibold text-slate-900">Adopt Activities</h2>
      <p>Adopt Activities from the planned learning modules. Milestone dates will be set separately.</p>
      <button type="button" disabled={busy} onClick={() => void run(false)}
        className="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-50">
        {busy ? "Working…" : "Preview Activity adoption"}
      </button>
      {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
      <div className="space-y-3" aria-live="polite">
        {preview ? (
          <>
            {preview.alreadyAdopted.length ? <p>Already in this Term: {preview.alreadyAdopted.map((row) => row.adoptedLabel).join(", ")}</p> : null}
            {preview.candidates.length === 0 ? <p>All selected Activities are already adopted.</p> : (
              <>
                <ul className="space-y-3">
                  {preview.candidates.map((candidate) => (
                    <li key={candidate.activityId}>
                      <p>{candidate.adoptedLabel}: {candidate.milestoneCount} {candidate.milestoneCount === 1 ? "milestone" : "milestones"} to create.</p>
                      {candidate.notCreatedMilestones.map((milestone) => (
                        <p key={milestone.sourceTemplateId} className="mt-1 text-amber-800">
                          {milestone.label} will not be created: {milestone.reason}. Add it by hand after adoption.
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
                <button type="button" disabled={busy} onClick={() => void run(true)}
                  className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">
                  {applying ? "Adopting Activities…" : "Adopt Activities"}
                </button>
              </>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
