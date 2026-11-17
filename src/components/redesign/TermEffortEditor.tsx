"use client";
import { useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  TermActivityRevisionDto,
  TermActivityRevisionPreviewRequest,
  TermActivityRevisionPreviewResponse,
} from "@/lib/redesign-contract";
import { effectiveEffort, formatEffortRange } from "@/lib/effort";
import EffortRangeInput, { rangeInput, readRange } from "./EffortRangeInput";

export default function TermEffortEditor({
  revision,
  editable,
  advancePointer,
  onApplied,
}: {
  revision: TermActivityRevisionDto;
  editable: boolean;
  advancePointer: "planned" | "delivered";
  onApplied: () => Promise<void> | void;
}) {
  const detail = revision.detail;
  const [override, setOverride] = useState(
    detail.behaviorFamily !== "meeting" && detail.effortMinMinutes != null,
  );
  const [value, setValue] = useState(
    rangeInput(
      detail.behaviorFamily === "meeting"
        ? null
        : effectiveEffort(null, detail),
    ),
  );
  const [preview, setPreview] = useState<{
    response: TermActivityRevisionPreviewResponse;
    request: TermActivityRevisionPreviewRequest;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (detail.behaviorFamily === "meeting") return null;
  const base = effectiveEffort(revision.baseEffort, null);
  async function previewOverride() {
    if (detail.behaviorFamily === "meeting") return;
    setError(null);
    setBusy(true);
    try {
      const range = override ? readRange(value) : null;
      if (override && !range) throw new Error("Enter both override bounds.");
      const request: TermActivityRevisionPreviewRequest = {
        title: revision.title,
        summary: revision.summary,
        changeReason: "Student effort override changed",
        detail: {
          ...detail,
          effortMinMinutes: range?.minMinutes ?? null,
          effortMaxMinutes: range?.maxMinutes ?? null,
        },
        topicActions: revision.topicActions,
        milestones: revision.milestones,
        advancePointer,
      };
      const response = await redesignApi.previewTermActivityRevision(
        revision.termActivityId,
        request,
      );
      setPreview({ request, response });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to preview effort.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await redesignApi.applyTermActivityRevision(revision.termActivityId, {
        ...preview.request,
        previewToken: preview.response.previewToken,
        expectedCurrentRevisionId: preview.response.expectedCurrentRevisionId,
        advancePointer,
      });
      setPreview(null);
      await onApplied();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to apply effort.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-slate-600">
        Activity version: {base ? formatEffortRange(base) : "Not sized"}
      </p>
      {editable ? (
        <>
          <label className="block text-sm">
            <input
              type="checkbox"
              aria-label="Override student effort"
              checked={override}
              onChange={(event) => {
                setOverride(event.target.checked);
                if (event.target.checked) setValue(rangeInput(base));
                setPreview(null);
              }}
            />{" "}
            Override student effort
          </label>
          {override ? (
            <EffortRangeInput
              label="Term override"
              value={value}
              onChange={(next) => {
                setValue(next);
                setPreview(null);
              }}
              error={error}
            />
          ) : error ? (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void previewOverride()}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            Preview effort override
          </button>
          <div aria-label="Effort preview" aria-live="polite">
            {preview ? (
              <div className="border-t border-slate-200 pt-3">
                <p className="text-sm">
                  {override
                    ? `Proposed effort: ${formatEffortRange(readRange(value)!)}`
                    : "Use the Activity version’s estimate."}
                </p>
                {preview.response.impact.issues.map((issue) => (
                <p key={issue.code} className="text-sm">
                  {issue.message}
                </p>
              ))}
                <button
                type="button"
                disabled={busy}
                onClick={() => void apply()}
                className="mt-2 rounded bg-slate-900 px-3 py-2 text-sm text-white"
              >
                Apply effort override
              </button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
