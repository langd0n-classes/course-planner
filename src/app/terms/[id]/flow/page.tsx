"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { api } from "@/lib/api-client";
import type { Module, Session, Skill, Coverage } from "@/lib/api-client";
import { simulateCancellation } from "@/domain/whatif";
import type { TermData } from "@/domain/whatif";
import { buildFlowData } from "./flow-utils";
import type { FlowCoverageLevel, FlowData } from "./flow-utils";
import FlowSummary from "@/components/flow/FlowSummary";
import FlowFilters, { type FlowFiltersState } from "@/components/flow/FlowFilters";
import FlowGrid from "@/components/flow/FlowGrid";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface RawTermData {
  modules: Module[];
  sessions: Session[];
  skills: Skill[];
  coverages: Coverage[];
}

export default function TermFlowPage() {
  const { id } = useParams<{ id: string }>();
  const [raw, setRaw] = useState<RawTermData | null>(null);
  const [flowData, setFlowData] = useState<FlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulateSessionId, setSimulateSessionId] = useState<string>("");
  const [filters, setFilters] = useState<FlowFiltersState>({
    category: "all",
    moduleId: "all",
    gapsOnly: false,
    showCanceled: true,
  });

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [modules, sessions, skills, coverages] = await Promise.all([
        api.getModules(id),
        api.getSessions({ termId: id }),
        api.getSkills(id),
        api.getCoverages({ termId: id }),
      ]);
      setRaw({ modules, sessions, skills, coverages });
      const data = buildFlowData({ modules, sessions, skills, coverages });
      setFlowData(data);
    } catch (err) {
      console.error("Failed to load flow data", err);
      setError("Unable to load the skill flow right now.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAddCoverage = useCallback(
    async (skillId: string, sessionId: string, level: FlowCoverageLevel) => {
      await api.createCoverage({ skillId, sessionId, level });
      refresh();
    },
    [refresh],
  );

  const handleRemoveCoverage = useCallback(
    async (coverageId: string) => {
      await api.deleteCoverage(coverageId);
      refresh();
    },
    [refresh],
  );

  // Read-only what-if overlay: simulate canceling a session using the pure
  // domain function. Nothing is persisted (design principle #3).
  const simulation = useMemo(() => {
    if (!raw || !simulateSessionId) return null;
    const moduleSequenceById = new Map(
      raw.modules.map((module) => [module.id, module.sequence]),
    );
    const sessionById = new Map(raw.sessions.map((session) => [session.id, session]));
    const termData: TermData = {
      sessions: raw.sessions.map((session) => ({
        id: session.id,
        code: session.code,
        title: session.title,
        date: session.date ? new Date(session.date) : null,
        moduleId: session.moduleId,
        moduleSequence: moduleSequenceById.get(session.moduleId) ?? 0,
        sessionSequence: session.sequence,
        status: session.status,
      })),
      coverages: raw.coverages.map((coverage) => {
        const session = sessionById.get(coverage.sessionId);
        return {
          sessionId: coverage.sessionId,
          skillId: coverage.skillId,
          level: coverage.level,
          sessionDate: session?.date ? new Date(session.date) : null,
          sessionSequence: session?.sequence ?? 0,
          moduleSequence: session
            ? (moduleSequenceById.get(session.moduleId) ?? 0)
            : 0,
        };
      }),
      skills: raw.skills.map((skill) => ({
        id: skill.id,
        code: skill.code,
        description: skill.description,
        category: skill.category,
      })),
    };
    return simulateCancellation(termData, simulateSessionId);
  }, [raw, simulateSessionId]);

  const simulatedAtRiskSkillIds = useMemo(() => {
    if (!simulation) return undefined;
    return new Set(simulation.atRiskSkills.map((skill) => skill.skillId));
  }, [simulation]);

  const filteredFlowData = useMemo(() => {
    if (!flowData) return null;
    const sessionFilter = (session: FlowData["sessions"][number]) => {
      if (!filters.showCanceled && session.isCanceled) return false;
      if (filters.moduleId !== "all" && session.moduleId !== filters.moduleId) return false;
      return true;
    };

    const visibleSessions = flowData.sessions.filter(sessionFilter);
    const visibleSessionIds = new Set(visibleSessions.map((session) => session.sessionId));

    const rows = flowData.rows
      .filter((row) => filters.category === "all" || row.category === filters.category)
      .filter((row) => !filters.gapsOnly || row.coverageStatus !== "complete")
      .map((row) => ({
        ...row,
        cells: row.cells.filter((cell) => visibleSessionIds.has(cell.sessionId)),
      }));

    return {
      ...flowData,
      sessions: visibleSessions,
      rows,
    };
  }, [filters, flowData]);

  const displayData = filteredFlowData ?? flowData;

  const scheduledSessions = useMemo(
    () => flowData?.sessions.filter((session) => !session.isCanceled) ?? [],
    [flowData],
  );

  return (
    <div className="space-y-4">
      {loading && (
        <div className="bg-white border rounded p-4">
          <LoadingSkeleton lines={6} />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {displayData && (
        <div className="space-y-4">
          <FlowSummary summary={displayData.summary} />
          <div className="flex flex-wrap items-end gap-4">
            <FlowFilters
              categories={displayData.categories}
              modules={flowData?.modules ?? []}
              filters={filters}
              onChange={setFilters}
            />
            <div className="bg-white rounded border px-4 py-3 flex flex-wrap items-end gap-3">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Simulate cancellation
                </label>
                <select
                  value={simulateSessionId}
                  onChange={(event) => setSimulateSessionId(event.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="">None</option>
                  {scheduledSessions.map((session) => (
                    <option key={session.sessionId} value={session.sessionId}>
                      {session.code}: {session.title}
                    </option>
                  ))}
                </select>
              </div>
              {simulateSessionId && (
                <button
                  onClick={() => setSimulateSessionId("")}
                  className="text-sm text-gray-600 border rounded px-3 py-1 hover:bg-gray-50"
                >
                  Clear simulation
                </button>
              )}
            </div>
          </div>

          {simulation && (
            <div className="bg-orange-50 border border-orange-200 rounded px-4 py-3 text-sm text-orange-900 flex flex-wrap gap-4">
              <span className="font-semibold">What-if (not saved):</span>
              <span>
                {simulation.atRiskSkills.length} skill
                {simulation.atRiskSkills.length === 1 ? "" : "s"} at risk
              </span>
              <span>
                fully covered {simulation.healthBefore.fullyCovered} →{" "}
                {simulation.healthAfter.fullyCovered}
              </span>
              <span>
                {simulation.newViolations.length} new ordering violation
                {simulation.newViolations.length === 1 ? "" : "s"}
              </span>
            </div>
          )}

          <FlowGrid
            termId={id}
            data={displayData}
            onAddCoverage={(skillId, sessionId, level) =>
              handleAddCoverage(skillId, sessionId, level)
            }
            onRemoveCoverage={handleRemoveCoverage}
            simulatedSessionId={simulateSessionId || null}
            simulatedAtRiskSkillIds={simulatedAtRiskSkillIds}
          />
        </div>
      )}
    </div>
  );
}
