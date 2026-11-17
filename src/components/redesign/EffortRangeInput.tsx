"use client";
import { useId } from "react";
import {
  parseHoursMinutes,
  validateEffort,
  type EffortRange,
} from "@/lib/effort";

export type RangeInput = {
  lowHours: string;
  lowMinutes: string;
  highHours: string;
  highMinutes: string;
};
export function rangeInput(range?: EffortRange | null): RangeInput {
  return range
    ? {
        lowHours: String(Math.floor(range.minMinutes / 60)),
        lowMinutes: String(range.minMinutes % 60),
        highHours: String(Math.floor(range.maxMinutes / 60)),
        highMinutes: String(range.maxMinutes % 60),
      }
    : { lowHours: "", lowMinutes: "", highHours: "", highMinutes: "" };
}
export function readRange(value: RangeInput): EffortRange | null {
  if (Object.values(value).every((part) => !part.trim())) return null;
  return validateEffort(
    parseHoursMinutes(value.lowHours, value.lowMinutes),
    parseHoursMinutes(value.highHours, value.highMinutes),
  );
}
export default function EffortRangeInput({
  label,
  value,
  onChange,
  error,
  disabled = false,
}: {
  label: string;
  value: RangeInput;
  onChange: (value: RangeInput) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const errorId = useId();
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-medium text-slate-700">{label}</legend>
      <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["lowHours", "low hours"],
            ["lowMinutes", "low minutes"],
            ["highHours", "high hours"],
            ["highMinutes", "high minutes"],
          ] as const
        ).map(([key, text]) => (
          <label key={key} className="text-xs text-slate-600">
            {text}
            <input
              aria-label={`${label} ${text}`}
              type="number"
              min="0"
              max={key.endsWith("Minutes") ? 59 : 1000}
              step="1"
              value={value[key]}
              onChange={(event) =>
                onChange({ ...value, [key]: event.target.value })
              }
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 text-sm tabular-nums disabled:bg-slate-100"
            />
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
