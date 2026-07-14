"use client";

import { useId, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import type { CalendarSlot, TermException } from "../../lib/b2r-prototype-fixture";

type TermExceptionKind = "canceled" | "moved" | "added";

const EXCEPTION_KIND_OPTIONS: Array<{
  value: TermExceptionKind;
  label: string;
  helper: string;
}> = [
  { value: "canceled", label: "Canceled", helper: "Remove the term meeting for that date." },
  { value: "moved", label: "Moved", helper: "Relocate the term meeting to another date." },
  { value: "added", label: "Added", helper: "Create an extra term-only meeting." },
];

const SHELL_CLASS =
  "rounded-xl border border-[--color-line] bg-[--color-surface] text-[--color-ink] shadow-sm";

const HEADER_CLASS = "border-b border-[--color-line] px-4 py-4 sm:px-5";

const STAT_CLASS =
  "rounded-lg border border-[--color-line] bg-[--color-paper] px-3 py-2";

const STAT_LABEL_CLASS =
  "text-[10px] uppercase tracking-[0.22em] text-[--color-ink-muted]";

const STAT_VALUE_CLASS = "mt-1 text-lg font-semibold text-[--color-ink]";

const SECTION_CLASS =
  "rounded-lg border border-[--color-line] bg-[--color-paper] p-4 shadow-sm";

const SECTION_EYEBROW_CLASS =
  "text-[10px] uppercase tracking-[0.28em] text-[--color-ink-faint]";

const SECTION_TITLE_CLASS = "mt-1 text-sm font-semibold text-[--color-ink]";

const SECTION_SUBTITLE_CLASS =
  "mt-1 text-xs leading-5 text-[--color-ink-soft]";

const LIST_EMPTY_CLASS =
  "rounded border border-dashed border-[--color-line] px-3 py-4 text-sm text-[--color-ink-soft]";

const ROW_CLASS =
  "grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 rounded border border-[--color-line] bg-[--color-surface] px-3 py-3";

const ROW_BODY_CLASS = "mt-1 text-xs leading-5 text-[--color-ink-soft]";

const TAG_BASE_CLASS =
  "rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.18em]";

const INPUT_CLASS =
  "w-full rounded border border-[--color-line] bg-[--color-surface] px-3 py-2 text-sm text-[--color-ink] outline-none transition placeholder:text-[--color-ink-faint] focus:border-[--color-accent] focus:ring-2 focus:ring-[--color-accent-tint]";

const CTA_CLASS =
  "inline-flex items-center justify-center rounded border border-[--color-accent] bg-[--color-accent-tint] px-4 py-2 text-sm font-medium text-[--color-ink] transition hover:bg-[--color-accent] hover:text-[--color-paper] focus:outline-none focus:ring-2 focus:ring-[--color-accent-tint]";

const SLOT_KIND_META: Record<
  CalendarSlot["type"],
  {
    label: string;
    tone: string;
    group: "class" | "special" | "finals";
  }
> = {
  class: {
    label: "Class day",
    tone: "border-[--color-line] bg-[--color-surface] text-[--color-ink]",
    group: "class",
  },
  holiday: {
    label: "Holiday",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    group: "special",
  },
  break: {
    label: "Break",
    tone: "border-sky-200 bg-sky-50 text-sky-800",
    group: "special",
  },
  "reading-day": {
    label: "Reading day",
    tone: "border-violet-200 bg-violet-50 text-violet-800",
    group: "special",
  },
  finals: {
    label: "Finals period",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
    group: "finals",
  },
};

const EXCEPTION_KIND_META: Record<
  TermExceptionKind,
  {
    label: string;
    tone: string;
  }
> = {
  canceled: {
    label: "Canceled",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
  },
  moved: {
    label: "Moved",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
  added: {
    label: "Added",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
};

export interface CalendarWorkspaceProps {
  institutionLabel: string;
  termLabel: string;
  calendarSlots: CalendarSlot[];
  termExceptions: TermException[];
  onAddException: (exception: TermException) => void;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function sortByDateThenLabel<T extends { date: string; label?: string; reason?: string }>(entries: T[]): T[] {
  return [...entries].sort((left, right) => {
    const dateDiff = left.date.localeCompare(right.date);
    if (dateDiff !== 0) return dateDiff;
    const leftText = left.label ?? left.reason ?? "";
    const rightText = right.label ?? right.reason ?? "";
    return leftText.localeCompare(rightText);
  });
}

function LedgerStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className={STAT_CLASS}>
      <div className={STAT_LABEL_CLASS}>{label}</div>
      <div className={STAT_VALUE_CLASS}>{value}</div>
    </div>
  );
}

function SectionShell({
  eyebrow,
  title,
  subtitle,
  children,
  accentClassName,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  accentClassName: string;
}) {
  return (
    <section className={`${SECTION_CLASS} ${accentClassName}`}>
      <div className="mb-4">
        <p className={SECTION_EYEBROW_CLASS}>{eyebrow}</p>
        <h3 className={SECTION_TITLE_CLASS}>{title}</h3>
        <p className={SECTION_SUBTITLE_CLASS}>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function RowList({
  rows,
  emptyMessage,
}: {
  rows: ReactNode[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className={LIST_EMPTY_CLASS}>{emptyMessage}</p>;
  }

  return <ul className="space-y-2">{rows}</ul>;
}

export function CalendarWorkspace({
  institutionLabel,
  termLabel,
  calendarSlots,
  termExceptions,
  onAddException,
}: CalendarWorkspaceProps) {
  const dateId = useId();
  const kindId = useId();
  const reasonId = useId();

  const [date, setDate] = useState("");
  const [kind, setKind] = useState<TermExceptionKind>("canceled");
  const [reason, setReason] = useState("");

  const sortedSlots = sortByDateThenLabel(calendarSlots);
  const sortedExceptions = sortByDateThenLabel(termExceptions);

  const classDaySlots = sortedSlots.filter((slot) => SLOT_KIND_META[slot.type].group === "class");
  const specialSlots = sortedSlots.filter((slot) => SLOT_KIND_META[slot.type].group === "special");
  const finalsSlots = sortedSlots.filter((slot) => SLOT_KIND_META[slot.type].group === "finals");

  const slotCounts = sortedSlots.reduce<Record<CalendarSlot["type"], number>>(
    (acc, slot) => {
      acc[slot.type] += 1;
      return acc;
    },
    {
      class: 0,
      holiday: 0,
      break: 0,
      finals: 0,
      "reading-day": 0,
    },
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedReason = reason.trim();
    if (!date || !trimmedReason) {
      return;
    }

    onAddException({
      date,
      kind,
      reason: trimmedReason,
    });

    setDate("");
    setKind("canceled");
    setReason("");
  };

  return (
    <section className={SHELL_CLASS}>
      <header className={HEADER_CLASS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] uppercase tracking-[0.32em] text-[--color-ink-faint]">
              Institution calendar inheritance
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[--color-ink]">
              {institutionLabel} calendar for {termLabel}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[--color-ink-soft]">
              The institution calendar is inherited into this term. Use term-only exceptions when the offering
              diverges from the source calendar.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:min-w-[460px]">
            <LedgerStat label="Periods" value={sortedSlots.length} />
            <LedgerStat label="Class days" value={slotCounts.class} />
            <LedgerStat label="Special" value={slotCounts.holiday + slotCounts.break + slotCounts["reading-day"]} />
            <LedgerStat label="Finals" value={slotCounts.finals} />
            <LedgerStat label="Term exceptions" value={sortedExceptions.length} />
          </div>
        </div>
      </header>

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1.3fr_0.9fr] lg:px-5">
        <div className="space-y-4">
          <SectionShell
            eyebrow="Inherited source"
            title={`${institutionLabel} calendar periods`}
            subtitle={`These periods come from the institution calendar and apply before ${termLabel}-specific changes.`}
            accentClassName="ring-1 ring-inset ring-[--color-line]"
          >
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.26em] text-[--color-ink-muted]">Class days</h4>
                  <span className="rounded-full border border-[--color-line] bg-[--color-paper-inset] px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[--color-ink-muted]">
                    Inherited
                  </span>
                </div>
                <RowList
                  emptyMessage={`No class days are present in the inherited calendar for ${institutionLabel}.`}
                  rows={classDaySlots.map((slot) => (
                    <li
                      key={`${slot.type}-${slot.date}-${slot.label}`}
                      className={ROW_CLASS}
                    >
                      <div>
                        <time className="text-sm font-semibold text-[--color-ink]" dateTime={slot.date}>
                          {formatDate(slot.date)}
                        </time>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[--color-ink-faint]">Inherited</div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`${TAG_BASE_CLASS} ${SLOT_KIND_META[slot.type].tone}`}>
                            {SLOT_KIND_META[slot.type].label}
                          </span>
                          <span className="truncate text-sm font-medium text-[--color-ink]">{slot.label}</span>
                        </div>
                        <p className={ROW_BODY_CLASS}>
                          Inherited from {institutionLabel} and available to {termLabel} unless a term-only exception is added.
                        </p>
                      </div>
                    </li>
                  ))}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.26em] text-[--color-ink-muted]">Special periods</h4>
                  <span className="rounded-full border border-[--color-line] bg-[--color-paper-inset] px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[--color-ink-muted]">
                    Holiday / break / reading day
                  </span>
                </div>
                <RowList
                  emptyMessage="No holidays, breaks, or reading days are listed in the inherited calendar."
                  rows={specialSlots.map((slot) => (
                    <li
                      key={`${slot.type}-${slot.date}-${slot.label}`}
                      className={ROW_CLASS}
                    >
                      <div>
                        <time className="text-sm font-semibold text-[--color-ink]" dateTime={slot.date}>
                          {formatDate(slot.date)}
                        </time>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[--color-ink-faint]">Inherited</div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`${TAG_BASE_CLASS} ${SLOT_KIND_META[slot.type].tone}`}>
                            {SLOT_KIND_META[slot.type].label}
                          </span>
                          <span className="truncate text-sm font-medium text-[--color-ink]">{slot.label}</span>
                        </div>
                        <p className={ROW_BODY_CLASS}>
                          Inherited from {institutionLabel}; the term follows this special period unless a term exception says otherwise.
                        </p>
                      </div>
                    </li>
                  ))}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.26em] text-[--color-ink-muted]">Finals period</h4>
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-rose-800">
                    Explicit
                  </span>
                </div>
                <RowList
                  emptyMessage="No finals period is listed in the inherited calendar."
                  rows={finalsSlots.map((slot) => (
                    <li
                      key={`${slot.type}-${slot.date}-${slot.label}`}
                      className={`${ROW_CLASS} border-rose-200 bg-rose-50`}
                    >
                      <div>
                        <time className="text-sm font-semibold text-[--color-ink]" dateTime={slot.date}>
                          {formatDate(slot.date)}
                        </time>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-rose-700">Finals</div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`${TAG_BASE_CLASS} ${SLOT_KIND_META[slot.type].tone}`}>
                            {SLOT_KIND_META[slot.type].label}
                          </span>
                          <span className="truncate text-sm font-medium text-[--color-ink]">{slot.label}</span>
                        </div>
                        <p className={ROW_BODY_CLASS}>
                          Finals are shown explicitly rather than folded into a generic class week.
                        </p>
                      </div>
                    </li>
                  ))}
                />
              </div>
            </div>
          </SectionShell>
        </div>

        <div className="space-y-4">
          <SectionShell
            eyebrow="Term-only ledger"
            title={`Term-only exceptions for ${termLabel}`}
            subtitle="These exceptions belong to the term offering only. They do not change the inherited institution calendar."
            accentClassName="ring-1 ring-inset ring-amber-200/70"
          >
            <RowList
              emptyMessage={`No term-only exceptions have been added to ${termLabel} yet.`}
              rows={sortedExceptions.map((exception) => {
                const meta = EXCEPTION_KIND_META[exception.kind as TermExceptionKind] ?? EXCEPTION_KIND_META.canceled;
                return (
                  <li
                    key={`${exception.kind}-${exception.date}-${exception.reason}`}
                    className="rounded border border-[--color-line] bg-[--color-surface] px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <time className="text-sm font-semibold text-[--color-ink]" dateTime={exception.date}>
                          {formatDate(exception.date)}
                        </time>
                        <p className={ROW_BODY_CLASS}>{exception.reason}</p>
                      </div>
                      <span className={`shrink-0 ${TAG_BASE_CLASS} ${meta.tone}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-[--color-ink-faint]">
                      Applies to {termLabel} only
                    </div>
                  </li>
                );
              })}
            />
          </SectionShell>

          <SectionShell
            eyebrow="Add exception"
            title="Add a term-only exception"
            subtitle={`Use this form to add a date-specific change for ${termLabel}. Instructor-wide exceptions are not offered here.`}
            accentClassName="ring-1 ring-inset ring-emerald-200/70"
          >
            <form className="space-y-3" onSubmit={handleSubmit} aria-label={`Add term-only exception for ${termLabel}`}>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-[--color-ink-muted]" htmlFor={dateId}>
                  Exception date
                </label>
                <input
                  id={dateId}
                  name="date"
                  type="date"
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-[--color-ink-muted]" htmlFor={kindId}>
                  Exception kind
                </label>
                <select
                  id={kindId}
                  name="kind"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as TermExceptionKind)}
                  className={INPUT_CLASS}
                >
                  {EXCEPTION_KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs leading-5 text-[--color-ink-faint]">
                  {EXCEPTION_KIND_OPTIONS.find((option) => option.value === kind)?.helper}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-[--color-ink-muted]" htmlFor={reasonId}>
                  Reason
                </label>
                <textarea
                  id={reasonId}
                  name="reason"
                  required
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Explain why this term needs a local exception"
                />
              </div>

              <div className="rounded border border-dashed border-[--color-line] bg-[--color-paper-inset] px-3 py-2 text-xs leading-5 text-[--color-ink-soft]">
                This is term-only by design. The inherited institution calendar remains unchanged.
              </div>

              <button
                type="submit"
                className={CTA_CLASS}
              >
                Add term-only exception
              </button>
            </form>
          </SectionShell>
        </div>
      </div>
    </section>
  );
}
