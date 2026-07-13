"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AcademicCalendarDto,
  CalendarSlotCandidateDto,
  CalendarMaterializationConflictDto,
  CreateTermPreviewResponse,
  Id,
  InstitutionDto,
  MeetingPatternDto,
} from "@/lib/redesign-contract";
import { redesignApi } from "@/lib/redesign-api-client";
import {
  capacityBadgeClass,
  formatCapacitySourceLabel,
  formatInstructionalCapacityLabel,
  isCapacityAdvisory,
} from "./CalendarCapacityPresentation";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

type FormData = {
  institutionId: Id;
  academicCalendarId: Id;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  selectedDays: string[];
};

type Props = {
  courseId: Id;
  institutions: InstitutionDto[];
  calendars: AcademicCalendarDto[];
  onTermCreated: () => void;
};

type PanelState =
  | { phase: "form"; submitting: boolean; error: string | null }
  | { phase: "preview"; preview: CreateTermPreviewResponse; formData: FormData; applying: boolean; error: string | null };

function buildMeetingPattern(selectedDays: string[]): MeetingPatternDto {
  return {
    roles: [
      {
        roleKey: "lecture",
        label: "Lecture",
        sessionType: "lecture",
        days: selectedDays,
      },
    ],
  };
}

function formatSlotTypeLabel(slotType: CalendarSlotCandidateDto["slotType"]) {
  switch (slotType) {
    case "class_day":
      return "Class day";
    case "holiday":
      return "Holiday";
    case "finals":
      return "Finals";
    case "break_day":
      return "Break day";
  }
}

function formatProvenanceLabel(source: CalendarSlotCandidateDto["provenance"][number]["source"]) {
  switch (source) {
    case "academic_calendar_event":
      return "Academic calendar event";
    case "instructor_override":
      return "Instructor override";
    case "meeting_role_pattern":
      return "Meeting role pattern";
  }
}

