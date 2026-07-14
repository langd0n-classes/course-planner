"use client";

export type PrototypeMode = "design" | "run";

interface Props {
  mode: PrototypeMode;
  onChange: (mode: PrototypeMode) => void;
}

export default function ModeToggle({ mode, onChange }: Props) {
  return (
    <div role="group" aria-label="Workspace mode" className="flex rounded border border-[--color-line] overflow-hidden text-xs font-medium">
      <button
        type="button"
        aria-pressed={mode === "design"}
        onClick={() => onChange("design")}
        className={`px-3 py-1 transition-colors ${
          mode === "design"
            ? "bg-[--color-accent] text-white"
            : "bg-[--color-surface] text-[--color-ink-soft] hover:bg-[--color-paper-inset]"
        }`}
      >
        Design
      </button>
      <button
        type="button"
        aria-pressed={mode === "run"}
        onClick={() => onChange("run")}
        className={`px-3 py-1 border-l border-[--color-line] transition-colors ${
          mode === "run"
            ? "bg-[--color-accent] text-white"
            : "bg-[--color-surface] text-[--color-ink-soft] hover:bg-[--color-paper-inset]"
        }`}
      >
        Run
      </button>
    </div>
  );
}
