"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AcademicCalendarDto,
  Id,
  InstitutionDto,
} from "@/lib/redesign-contract";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

type Props = {
  institutions: InstitutionDto[];
  calendars: AcademicCalendarDto[];
  submitting?: boolean;
  onSubmit: (
    request: {
      institutionId: Id;
      academicCalendarId: Id;
      code: string;
      name: string;
      startDate: string;
      endDate: string;
      meetingPattern?: unknown | null;
    },
  ) => Promise<void>;
};

export default function CreateTermPanel({ institutions, calendars, submitting = false, onSubmit }: Props) {
  const initialInstitutionId = institutions[0]?.id ?? "";
  const [institutionId, setInstitutionId] = useState(initialInstitutionId);
  const [academicCalendarId, setAcademicCalendarId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>(["Tue", "Thu"]);

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      institutionId,
      academicCalendarId,
      code,
      name,
      startDate,
      endDate,
      meetingPattern: { days: selectedDays },
    });
    setCode("");
    setName("");
    setStartDate("");
    setEndDate("");
    setSelectedDays(["Tue", "Thu"]);
  }

  const disabled = institutions.length === 0 || visibleCalendars.length === 0 || submitting;

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Create Term</h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose the institution and academic calendar first so the term starts with the right container.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Institution</span>
          <select
            value={institutionId}
            onChange={(event) => setInstitutionId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            disabled={submitting}
          >
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.shortName ?? institution.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Academic Calendar</span>
          <select
            value={academicCalendarId}
            onChange={(event) => setAcademicCalendarId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            disabled={disabled}
          >
            {visibleCalendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Term Code</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="SP27"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Display Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Spring 2027"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Start Date</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">End Date</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-slate-700">Meeting Pattern</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => {
            const checked = selectedDays.includes(day);
            return (
              <label
                key={day}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  checked
                    ? "border-sky-300 bg-sky-50 text-sky-800"
                    : "border-slate-300 bg-white text-slate-700"
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
        <p className="mt-4 text-sm text-amber-700">No academic calendars are available for that institution yet.</p>
      ) : null}

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? "Creating..." : "Create Term"}
        </button>
      </div>
    </form>
  );
}
