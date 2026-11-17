"use client";
import { useEffect, useId, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  ActivityVersionDto,
  CourseEffortSizeDto,
  CourseEffortPartKindDto,
  EffortPartInput,
} from "@/lib/redesign-contract";
import {
  effectiveEffort,
  findEffortSize,
  formatEffortRange,
  sumEffortParts,
} from "@/lib/effort";
import EffortRangeInput, {
  rangeInput,
  readRange,
  type RangeInput,
} from "./EffortRangeInput";

type PartInput = {
  label: string;
  partKindId: string | null;
  note: string;
  range: RangeInput;
};
export default function ActivityEffortEditor({
  courseId,
  version,
  onSaved,
  effortSettingsRevision,
}: {
  courseId: string;
  effortSettingsRevision?: number;
  version: ActivityVersionDto;
  onSaved: (version: ActivityVersionDto) => void;
}) {
  const [sizes, setSizes] = useState<CourseEffortSizeDto[]>([]);
  const [kinds, setKinds] = useState<CourseEffortPartKindDto[]>([]);
  const [value, setValue] = useState(
    rangeInput(
      version.detail.behaviorFamily === "meeting"
        ? null
        : effectiveEffort(version.detail, null),
    ),
  );
  const [parts, setParts] = useState<PartInput[]>(
    (version.effortParts ?? []).map((part) => ({
      label: part.label,
      partKindId: part.partKindId ?? null,
      note: part.note ?? "",
      range: rangeInput(part),
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [publish, setPublish] = useState(false);
  const errorId = useId();
  useEffect(() => {
    let active = true;
    Promise.all([
      redesignApi.listCourseEffortSizes(courseId),
      redesignApi.listCourseEffortPartKinds(courseId),
    ])
      .then(([s, k]) => {
        if (active) {
          setSizes(s);
          setKinds(k);
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [courseId, effortSettingsRevision]);
  let total = null;
  try {
    total = sumEffortParts(
      parts.map((part) => {
        const range = readRange(part.range);
        if (!range) throw new Error("Incomplete part");
        return range;
      }),
    );
  } catch {
    /* Validation is shown on save. */
  }
  let selectedSize = "";
  try {
    selectedSize = findEffortSize(sizes, readRange(value))?.id ?? "";
  } catch {
    /* Incomplete typed range. */
  }
  function changePart(index: number, patch: Partial<PartInput>) {
    setParts((current) =>
      current.map((part, i) => (i === index ? { ...part, ...patch } : part)),
    );
    setError(null);
  }
  async function save() {
    if (version.detail.behaviorFamily === "meeting") return;
    setError(null);
    setStatus("");
    try {
      const parsedParts: EffortPartInput[] = parts.map((part, sequence) => {
        const range = readRange(part.range);
        if (!part.label.trim() || !range)
          throw new Error(
            `Part ${sequence + 1} needs a label and both effort bounds.`,
          );
        return {
          ...range,
          sequence,
          label: part.label.trim(),
          partKindId: part.partKindId,
          note: part.note || null,
        };
      });
      const range = parsedParts.length
        ? sumEffortParts(parsedParts)
        : readRange(value);
      setSaving(true);
      const saved = await redesignApi.createActivityVersion(
        version.activityId,
        {
          title: version.title,
          summary: version.summary,
          activityTypeVersionId: version.activityTypeVersionId,
          expectedCurrentVersionId: version.id,
          detail: {
            ...version.detail,
            effortMinMinutes: range?.minMinutes ?? null,
            effortMaxMinutes: range?.maxMinutes ?? null,
          },
          effortParts: parsedParts,
          milestoneTemplates: version.milestoneTemplates,
          publish,
        },
      );
      onSaved(saved);
      setStatus(publish ? "Effort published." : "Effort draft saved.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save effort.",
      );
    } finally {
      setSaving(false);
    }
  }
  if (version.detail.behaviorFamily === "meeting") return null;
  return (
    <section
      className="mt-5 space-y-3 border-t border-slate-200 pt-4"
      aria-label="Estimated student effort"
    >
      <h4 className="font-semibold text-slate-900">Estimated student effort</h4>
      <p className="text-sm text-slate-600">
        For the whole item. Parts, when present, determine the total.
      </p>
      <label className="block text-sm text-slate-700">
        Course size
        <select
          aria-label="Course size"
          disabled={parts.length > 0}
          value={selectedSize}
          onChange={(event) => {
            const size = sizes.find((s) => s.id === event.target.value);
            if (size) setValue(rangeInput(size));
          }}
          className="ml-2 rounded border border-slate-300 bg-white p-2"
        >
          <option value="">Custom range</option>
          {sizes.map((size) => (
            <option key={size.id} value={size.id}>
              {size.label} · {formatEffortRange(size)}
            </option>
          ))}
        </select>
      </label>
      <EffortRangeInput
        label="Estimate"
        value={parts.length && total ? rangeInput(total) : value}
        onChange={(next) => {
          setValue(next);
          setError(null);
        }}
        disabled={parts.length > 0}
        error={parts.length ? null : error}
      />
      {parts.map((part, index) => (
        <fieldset
          key={index}
          className="space-y-2 border-t border-slate-200 pt-3"
        >
          <legend className="text-sm font-medium">Part {index + 1}</legend>
          <label className="block text-sm">
            Kind
            <select
              aria-label={`Part ${index + 1} kind`}
              value={part.partKindId ?? ""}
              onChange={(event) => {
                const kind = kinds.find((k) => k.id === event.target.value);
                changePart(index, {
                  partKindId: kind?.id ?? null,
                  ...(kind ? { label: kind.label } : {}),
                });
              }}
              className="ml-2 rounded border border-slate-300 bg-white p-2"
            >
              <option value="">Typed label</option>
              {kinds.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Label
            <input
              aria-label={`Part ${index + 1} label`}
              value={part.label}
              onChange={(event) =>
                changePart(index, { label: event.target.value })
              }
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className="ml-2 rounded border border-slate-300 p-2"
            />
          </label>
          <EffortRangeInput
            label={`Part ${index + 1}`}
            value={part.range}
            onChange={(range) => changePart(index, { range })}
            error={error}
          />
          <label className="block text-sm">
            Note
            <input
              aria-label={`Part ${index + 1} note`}
              value={part.note}
              onChange={(event) =>
                changePart(index, { note: event.target.value })
              }
              className="ml-2 rounded border border-slate-300 p-2"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              setParts((current) => current.filter((_, i) => i !== index))
            }
            className="text-sm underline"
          >
            Remove part {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() =>
          setParts((current) => [
            ...current,
            { label: "", partKindId: null, note: "", range: rangeInput() },
          ])
        }
        className="rounded border border-slate-300 px-3 py-2 text-sm"
      >
        Add part
      </button>
      {parts.length ? (
        <p aria-live="polite" className="text-sm font-medium">
          Total: {total ? formatEffortRange(total) : "Enter each part’s range"}
        </p>
      ) : null}
      {error && parts.length ? (
        <p id={errorId} className="text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <label className="block text-sm">
        <input
          type="checkbox"
          checked={publish}
          onChange={(event) => setPublish(event.target.checked)}
        />{" "}
        Publish this version
      </label>
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
      >
        {saving
          ? "Saving effort…"
          : publish
            ? "Publish effort"
            : "Save effort draft"}
      </button>
      <p role="status" className="text-sm text-slate-600">
        {status}
      </p>
    </section>
  );
}
