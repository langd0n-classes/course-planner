"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  api,
  type CalendarSlot,
  type Session,
  type Term,
} from "@/lib/api-client";
import WhatIfPanel from "@/components/WhatIfPanel";

// ─── Module color coding ────────────────────────────────

const MODULE_COLORS = [
  "bg-blue-100 border-blue-300 text-blue-800",
  "bg-green-100 border-green-300 text-green-800",
  "bg-purple-100 border-purple-300 text-purple-800",
  "bg-orange-100 border-orange-300 text-orange-800",
  "bg-pink-100 border-pink-300 text-pink-800",
  "bg-teal-100 border-teal-300 text-teal-800",
  "bg-indigo-100 border-indigo-300 text-indigo-800",
  "bg-yellow-100 border-yellow-300 text-yellow-800",
];

function getModuleColor(sequence: number): string {
  return MODULE_COLORS[sequence % MODULE_COLORS.length];
}

// ─── Helper: Derive day columns from meeting pattern ────

const DEFAULT_DAY_COLUMNS = ["Tuesday", "Thursday", "Friday"];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function getDayColumns(term: Term | null, slots: CalendarSlot[]): string[] {
  // 1. Try from term's meetingPattern
  if (term?.meetingPattern?.days && term.meetingPattern.days.length > 0) {
    return term.meetingPattern.days.map(capitalize);
  }

  // 2. Derive from actual calendar slots
  if (slots.length > 0) {
    const daySet = new Set<string>();
    for (const slot of slots) {
      if (slot.slotType === "class_day") {
        daySet.add(slot.dayOfWeek);
      }
    }
    if (daySet.size > 0) {
      const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      return dayOrder.filter((d) => daySet.has(d));
    }
  }

  // 3. Fall back to default
  return DEFAULT_DAY_COLUMNS;
}

// ─── Session Card ───────────────────────────────────────

