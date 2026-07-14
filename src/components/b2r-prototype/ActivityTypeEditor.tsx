"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";

import type {
  ActivityType,
  BehaviorFamily,
} from "../../lib/b2r-prototype-fixture";

const BEHAVIOR_FAMILIES: BehaviorFamily[] = [
  "Meeting",
  "Coursework",
  "Assessment",
];

const SHELL_CLASS =
  "space-y-4 rounded-lg border border-[--color-line] bg-[--color-surface] p-4 text-[--color-ink] shadow-sm";

const CARD_CLASS =
  "space-y-3 rounded border border-[--color-line] bg-[--color-paper] p-3 shadow-sm";

const LABEL_CLASS =
  "block text-[11px] font-semibold uppercase tracking-[0.18em] text-[--color-ink-muted]";

const INPUT_CLASS =
  "w-full rounded border border-[--color-line] bg-[--color-surface] px-3 py-2 text-sm text-[--color-ink] outline-none transition focus:border-[--color-accent] focus:ring-2 focus:ring-[--color-accent-tint]";

const CTA_CLASS =
  "inline-flex h-10 items-center justify-center rounded border border-[--color-accent] bg-[--color-accent-tint] px-4 text-sm font-medium text-[--color-ink] transition hover:bg-[--color-accent] hover:text-[--color-paper] focus:outline-none focus:ring-2 focus:ring-[--color-accent-tint]";

export interface ActivityTypeEditorProps {
  activityTypes: ActivityType[];
  onCreate: (next: { label: string; family: BehaviorFamily }) => void;
  onRename: (next: { id: string; label: string }) => void;
}

export function ActivityTypeEditor({
  activityTypes,
  onCreate,
  onRename,
}: ActivityTypeEditorProps) {
  const formId = useId();
  const [draftLabels, setDraftLabels] = useState<Record<string, string>>({});
  const [newLabel, setNewLabel] = useState("");
  const [newFamily, setNewFamily] = useState<BehaviorFamily>("Meeting");

  const commitRename = (activityType: ActivityType, nextLabel: string) => {
    const normalized = nextLabel.trim();

    setDraftLabels((current) => {
      const next = { ...current };
      delete next[activityType.id];
      return next;
    });

    if (!normalized || normalized === activityType.label) {
      return;
    }

    onRename({ id: activityType.id, label: normalized });
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const label = newLabel.trim();
    if (!label) {
      return;
    }

    onCreate({ label, family: newFamily });
    setNewLabel("");
    setNewFamily("Meeting");
  };

  return (
    <section className={SHELL_CLASS}>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[--color-ink-muted]">
          Activity labels
        </h2>
        <p className="text-sm text-[--color-ink-soft]">
          Labels are course-specific while families drive behavior.
        </p>
      </div>

      <form
        className={CARD_CLASS}
        onSubmit={handleCreate}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
          <div className="space-y-1">
            <label
              className={LABEL_CLASS}
              htmlFor={`${formId}-new-label`}
            >
              Instructor label
            </label>
            <input
              aria-describedby={`${formId}-new-label-help`}
              className={INPUT_CLASS}
              id={`${formId}-new-label`}
              placeholder="Recitation, Discussion, Lab"
              value={newLabel}
              onChange={(event) => setNewLabel(event.currentTarget.value)}
            />
            <p
              id={`${formId}-new-label-help`}
              className="text-xs text-[--color-ink-faint]"
            >
              Examples: Recitation, Discussion, Lab.
            </p>
          </div>

          <div className="space-y-1">
            <label
              className={LABEL_CLASS}
              htmlFor={`${formId}-new-family`}
            >
              Stable family
            </label>
            <select
              className={INPUT_CLASS}
              id={`${formId}-new-family`}
              value={newFamily}
              onChange={(event) =>
                setNewFamily(event.currentTarget.value as BehaviorFamily)
              }
            >
              {BEHAVIOR_FAMILIES.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          </div>

          <button
            className={CTA_CLASS}
            type="submit"
          >
            Add type
          </button>
        </div>
      </form>

      <ul className="overflow-hidden rounded border border-[--color-line] bg-[--color-paper]">
        {activityTypes.map((activityType) => {
          const labelId = `${formId}-${activityType.id}-label`;
          const instanceId = `${formId}-${activityType.id}-instance`;
          const inputId = `${formId}-${activityType.id}`;
          const draftValue = draftLabels[activityType.id] ?? activityType.label;

          return (
            <li
              key={activityType.id}
              className="grid gap-3 border-b border-[--color-line] px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-end"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label
                    className={LABEL_CLASS}
                    htmlFor={inputId}
                    id={labelId}
                  >
                    Instructor label
                  </label>
                  <span
                    className="text-[11px] text-[--color-ink-faint]"
                    id={instanceId}
                  >
                    {activityType.id}
                  </span>
                </div>
                <input
                  aria-labelledby={`${labelId} ${instanceId}`}
                  className={INPUT_CLASS}
                  id={inputId}
                  value={draftValue}
                  onBlur={(event) =>
                    commitRename(activityType, event.currentTarget.value)
                  }
                  onChange={(event) => {
                    const nextValue = event.currentTarget.value;
                    setDraftLabels((current) => ({
                      ...current,
                      [activityType.id]: nextValue,
                    }));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitRename(activityType, event.currentTarget.value);
                      event.currentTarget.blur();
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      setDraftLabels((current) => {
                        const next = { ...current };
                        delete next[activityType.id];
                        return next;
                      });
                      event.currentTarget.blur();
                    }
                  }}
                />
              </div>

              <div className="space-y-1 sm:text-right">
                <div className={LABEL_CLASS}>
                  Stable family
                </div>
                <div className="inline-flex min-w-0 items-center justify-center rounded-full border border-[--color-line] bg-[--color-paper-inset] px-3 py-1 text-sm font-medium text-[--color-ink-soft]">
                  {activityType.family}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default ActivityTypeEditor;
