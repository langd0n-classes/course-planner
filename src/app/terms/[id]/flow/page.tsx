"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { api } from "@/lib/api-client";
import { buildFlowData } from "./flow-utils";
import type { FlowCoverageLevel, FlowData } from "./flow-utils";
import FlowSummary from "@/components/flow/FlowSummary";
import FlowFilters, { type FlowFiltersState } from "@/components/flow/FlowFilters";
import FlowGrid from "@/components/flow/FlowGrid";
import LoadingSkeleton from "@/components/LoadingSkeleton";

export default function TermFlowPage() {
  const { id } = useParams<{ id: string }>();
  const [flowData, setFlowData] = useState<FlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          <FlowFilters
            categories={displayData.categories}
            modules={flowData?.modules ?? []}
            filters={filters}
            onChange={setFilters}
          />
          <FlowGrid
            data={displayData}
            onAddCoverage={(skillId, sessionId, level) =>
              handleAddCoverage(skillId, sessionId, level)
            }
            onRemoveCoverage={handleRemoveCoverage}
          />
        </div>
      )}
    </div>
  );
}