export default function CreateTermPanel({ courseId, institutions, calendars, onTermCreated }: Props) {
  const initialInstitutionId = institutions[0]?.id ?? "";
  const [institutionId, setInstitutionId] = useState(initialInstitutionId);
  const [academicCalendarId, setAcademicCalendarId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [panelState, setPanelState] = useState<PanelState>({ phase: "form", submitting: false, error: null });

  const visibleCalendars = useMemo(
    () => calendars.filter((calendar) => calendar.institutionId === institutionId),
    [calendars, institutionId],
  );

  useEffect(() => {
    setInstitutionId(initialInstitutionId);
  }, [initialInstitutionId]);

  useEffect(() => {
    if (!visibleCalendars.some((calendar) => calendar.id === academicCalendarId)) {
      setAcademicCalendarId(visibleCalendars[0]?.id ?? "");
    }
  }, [academicCalendarId, visibleCalendars]);

  function toggleDay(day: string) {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
  }

  async function handlePreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData: FormData = { institutionId, academicCalendarId, code, name, startDate, endDate, selectedDays };
    setPanelState({ phase: "form", submitting: true, error: null });
    try {
      const preview = await redesignApi.previewTermCreation({
        courseId,
        institutionId,
        academicCalendarId,
        code,
        name,
        startDate,
        endDate,
        meetingPattern: buildMeetingPattern(selectedDays),
      });
      setPanelState({ phase: "preview", preview, formData, applying: false, error: null });
    } catch (err) {
      setPanelState({
        phase: "form",
        submitting: false,
        error: err instanceof Error ? err.message : "Preview failed.",
      });
    }
  }

  async function handleApply() {
    if (panelState.phase !== "preview") return;
    const { formData } = panelState;
    setPanelState({ ...panelState, applying: true, error: null });
    try {
      await redesignApi.applyTermCreation({
        courseId,
        institutionId: formData.institutionId,
        academicCalendarId: formData.academicCalendarId,
        code: formData.code,
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        meetingPattern: buildMeetingPattern(formData.selectedDays),
      });
      setCode("");
      setName("");
      setStartDate("");
      setEndDate("");
      setSelectedDays([]);
      setPanelState({ phase: "form", submitting: false, error: null });
      onTermCreated();
    } catch (err) {
      setPanelState({
        ...panelState,
        applying: false,
        error: err instanceof Error ? err.message : "Apply failed.",
      });
    }
  }

  function handleBackToForm() {
    setPanelState({ phase: "form", submitting: false, error: null });
  }

  const formDisabled =
    institutions.length === 0 ||
    visibleCalendars.length === 0 ||
    selectedDays.length === 0 ||
    (panelState.phase === "form" && panelState.submitting);

  if (panelState.phase === "preview") {
    const { preview, applying, error } = panelState;
    const classDays = preview.calendarSlotCandidates.filter((s) => s.slotType === "class_day");
    const nonClassDays = preview.calendarSlotCandidates.filter((s) => s.slotType !== "class_day");
    const previewClassDays = classDays.slice(0, 10);
    const previewClassDayDates = new Set(previewClassDays.map((slot) => slot.date));
    const capacityAdvisories = classDays.filter(isCapacityAdvisory);
    const additionalCapacityAdvisories = capacityAdvisories.filter((slot) => !previewClassDayDates.has(slot.date));
    const hasBlockers = preview.conflicts.length > 0;

    return (
      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="mb-4 border-b border-dashed border-line pb-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Preview, not yet applied</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-ink">{panelState.formData.name}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Review the proposed calendar before creating this term.
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-line bg-surface-sunken p-3">
            <dt className="text-xs uppercase tracking-wide text-ink-faint">Class days</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold text-ink">{classDays.length}</dd>
          </div>
          <div className="rounded border border-line bg-surface-sunken p-3">
            <dt className="text-xs uppercase tracking-wide text-ink-faint">Non-class slots</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold text-ink">{nonClassDays.length}</dd>
          </div>
          <div className="rounded border border-line bg-surface-sunken p-3">
            <dt className="text-xs uppercase tracking-wide text-ink-faint">Conflicts</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold text-rose-700">{preview.conflicts.length}</dd>
          </div>
        </dl>

        {preview.warnings.length > 0 ? (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">Warnings</p>
            <ul className="mt-2 list-disc pl-4 text-sm text-amber-800">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {preview.conflicts.length > 0 ? (
          <div className="mt-4 rounded border border-rose-200 bg-rose-50 p-3">
            <p className="text-sm font-medium text-rose-800">Conflicts (must resolve before applying)</p>
            <ul className="mt-2 list-disc pl-4 text-sm text-rose-700">
              {preview.conflicts.map((conflict: CalendarMaterializationConflictDto, i) => (
                <li key={i}>{conflict.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {classDays.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-ink-soft">Candidate class days (first 10)</p>
            <div className="mt-2 space-y-2">
              {previewClassDays.map((slot: CalendarSlotCandidateDto) => {
                if (!isCapacityAdvisory(slot)) {
                  return (
                    <div
                      key={slot.date}
                      aria-label={`Candidate class day ${slot.date}`}
                      className="flex flex-wrap items-center gap-2 rounded border border-line bg-surface-sunken px-3 py-2 text-xs text-ink-soft"
                    >
                      <span className="font-mono font-medium text-ink">{slot.date}</span>
                      <span className="uppercase tracking-wide text-ink-faint">
                        {formatSlotTypeLabel(slot.slotType)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-1 font-medium ${capacityBadgeClass(slot.instructionalCapacity)}`}
                        aria-label={`Instructional capacity: ${formatInstructionalCapacityLabel(slot.instructionalCapacity)}`}
                      >
                        {formatInstructionalCapacityLabel(slot.instructionalCapacity)}
                      </span>
                    </div>
                  );
                }

                return (
                  <article key={slot.date} className="rounded-lg border border-line bg-surface-sunken p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-medium text-ink">{slot.date}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-ink-faint">
                          {formatSlotTypeLabel(slot.slotType)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-medium ${capacityBadgeClass(slot.instructionalCapacity)}`}
                        aria-label={`Instructional capacity: ${formatInstructionalCapacityLabel(slot.instructionalCapacity)}`}
                      >
                        {formatInstructionalCapacityLabel(slot.instructionalCapacity)}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-soft">
                          Capacity source: {formatCapacitySourceLabel(slot.capacitySource)}
                        </span>
                        {slot.source ? (
                          <span className="rounded-full border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-soft">
                            Schedule source: {slot.source}
                          </span>
                        ) : null}
                      </div>

                      {slot.capacityReason ? <p className="text-sm text-ink-muted">{slot.capacityReason}</p> : null}
                    </div>

                    {slot.provenance.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-ink-faint">
                        {slot.provenance.map((entry, index) => (
                          <li key={`${entry.source}-${entry.referenceId ?? "none"}-${index}`}>
                            <span className="font-medium text-ink-muted">{formatProvenanceLabel(entry.source)}:</span>{" "}
                            {entry.detail}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                );
              })}
              {classDays.length > 10 ? (
                <span className="inline-flex rounded-lg bg-paper-inset px-2 py-1 text-xs text-ink-muted">
                  +{classDays.length - 10} more
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {capacityAdvisories.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-ink-soft">Capacity advisories</p>
            <p className="mt-1 text-xs text-ink-faint">
              {additionalCapacityAdvisories.length > 0
                ? `${additionalCapacityAdvisories.length} ${
                    additionalCapacityAdvisories.length === 1 ? "advisory" : "advisories"
                  } beyond the first ten are listed here.`
                : "All advisory class days are already visible in the first-ten preview above."}
            </p>
            {additionalCapacityAdvisories.length > 0 ? (
              <div className="mt-2 space-y-2">
                {additionalCapacityAdvisories.map((slot) => (
                  <article key={`advisory-${slot.date}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-medium text-ink">{slot.date}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-ink-faint">
                          {formatSlotTypeLabel(slot.slotType)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-medium ${capacityBadgeClass(slot.instructionalCapacity)}`}
                        aria-label={`Instructional capacity: ${formatInstructionalCapacityLabel(slot.instructionalCapacity)}`}
                      >
                        {formatInstructionalCapacityLabel(slot.instructionalCapacity)}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-soft">
                          Capacity source: {formatCapacitySourceLabel(slot.capacitySource)}
                        </span>
                        {slot.source ? (
                          <span className="rounded-full border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-soft">
                            Schedule source: {slot.source}
                          </span>
                        ) : null}
                      </div>

                      {slot.capacityReason ? <p className="text-sm text-ink-muted">{slot.capacityReason}</p> : null}
                    </div>

                    {slot.provenance.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-ink-faint">
                        {slot.provenance.map((entry, index) => (
                          <li key={`${entry.source}-${entry.referenceId ?? "none"}-${index}`}>
                            <span className="font-medium text-ink-muted">{formatProvenanceLabel(entry.source)}:</span>{" "}
                            {entry.detail}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleBackToForm}
            className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-soft"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={hasBlockers || applying}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-hover disabled:cursor-not-allowed disabled:bg-ink-faint"
          >
            {applying ? "Creating..." : "Confirm and create term"}
          </button>
        </div>
      </div>
    );
  }

  const { submitting, error } = panelState;

  return (
    <form onSubmit={handlePreview} className="rounded-lg border border-line bg-surface p-5">
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold text-ink">Create Term</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Choose the institution and academic calendar first so the term starts with the right container.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-ink-soft">
          <span className="mb-1 block font-medium">Institution</span>
          <select
            aria-label="Institution"
            value={institutionId}
            onChange={(event) => setInstitutionId(event.target.value)}
            className="w-full rounded-lg border border-line-strong px-3 py-2"
            disabled={submitting}
          >
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.shortName ?? institution.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-ink-soft">
          <span className="mb-1 block font-medium">Academic Calendar</span>
          <select
            aria-label="Academic Calendar"
            value={academicCalendarId}
            onChange={(event) => setAcademicCalendarId(event.target.value)}
            className="w-full rounded-lg border border-line-strong px-3 py-2"
            disabled={formDisabled}
          >
            {visibleCalendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-ink-soft">
          <span className="mb-1 block font-medium">Term Code</span>
          <input
            aria-label="Term Code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="SP27"
            className="w-full rounded-lg border border-line-strong px-3 py-2 font-mono"
            required
          />
        </label>

        <label className="text-sm text-ink-soft">
          <span className="mb-1 block font-medium">Display Name</span>
          <input
            aria-label="Display Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Spring 2027"
            className="w-full rounded-lg border border-line-strong px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-ink-soft">
          <span className="mb-1 block font-medium">Start Date</span>
          <input
            aria-label="Start Date"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full rounded-lg border border-line-strong px-3 py-2 font-mono"
            required
          />
        </label>

        <label className="text-sm text-ink-soft">
          <span className="mb-1 block font-medium">End Date</span>
          <input
            aria-label="End Date"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full rounded-lg border border-line-strong px-3 py-2 font-mono"
            required
          />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-ink-soft">Meeting Pattern</legend>
        <p className="mt-1 text-xs text-ink-faint">Select the weekdays when lecture sessions meet.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => {
            const checked = selectedDays.includes(day);
            return (
              <label
                key={day}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                  checked
                    ? "border-accent bg-accent-tint text-accent-strong"
                    : "border-line-strong bg-surface text-ink-soft"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggleDay(day)}
                />
                {day}
              </label>
            );
          })}
        </div>
      </fieldset>

      {visibleCalendars.length === 0 ? (
        <p className="mt-4 text-sm text-amber-800">No academic calendars are available for that institution yet.</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={formDisabled}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-hover disabled:cursor-not-allowed disabled:bg-ink-faint"
        >
          {submitting ? "Previewing..." : "Preview term"}
        </button>
      </div>
    </form>
  );
}
