"use client";

import { useState, type FormEvent } from "react";
import ModeToggle, { type PrototypeMode } from "./ModeToggle";

interface Props {
  courseTitle: string;
  courseCode: string;
  termLabel: string;
  mode: PrototypeMode;
  onModeChange: (mode: PrototypeMode) => void;
  onSearch: (q: string) => void;
  onOpenTopics: () => void;
  onOpenActivityTypes: () => void;
  onOpenCalendar: () => void;
  searchQuery: string;
}

export default function CourseHeader({
  courseTitle,
  courseCode,
  termLabel,
  mode,
  onModeChange,
  onSearch,
  onOpenTopics,
  onOpenActivityTypes,
  onOpenCalendar,
  searchQuery,
}: Props) {
  const [localQ, setLocalQ] = useState(searchQuery);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    onSearch(localQ);
  }

  return (
    <header className="flex min-h-[44px] min-w-0 flex-wrap items-center gap-3 border-b border-[--color-line] bg-[--color-surface] px-4 py-2 sm:gap-4">
      <div className="flex w-full min-w-0 shrink-0 items-baseline gap-2 sm:w-auto">
        <span className="text-xs font-mono text-[--color-ink-muted] tracking-wide">{courseCode}</span>
        <h1 className="text-sm font-semibold text-[--color-ink] leading-tight">{courseTitle}</h1>
        <span className="text-xs text-[--color-ink-muted]">{termLabel}</span>
      </div>

      <form onSubmit={handleSearch} role="search" className="order-3 w-full min-w-0 sm:order-none sm:max-w-xs sm:flex-1">
        <label htmlFor="ws-search" className="sr-only">Search activities and topics</label>
        <input
          id="ws-search"
          type="search"
          value={localQ}
          onChange={(e) => {
            setLocalQ(e.target.value);
            onSearch(e.target.value);
          }}
          placeholder="Search activities, topics…"
          className="w-full px-2 py-1 text-xs bg-[--color-paper-inset] border border-[--color-line] rounded text-[--color-ink] placeholder:text-[--color-ink-faint] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]"
        />
      </form>

      <div
        role="group"
        aria-label="Workspace tools"
        className="inline-flex max-w-full shrink-0 items-center overflow-x-auto rounded-full border border-[--color-line] bg-[--color-paper-inset] p-1"
      >
        <button
          type="button"
          onClick={onOpenTopics}
          className="rounded-full px-2 py-1 text-xs font-medium text-[--color-ink-soft] transition hover:bg-[--color-surface] hover:text-[--color-ink]"
        >
          Topics
        </button>
        <button
          type="button"
          onClick={onOpenActivityTypes}
          className="rounded-full px-2 py-1 text-xs font-medium text-[--color-ink-soft] transition hover:bg-[--color-surface] hover:text-[--color-ink]"
        >
          Activity types
        </button>
        <button
          type="button"
          onClick={onOpenCalendar}
          className="rounded-full px-2 py-1 text-xs font-medium text-[--color-ink-soft] transition hover:bg-[--color-surface] hover:text-[--color-ink]"
        >
          Calendar
        </button>
      </div>

      <div className="ml-auto">
        <ModeToggle mode={mode} onChange={onModeChange} />
      </div>
    </header>
  );
}
