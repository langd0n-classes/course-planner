"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────

interface CalendarSlot {
  id: string;
  date: string;
  dayOfWeek: string;
  slotType: "class_day" | "holiday" | "finals" | "break_day";
  label: string | null;
}

interface Coverage {
  id: string;
  level: string;
  skill: { id: string; code: string; description: string };
}

interface Session {
  id: string;
  code: string;
  title: string;
  date: string | null;
  sessionType: string;
  status: string;
  canceledReason: string | null;
  sequence: number;
  coverages: Coverage[];
  module: { id: string; code: string; title: string; sequence: number };
}

interface WhatIfImpact {
  canceledSessionId: string;
  affectedCoverages: Array<{ skillId: string; level: string }>;
  atRiskSkills: Array<{
    skillId: string;
    skillCode: string;
    level: string;
    uniqueCoverage: boolean;
    otherSessions: Array<{ sessionId: string; sessionCode: string; level: string }>;
  }>;
  healthBefore: { totalSkills: number; fullyCovered: number; fullyIntroduced: number };
  healthAfter: { totalSkills: number; fullyCovered: number; fullyIntroduced: number };
  newViolations: Array<{ type: string; message: string }>;
}

interface ScenarioComparison {
  scenarioA: WhatIfImpact;
  scenarioB: WhatIfImpact;
}

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
  const colorClass = getModuleColor(session.module.sequence);

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
          {session.module.code}
        </span>
        <span className="bg-white/50 px-1 rounded text-[10px]">
          {session.sessionType}
        </span>
        {session.coverages.length > 0 && (
          <span className="bg-white/50 px-1 rounded text-[10px]">
            {session.coverages.length} skills
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

// ─── What-If Panel ──────────────────────────────────────

function WhatIfPanel({
  sessionId,
  termId,
  sessions,
  onClose,
  onApplyCancel,
  compareSessionId,
  onSetCompare,
}: {
  sessionId: string;
  termId: string;
  sessions: Session[];
  onClose: () => void;
  onApplyCancel: (sessionId: string, reason: string) => void;
  compareSessionId: string | null;
  onSetCompare: (id: string | null) => void;
}) {
  const [impact, setImpact] = useState<WhatIfImpact | null>(null);
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelReason, setCancelReason] = useState("");
  const [showApply, setShowApply] = useState(false);
  const [demoScenario, setDemoScenario] = useState("");

  // Demo scenarios
  const demoScenarios = sessions
    .filter((s) => s.status === "scheduled" && s.coverages.length > 0)
    .slice(0, 3)
    .map((s) => ({
      id: s.id,
      label: `Cancel ${s.code} — ${s.coverages.length} skills affected`,
    }));

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const targetId = demoScenario || sessionId;
        const res = await fetch(`/api/sessions/${targetId}/whatif`);
        if (res.ok) {
          setImpact(await res.json());
        }
      } catch (err) {
        console.error("What-if error:", err);
      }
      setLoading(false);
    }
    load();
  }, [sessionId, demoScenario]);

  useEffect(() => {
    if (!compareSessionId) {
      setComparison(null);
      return;
    }
    async function loadComparison() {
      try {
        const targetA = demoScenario || sessionId;
        const res = await fetch(
          `/api/terms/${termId}/whatif-compare?sessionA=${targetA}&sessionB=${compareSessionId}`,
        );
        if (res.ok) {
          setComparison(await res.json());
        }
      } catch (err) {
        console.error("Comparison error:", err);
      }
    }
    loadComparison();
  }, [compareSessionId, sessionId, termId, demoScenario]);

  const session = sessions.find((s) => s.id === (demoScenario || sessionId));

  return (
    <div className="fixed right-0 top-0 h-full w-[420px] bg-white border-l border-gray-200 shadow-lg z-50 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <h2 className="font-bold text-lg">What-If Analysis</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
          &times;
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Demo scenarios dropdown */}
        {demoScenarios.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Load demo scenario
            </label>
            <select
              value={demoScenario}
              onChange={(e) => {
                setDemoScenario(e.target.value);
                onSetCompare(null);
              }}
              className="w-full border border-gray-300 rounded text-sm p-2"
            >
              <option value="">Current selection: {session?.code}</option>
              {demoScenarios.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-500">Analyzing impact...</div>
        ) : impact ? (
          <>
            {/* Session info */}
            <div className="bg-gray-50 rounded p-3">
              <div className="font-mono font-bold">{session?.code}</div>
              <div className="text-sm text-gray-600">{session?.title}</div>
            </div>

            {/* Coverage impact */}
            <div>
              <h3 className="text-sm font-medium mb-2">Coverage Impact</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-500">Before</div>
                  <div className="font-bold">
                    {impact.healthBefore.fullyCovered} / {impact.healthBefore.totalSkills}
                  </div>
                  <div className="text-xs text-gray-500">fully covered</div>
                </div>
                <div className="bg-red-50 p-2 rounded">
                  <div className="text-xs text-gray-500">After</div>
                  <div className="font-bold text-red-700">
                    {impact.healthAfter.fullyCovered} / {impact.healthAfter.totalSkills}
                  </div>
                  <div className="text-xs text-gray-500">fully covered</div>
                </div>
              </div>
            </div>

            {/* At-risk skills */}
            {impact.atRiskSkills.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">
                  At-Risk Skills ({impact.atRiskSkills.filter((s) => s.uniqueCoverage).length} unique)
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {impact.atRiskSkills.map((skill, i) => (
                    <div
                      key={i}
                      className={`text-xs p-2 rounded border ${
                        skill.uniqueCoverage
                          ? "bg-red-50 border-red-200"
                          : "bg-yellow-50 border-yellow-200"
                      }`}
                    >
                      <span className="font-mono font-medium">{skill.skillCode}</span>
                      <span className="ml-1 text-gray-500">({skill.level})</span>
                      {skill.uniqueCoverage && (
                        <span className="ml-1 text-red-600 font-medium">UNIQUE</span>
                      )}
                      {skill.otherSessions.length > 0 && (
                        <div className="text-gray-500 mt-1">
                          Also in: {skill.otherSessions.map((s) => s.sessionCode).join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New violations */}
            {impact.newViolations.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h3 className="text-sm font-medium text-red-800 mb-1">
                  New Ordering Violations
                </h3>
                {impact.newViolations.map((v, i) => (
                  <div key={i} className="text-xs text-red-700">
                    {v.message}
                  </div>
                ))}
              </div>
            )}

            {/* Compare section */}
            <div>
              <h3 className="text-sm font-medium mb-2">Compare with another session</h3>
              <select
                value={compareSessionId || ""}
                onChange={(e) => onSetCompare(e.target.value || null)}
                className="w-full border border-gray-300 rounded text-sm p-2"
              >
                <option value="">Select a session to compare...</option>
                {sessions
                  .filter(
                    (s) =>
                      s.status === "scheduled" &&
                      s.id !== (demoScenario || sessionId),
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}: {s.title} ({s.coverages.length} skills)
                    </option>
                  ))}
              </select>
            </div>

            {/* Side-by-side comparison */}
            {comparison && (
              <div className="border border-gray-200 rounded">
                <div className="grid grid-cols-2 text-xs">
                  <div className="p-3 border-r border-gray-200">
                    <div className="font-bold mb-1">
                      {sessions.find((s) => s.id === comparison.scenarioA.canceledSessionId)?.code}
                    </div>
                    <div>At-risk (unique): {comparison.scenarioA.atRiskSkills.filter((s) => s.uniqueCoverage).length}</div>
                    <div>Fully covered: {comparison.scenarioA.healthBefore.fullyCovered} → {comparison.scenarioA.healthAfter.fullyCovered}</div>
                    <div>New violations: {comparison.scenarioA.newViolations.length}</div>
                  </div>
                  <div className="p-3">
                    <div className="font-bold mb-1">
                      {sessions.find((s) => s.id === comparison.scenarioB.canceledSessionId)?.code}
                    </div>
                    <div>At-risk (unique): {comparison.scenarioB.atRiskSkills.filter((s) => s.uniqueCoverage).length}</div>
                    <div>Fully covered: {comparison.scenarioB.healthBefore.fullyCovered} → {comparison.scenarioB.healthAfter.fullyCovered}</div>
                    <div>New violations: {comparison.scenarioB.newViolations.length}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Apply cancellation */}
            {!showApply ? (
              <button
                onClick={() => setShowApply(true)}
                className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
              >
                Apply Cancellation
              </button>
            ) : (
              <div className="border border-red-200 rounded p-3 space-y-3">
                <h3 className="text-sm font-medium text-red-800">
                  Confirm Cancellation
                </h3>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation (optional)"
                  rows={2}
                  className="w-full border border-gray-300 rounded p-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onApplyCancel(demoScenario || sessionId, cancelReason);
                      onClose();
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
                  >
                    Confirm Cancel
                  </button>
                  <button
                    onClick={() => setShowApply(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-500">No impact data available.</div>
        )}
      </div>
    </div>
  );
}

// ─── Calendar Page ──────────────────────────────────────

export default function CalendarPage() {
  const { id: termId } = useParams<{ id: string }>();
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [whatIfSession, setWhatIfSession] = useState<string | null>(null);
  const [compareSession, setCompareSession] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [slotsRes, sessionsRes] = await Promise.all([
        fetch(`/api/terms/${termId}/calendar-slots`),
        fetch(`/api/sessions?termId=${termId}`),
      ]);

      if (slotsRes.ok) setSlots(await slotsRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
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
    async (sessionId: string, reason: string) => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        if (res.ok) {
          loadData();
        }
      } catch (err) {
        console.error("Cancel error:", err);
      }
    },
    [loadData],
  );

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
  const dayColumns = ["Tuesday", "Thursday", "Friday"]; // Default TTh/F
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
                              <div className="border-2 border-dashed border-gray-200 rounded p-2 h-16 flex items-center justify-center">
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
                {selectedSession.module.code} — {selectedSession.module.title}
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
              {selectedSession.coverages.length > 0 && (
                <div>
                  <span className="font-medium text-gray-500">Coverage: </span>
                  <div className="mt-1 space-y-1">
                    {selectedSession.coverages.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 text-xs bg-gray-50 p-1 rounded"
                      >
                        <span className="font-mono">{c.skill.code}</span>
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
                          {c.skill.description}
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
