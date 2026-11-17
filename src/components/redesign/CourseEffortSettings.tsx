"use client";
import { useEffect, useId, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  CourseEffortSizeDto,
  CourseEffortPartKindDto,
} from "@/lib/redesign-contract";
import EffortRangeInput, { rangeInput, readRange } from "./EffortRangeInput";

type Entry = CourseEffortPartKindDto | CourseEffortSizeDto;
function VocabularyRow({
  entry,
  isSize,
  prefix,
  save,
  remove,
  up,
  down,
}: {
  entry?: Entry;
  isSize: boolean;
  prefix: string;
  save: (
    label: string,
    range: { minMinutes: number; maxMinutes: number } | null,
  ) => Promise<void>;
  remove?: () => Promise<void>;
  up?: () => Promise<void>;
  down?: () => Promise<void>;
}) {
  const [label, setLabel] = useState(entry?.label ?? "");
  const [value, setValue] = useState(
    rangeInput(entry && "minMinutes" in entry ? entry : null),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = useId();
  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 border-t border-slate-200 py-4">
      <label className="block text-sm text-slate-700">
        Label
        <input
          aria-label={`${prefix} label`}
          value={label}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => setLabel(event.target.value)}
          className="ml-2 rounded border border-slate-300 p-2"
        />
      </label>
      {isSize ? (
        <EffortRangeInput
          label={prefix}
          value={value}
          onChange={setValue}
          error={error}
        />
      ) : null}
      {error ? (
        <p
          id={errorId}
          role={isSize ? undefined : "alert"}
          className="text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (!label.trim()) throw new Error("Enter a label.");
              const range = isSize ? readRange(value) : null;
              if (isSize && !range)
                throw new Error("Enter both effort bounds.");
              await save(label.trim(), range);
              if (!entry) {
                setLabel("");
                setValue(rangeInput());
              }
            })
          }
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {entry
            ? `Save ${entry.label}`
            : isSize
              ? "Add size"
              : "Add part kind"}
        </button>
        {entry ? (
          <>
            <button
              type="button"
              disabled={busy || !up}
              aria-label={`Move ${entry.label} up`}
              onClick={() => up && void run(up)}
              className="text-sm underline disabled:opacity-50"
            >
              Move up
            </button>
            <button
              type="button"
              disabled={busy || !down}
              aria-label={`Move ${entry.label} down`}
              onClick={() => down && void run(down)}
              className="text-sm underline disabled:opacity-50"
            >
              Move down
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => remove && void run(remove)}
              className="text-sm underline"
            >
              Delete {entry.label}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
export default function CourseEffortSettings({
  courseId,
  onChanged,
}: {
  courseId: string;
  onChanged?: () => void;
}) {
  const [sizes, setSizes] = useState<CourseEffortSizeDto[]>([]);
  const [kinds, setKinds] = useState<CourseEffortPartKindDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
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
          setLoaded(true);
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [courseId]);
  async function reload() {
    const [s, k] = await Promise.all([
      redesignApi.listCourseEffortSizes(courseId),
      redesignApi.listCourseEffortPartKinds(courseId),
    ]);
    setSizes(s);
    setKinds(k);
    onChanged?.();
  }
  async function reorder(isSize: boolean, index: number, offset: number) {
    const ids = (isSize ? sizes : kinds).map((row) => row.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    if (isSize) await redesignApi.reorderCourseEffortSizes(courseId, ids);
    else await redesignApi.reorderCourseEffortPartKinds(courseId, ids);
    await reload();
  }
  return (
    <section
      aria-label="Course student effort sizes"
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h2 className="text-lg font-semibold text-slate-900">
        Student effort sizes
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Define this Course’s sizes and part kinds. Changing a size leaves saved
        Activity estimates as they were.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {error}
        </p>
      ) : !loaded ? (
        <p role="status">Loading effort settings…</p>
      ) : (
        <>
          {sizes.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No sizes defined.</p>
          ) : null}
          {sizes.map((entry, index) => (
            <VocabularyRow
              key={`${entry.id}-${entry.updatedAt}`}
              entry={entry}
              isSize
              prefix={entry.label}
              save={async (label, range) => {
                await redesignApi.updateCourseEffortSize(courseId, entry.id, {
                  label,
                  ...range!,
                });
                await reload();
              }}
              remove={async () => {
                await redesignApi.deleteCourseEffortSize(courseId, entry.id);
                await reload();
              }}
              up={index ? () => reorder(true, index, -1) : undefined}
              down={
                index < sizes.length - 1
                  ? () => reorder(true, index, 1)
                  : undefined
              }
            />
          ))}
          <VocabularyRow
            isSize
            prefix="New size"
            save={async (label, range) => {
              await redesignApi.createCourseEffortSize(courseId, {
                label,
                ...range!,
              });
              await reload();
            }}
          />
          <h3 className="mt-5 font-semibold text-slate-900">Part kinds</h3>
          {kinds.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              No part kinds defined.
            </p>
          ) : null}
          {kinds.map((entry, index) => (
            <VocabularyRow
              key={`${entry.id}-${entry.label}`}
              entry={entry}
              isSize={false}
              prefix={entry.label}
              save={async (label) => {
                await redesignApi.updateCourseEffortPartKind(
                  courseId,
                  entry.id,
                  { label },
                );
                await reload();
              }}
              remove={async () => {
                await redesignApi.deleteCourseEffortPartKind(
                  courseId,
                  entry.id,
                );
                await reload();
              }}
              up={index ? () => reorder(false, index, -1) : undefined}
              down={
                index < kinds.length - 1
                  ? () => reorder(false, index, 1)
                  : undefined
              }
            />
          ))}
          <VocabularyRow
            isSize={false}
            prefix="New part kind"
            save={async (label) => {
              await redesignApi.createCourseEffortPartKind(courseId, { label });
              await reload();
            }}
          />
        </>
      )}
    </section>
  );
}