function SessionCard({
  session,
  onClick,
  onWhatIf,
}: {
  session: Session;
  onClick: () => void;
  onWhatIf: () => void;
}) {
  const isCanceled = session.status === "canceled";
  const colorClass = getModuleColor(session.module?.sequence ?? 0);

  return (
    <div
      className={`p-2 rounded border text-xs cursor-pointer transition-all hover:shadow-md ${
        isCanceled
          ? "bg-gray-100 border-gray-300 opacity-60"
          : colorClass
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-1 mb-1">
        <span
          className={`font-mono font-bold ${isCanceled ? "line-through" : ""}`}
        >
          {session.code}
        </span>
        {isCanceled && (
          <span className="bg-red-200 text-red-800 px-1 rounded text-[10px] font-medium">
            Canceled
          </span>
        )}
      </div>
      <div className={`text-[11px] leading-tight ${isCanceled ? "line-through" : ""}`}>
        {session.title}
      </div>
      <div className="flex items-center gap-1 mt-1">
        <span className="bg-white/50 px-1 rounded text-[10px]">
          {session.module?.code}
        </span>
        <span className="bg-white/50 px-1 rounded text-[10px]">
          {session.sessionType}
        </span>
        {(session.coverages?.length ?? 0) > 0 && (
          <span className="bg-white/50 px-1 rounded text-[10px]">
            {session.coverages!.length} skills
          </span>
        )}
      </div>
      {!isCanceled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onWhatIf();
          }}
          className="mt-1 text-[10px] text-gray-500 hover:text-red-600 underline"
        >
          What if cancel?
        </button>
      )}
    </div>
  );
}

// ─── Empty Cell Popover ─────────────────────────────────

function EmptyCellPopover({
  date,
  termId,
  unscheduledSessions,
  onClose,
  onRefresh,
}: {
  date: string;
  termId: string;
  unscheduledSessions: Session[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [mode, setMode] = useState<"menu" | "create" | "assign">("menu");
  const [createForm, setCreateForm] = useState({
    code: "",
    title: "",
    sessionType: "lecture" as "lecture" | "lab",
  });
  const [assignSessionId, setAssignSessionId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [modules, setModules] = useState<Array<{ id: string; code: string; title: string }>>([]);

  useEffect(() => {
    api.getModules(termId).then((mods) => {
      setModules(mods.map((m) => ({ id: m.id, code: m.code, title: m.title })));
      if (mods.length > 0) setModuleId(mods[0].id);
    });
  }, [termId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!moduleId) return;
    await api.createSession({
      moduleId,
      sequence: 0,
      code: createForm.code,
      title: createForm.title,
      sessionType: createForm.sessionType,
      date,
    });
    onRefresh();
    onClose();
  }

  async function handleAssign() {
    if (!assignSessionId) return;
    await api.updateSession(assignSessionId, { date });
    onRefresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40"
      onClick={onClose}
    >
      <div
        className="absolute bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-72 z-50"
        style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">
            {date}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
            &times;
          </button>
        </div>

        {mode === "menu" && (
          <div className="space-y-2">
            <button
              onClick={() => setMode("create")}
              className="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
            >
              Create new session
            </button>
            {unscheduledSessions.length > 0 && (
              <button
                onClick={() => setMode("assign")}
                className="w-full text-left px-3 py-2 text-sm bg-green-50 hover:bg-green-100 rounded border border-green-200"
              >
                Assign existing session ({unscheduledSessions.length} unscheduled)
              </button>
            )}
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={handleCreate} className="space-y-2">
            <select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className="w-full border border-gray-300 rounded text-sm p-1.5"
              required
            >
              <option value="">Select module...</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code}: {m.title}
                </option>
              ))}
            </select>
            <select
              value={createForm.sessionType}
              onChange={(e) => setCreateForm({ ...createForm, sessionType: e.target.value as "lecture" | "lab" })}
              className="w-full border border-gray-300 rounded text-sm p-1.5"
            >
              <option value="lecture">Lecture</option>
              <option value="lab">Lab</option>
            </select>
            <input
              value={createForm.code}
              onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
              placeholder="Code (e.g. lec-05)"
              className="w-full border border-gray-300 rounded text-sm p-1.5"
              required
            />
            <input
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              placeholder="Title"
              className="w-full border border-gray-300 rounded text-sm p-1.5"
              required
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
                Create
              </button>
              <button type="button" onClick={() => setMode("menu")} className="px-3 py-1.5 border rounded text-sm">
                Back
              </button>
            </div>
          </form>
        )}

        {mode === "assign" && (
          <div className="space-y-2">
            <select
              value={assignSessionId}
              onChange={(e) => setAssignSessionId(e.target.value)}
              className="w-full border border-gray-300 rounded text-sm p-1.5"
            >
              <option value="">Select session...</option>
              {unscheduledSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}: {s.title} ({s.module?.code})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAssign}
                disabled={!assignSessionId}
                className="flex-1 bg-green-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
              >
                Assign
              </button>
              <button onClick={() => setMode("menu")} className="px-3 py-1.5 border rounded text-sm">
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Calendar Page ──────────────────────────────────────

export default function CalendarPage() {
  const { id: termId } = useParams<{ id: string }>();
  const [term, setTerm] = useState<Term | null>(null);
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [whatIfSession, setWhatIfSession] = useState<string | null>(null);
  const [compareSession, setCompareSession] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [emptyCellDate, setEmptyCellDate] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [termData, slotsData, sessionsData] = await Promise.all([
        api.getTerm(termId),
        api.getCalendarSlots(termId),
        api.getSessions({ termId }),
      ]);
      setTerm(termData);
      setSlots(slotsData);
      setSessions(sessionsData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [termId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApplyCancel = useCallback(
    async (
      sessionId: string,
      reason: string,
      redistributions: Array<{ skillId: string; level: string; targetSessionId: string }>,
    ) => {
      try {
        await api.cancelSession(sessionId, { reason, redistributions });
        loadData();
      } catch (err) {
        console.error("Cancel error:", err);
      }
    },
    [loadData],
  );

  // Derive day columns from term data
  const dayColumns = getDayColumns(term, slots);

  // Build session lookup by date
  const sessionsByDate = new Map<string, Session[]>();
  for (const s of sessions) {
    if (s.date) {
      const d = s.date.slice(0, 10);
      if (!sessionsByDate.has(d)) sessionsByDate.set(d, []);
      sessionsByDate.get(d)!.push(s);
    }
  }

  // Unscheduled sessions
  const unscheduled = sessions.filter((s) => !s.date);

  // Build weeks from slots
  const weeks: CalendarSlot[][] = [];
  let currentWeek: CalendarSlot[] = [];
  let lastWeekStart = "";

  for (const slot of slots) {
    const d = new Date(slot.date + "T00:00:00Z");
    // Week starts on Monday
    const mondayOffset = (d.getUTCDay() + 6) % 7;
    const monday = new Date(d);
    monday.setUTCDate(monday.getUTCDate() - mondayOffset);
    const weekKey = monday.toISOString().slice(0, 10);

    if (weekKey !== lastWeekStart) {
      if (currentWeek.length > 0) weeks.push(currentWeek);
      currentWeek = [];
      lastWeekStart = weekKey;
    }
    currentWeek.push(slot);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  if (loading) {
    return <div className="text-gray-500">Loading calendar...</div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  return (
    <div className={`${whatIfSession ? "mr-[420px]" : ""} transition-all`}>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/terms/${termId}`}
          className="text-blue-600 hover:underline text-sm"
        >
          &larr; Back to Term
        </Link>
        <h1 className="text-2xl font-bold">Calendar View</h1>
        <Link
          href={`/terms/${termId}/import`}
          className="ml-auto text-sm text-blue-600 hover:underline"
        >
          Import Data
        </Link>
      </div>

      {slots.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No calendar slots imported yet.</p>
          <Link
            href={`/terms/${termId}/import`}
            className="text-blue-600 hover:underline"
          >
            Import an academic calendar to get started
          </Link>
        </div>
      ) : (
        <>
          {/* Calendar grid */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 text-xs font-medium text-gray-500 w-20">
                    Week
                  </th>
                  {dayColumns.map((day) => (
                    <th
                      key={day}
                      className="text-left p-2 text-xs font-medium text-gray-500"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, wi) => {
                  const weekDate = week[0]?.date.slice(0, 10);
                  const d = new Date(week[0]?.date + "T00:00:00Z");
                  const weekNum = Math.ceil(
                    (d.getTime() -
                      new Date(slots[0]?.date + "T00:00:00Z").getTime()) /
                      (7 * 24 * 60 * 60 * 1000),
                  ) + 1;

                  return (
                    <tr key={wi} className="border-t border-gray-200">
                      <td className="p-2 text-xs text-gray-400 align-top">
                        W{weekNum}
                        <div className="text-[10px]">{weekDate}</div>
                      </td>
                      {dayColumns.map((day) => {
                        const slot = week.find((s) => s.dayOfWeek === day);
                        if (!slot) {
                          return (
                            <td key={day} className="p-2 align-top min-w-[180px]">
                              <div className="h-20" />
                            </td>
                          );
                        }

                        const dateStr = slot.date.slice(0, 10);
                        const daySessions = sessionsByDate.get(dateStr) || [];

                        if (
                          slot.slotType === "holiday" ||
                          slot.slotType === "break_day" ||
                          slot.slotType === "finals"
                        ) {
                          return (
                            <td
                              key={day}
                              className="p-2 align-top min-w-[180px]"
                            >
                              <div className="bg-gray-100 border border-gray-200 rounded p-2 h-20 flex items-center justify-center">
                                <div className="text-center">
                                  <div className="text-xs text-gray-400">
                                    {dateStr}
                                  </div>
                                  <div className="text-xs font-medium text-gray-500">
                                    {slot.label || slot.slotType}
                                  </div>
                                </div>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={day} className="p-2 align-top min-w-[180px]">
                            <div className="text-[10px] text-gray-400 mb-1">
                              {dateStr}
                            </div>
                            {daySessions.length > 0 ? (
                              <div className="space-y-1">
                                {daySessions.map((s) => (
                                  <SessionCard
                                    key={s.id}
                                    session={s}
                                    onClick={() => setSelectedSession(s)}
                                    onWhatIf={() => setWhatIfSession(s.id)}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div
                                className="border-2 border-dashed border-gray-200 rounded p-2 h-16 flex items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                                onClick={() => setEmptyCellDate(dateStr)}
                              >
                                <span className="text-xs text-gray-400">
                                  Unplanned
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Unscheduled sessions */}
          {unscheduled.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-bold mb-3">
                Unscheduled Sessions ({unscheduled.length})
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {unscheduled.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onClick={() => setSelectedSession(s)}
                    onWhatIf={() => setWhatIfSession(s.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty cell popover */}
      {emptyCellDate && (
        <EmptyCellPopover
          date={emptyCellDate}
          termId={termId}
          unscheduledSessions={unscheduled}
          onClose={() => setEmptyCellDate(null)}
          onRefresh={loadData}
        />
      )}

      {/* Session detail modal */}
      {selectedSession && (
        <div
          className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center"
          onClick={() => setSelectedSession(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                {selectedSession.code}: {selectedSession.title}
              </h2>
              <button
                onClick={() => setSelectedSession(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                &times;
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-500">Module: </span>
                {selectedSession.module?.code} — {selectedSession.module?.title}
              </div>
              <div>
                <span className="font-medium text-gray-500">Type: </span>
                {selectedSession.sessionType}
              </div>
              <div>
                <span className="font-medium text-gray-500">Status: </span>
                <span
                  className={
                    selectedSession.status === "canceled"
                      ? "text-red-600 font-medium"
                      : "text-green-600"
                  }
                >
                  {selectedSession.status}
                </span>
              </div>
              {selectedSession.canceledReason && (
                <div>
                  <span className="font-medium text-gray-500">
                    Cancel reason:{" "}
                  </span>
                  {selectedSession.canceledReason}
                </div>
              )}
              {(selectedSession.coverages?.length ?? 0) > 0 && (
                <div>
                  <span className="font-medium text-gray-500">Coverage: </span>
                  <div className="mt-1 space-y-1">
                    {selectedSession.coverages!.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 text-xs bg-gray-50 p-1 rounded"
                      >
                        <span className="font-mono">{c.skill?.code}</span>
                        <span
                          className={`px-1 rounded text-[10px] ${
                            c.level === "introduced"
                              ? "bg-blue-100 text-blue-700"
                              : c.level === "practiced"
                                ? "bg-green-100 text-green-700"
                                : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {c.level}
                        </span>
                        <span className="text-gray-500 truncate">
                          {c.skill?.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* What-If side panel */}
      {whatIfSession && (
        <WhatIfPanel
          sessionId={whatIfSession}
          termId={termId}
          sessions={sessions}
          onClose={() => {
            setWhatIfSession(null);
            setCompareSession(null);
          }}
          onApplyCancel={handleApplyCancel}
          compareSessionId={compareSession}
          onSetCompare={setCompareSession}
        />
      )}
    </div>
  );
}
