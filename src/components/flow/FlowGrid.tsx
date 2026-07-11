"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { FlowCoverageLevel, FlowData } from "@/app/terms/[id]/flow/flow-utils";
import { computeThreadSpan, doesThreadBreakAtCell } from "@/app/terms/[id]/flow/flow-utils";
import type { HealthStatus } from "@/domain/coverage-matrix";
import { COVERAGE_LEVEL_STYLES } from "@/components/CoverageBadge";
import { useToast } from "@/components/Toast";

const LEVEL_BADGE = {
  introduced: { label: "Intro", letter: "I", color: COVERAGE_LEVEL_STYLES.introduced },
  practiced: { label: "Practice", letter: "P", color: COVERAGE_LEVEL_STYLES.practiced },
  assessed: { label: "Assess", letter: "A", color: COVERAGE_LEVEL_STYLES.assessed },
} satisfies Record<FlowCoverageLevel, { label: string; letter: string; color: string }>;

interface FlowGridProps {
  termId: string;
  data: FlowData;
  onAddCoverage: (skillId: string, sessionId: string, level: FlowCoverageLevel) => Promise<void> | void;
  onRemoveCoverage: (coverageId: string) => Promise<void> | void;
  /** Session hypothetically canceled by the what-if overlay (read-only). */
  simulatedSessionId?: string | null;
  /** Skills flagged at risk by the what-if simulation. */
  simulatedAtRiskSkillIds?: Set<string>;
}

interface ActiveCell {
  skillId: string;
  sessionId: string;
}

export default function FlowGrid({
  termId,
  data,
  onAddCoverage,
  onRemoveCoverage,
  simulatedSessionId = null,
  simulatedAtRiskSkillIds,
}: FlowGridProps) {
  const { showToast } = useToast();
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const moduleGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        moduleId: string;
        moduleCode: string;
        moduleTitle: string;
        sessions: FlowData["sessions"];
      }
    >();

    data.sessions.forEach((session) => {
      const existing = map.get(session.moduleId);
      if (!existing) {
        map.set(session.moduleId, {
          moduleId: session.moduleId,
          moduleCode: session.moduleCode,
          moduleTitle: session.moduleTitle,
          sessions: [session],
        });
        return;
      }
      existing.sessions.push(session);
    });

    return Array.from(map.values());
  }, [data.sessions]);

  const threadSpans = useMemo(
    () => data.rows.map((row) => computeThreadSpan(row.cells)),
    [data.rows],
  );

  const skillBorderClass = (status: HealthStatus) => {
    if (status === "fully_covered") return "border-l-4 border-green-500";
    if (status === "partially_covered") return "border-l-4 border-yellow-400";
    return "border-l-4 border-red-500";
  };

  const isCellActive = (skillId: string, sessionId: string) =>
    activeCell?.skillId === skillId && activeCell.sessionId === sessionId;

  const focusCell = (skillId: string, sessionId: string) => {
    setActiveCell((prev) =>
      prev?.skillId === skillId && prev?.sessionId === sessionId
        ? null
        : { skillId, sessionId },
    );
  };

  const handleAdd = async (skillId: string, sessionId: string, level: FlowCoverageLevel) => {
    setMutating(true);
    try {
      await onAddCoverage(skillId, sessionId, level);
      setActiveCell(null);
    } catch (error) {
      console.error("Add coverage failed", error);
      showToast((error as Error).message || "Unable to add coverage.", "error");
    } finally {
      setMutating(false);
    }
  };

  const handleRemove = async (coverageId: string) => {
    setMutating(true);
    try {
      await onRemoveCoverage(coverageId);
      setActiveCell(null);
    } catch (error) {
      console.error("Remove coverage failed", error);
      showToast((error as Error).message || "Unable to remove coverage.", "error");
    } finally {
      setMutating(false);
    }
  };

  if (data.sessions.length === 0) {
    return (
      <div className="py-6 text-sm text-gray-500">
        No sessions available to display the flow grid.
      </div>
    );
  }

  const columnHighlight = (sessionId: string) =>
    hoveredSessionId === sessionId ? "bg-blue-50" : "";

  const simulatedColumn = (sessionId: string) =>
    simulatedSessionId === sessionId
      ? "border-x-2 border-dashed border-red-400"
      : "";

  return (
    <div
      className="overflow-auto bg-white border rounded"
      onMouseLeave={() => setHoveredSessionId(null)}
    >
      <table className="min-w-full border-collapse">
        <thead className="bg-gray-50">
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
              Skill
            </th>
            {moduleGroups.map((group) => (
              <th
                key={group.moduleId}
                colSpan={group.sessions.length}
                className="px-3 py-2 text-center text-xs font-semibold text-gray-500 border-l-2 border-gray-200"
              >
                <div className="text-sm font-semibold text-gray-700">
                  {group.moduleCode}
                </div>
                <div className="text-xs text-gray-500">{group.moduleTitle}</div>
              </th>
            ))}
          </tr>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 px-3 text-xs font-semibold" />
            {data.sessions.map((session) => (
              <th
                key={session.sessionId}
                onMouseEnter={() => setHoveredSessionId(session.sessionId)}
                className={`px-2 py-2 text-center text-xs font-medium uppercase ${
                  session.isCanceled ? "bg-red-50 text-red-500" : ""
                } ${columnHighlight(session.sessionId)} ${simulatedColumn(session.sessionId)}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <Link
                    href={`/terms/${termId}/sessions/${session.sessionId}`}
                    className="text-sm text-gray-800 hover:text-blue-600 hover:underline"
                  >
                    {session.code}
                  </Link>
                  <span className="text-[10px] tracking-wide text-gray-500">
                    {session.sessionType}
                    {session.isCanceled ? " · canceled" : ""}
                    {simulatedSessionId === session.sessionId ? " · simulated" : ""}
                  </span>
                  {session.date && (
                    <span className="text-[10px] text-gray-400">
                      {new Date(session.date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 && (
            <tr>
              <td
                colSpan={data.sessions.length + 1}
                className="px-4 py-6 text-center text-sm text-gray-500"
              >
                No skills match the selected filters.
              </td>
            </tr>
          )}
          {data.rows.map((row, rowIndex) => {
            const span = threadSpans[rowIndex];
            const previousCategory = rowIndex > 0 ? data.rows[rowIndex - 1].category : null;
            const showCategoryDivider = row.category !== previousCategory;
            const simulatedAtRisk = simulatedAtRiskSkillIds?.has(row.skill.id) ?? false;
            return (
              <FlowRowGroup key={row.skill.id} showCategoryDivider={showCategoryDivider} category={row.category} columnCount={data.sessions.length + 1}>
                <tr className="group hover:bg-yellow-50 transition-colors">
                  <th
                    className={`sticky left-0 z-10 bg-white px-3 py-2 text-left text-sm font-semibold ${skillBorderClass(
                      row.healthStatus,
                    )}`}
                  >
                    <Link
                      href={`/terms/${termId}/skills/${row.skill.id}`}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {row.skill.code}
                    </Link>
                    <div className="text-xs text-gray-500 font-normal max-w-[16rem] truncate">
                      {row.skill.description || row.skill.code}
                    </div>
                    {row.coverageStatus === "none" && (
                      <div className="text-[10px] uppercase text-red-500 tracking-wide mt-1">
                        NOT COVERED
                      </div>
                    )}
                    {simulatedAtRisk && (
                      <div className="text-[10px] uppercase text-orange-600 tracking-wide mt-1">
                        ⚠ At risk if canceled
                      </div>
                    )}
                  </th>
                  {row.cells.map((cell, cellIndex) => {
                    const session = data.sessions[cellIndex];
                    const filled = cell.entries.length > 0;
                    const active = isCellActive(row.skill.id, cell.sessionId);
                    const inThread = span !== null && cellIndex >= span.start && cellIndex <= span.end;
                    const threadBroken = doesThreadBreakAtCell(
                      row.cells,
                      cellIndex,
                      simulatedSessionId,
                    );
                    return (
                      <td
                        key={`${row.skill.id}-${cell.sessionId}`}
                        onMouseEnter={() => setHoveredSessionId(cell.sessionId)}
                        className={`relative px-2 py-3 text-center text-sm border border-transparent transition-colors cursor-pointer hover:bg-blue-100 ${
                          cell.isCanceled ? "bg-red-50 text-red-600" : "text-gray-700"
                        } ${columnHighlight(cell.sessionId)} ${simulatedColumn(cell.sessionId)}`}
                        onClick={() => focusCell(row.skill.id, cell.sessionId)}
                      >
                        {/* Skill thread: the horizontal line flowing through the
                            semester (design principle #5). Broken (dashed red)
                            where the session is canceled or simulated-canceled. */}
                        {inThread && span !== null && cellIndex > span.start && (
                          <ThreadLine side="left" broken={threadBroken} />
                        )}
                        {inThread && span !== null && cellIndex < span.end && (
                          <ThreadLine side="right" broken={threadBroken} />
                        )}
                        {filled ? (
                          <div className="relative flex flex-wrap justify-center gap-1">
                            {cell.levels.map((level) => (
                              <span
                                key={level}
                                className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  LEVEL_BADGE[level].color
                                } ${threadBroken ? "opacity-50 line-through" : ""}`}
                              >
                                {LEVEL_BADGE[level].letter}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="relative text-xs text-gray-400">
                            {inThread ? "" : "—"}
                          </div>
                        )}
                        {active && (
                          <div className="absolute left-1/2 top-1/2 z-20 w-48 -translate-x-1/2 -translate-y-1/2 rounded border border-gray-200 bg-white p-3 shadow-lg space-y-2 text-left text-xs">
                            <>
                              <div className="text-gray-800 font-semibold">
                                {filled
                                  ? `${row.skill.code} · ${session?.code ?? "Session"}`
                                  : "Add coverage"}
                              </div>
                              {filled && cell.entries.map((entry) => (
                                <div key={entry.id} className="flex items-center justify-between">
                                  <span className="uppercase font-semibold tracking-wide text-[10px]">
                                    {LEVEL_BADGE[entry.level].label}
                                  </span>
                                  <button
                                    disabled={mutating}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleRemove(entry.id);
                                    }}
                                    className="text-red-600 text-[10px] font-semibold hover:underline"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                              <div className="flex flex-wrap gap-2">
                                {(Object.keys(LEVEL_BADGE) as FlowCoverageLevel[])
                                  .filter((level) => !cell.levels.includes(level))
                                  .map((level) => (
                                    <button
                                      key={level}
                                      disabled={mutating}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleAdd(row.skill.id, cell.sessionId, level);
                                      }}
                                      className="inline-flex items-center justify-center rounded border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                                    >
                                      {LEVEL_BADGE[level].letter}
                                    </button>
                                  ))}
                              </div>
                            </>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </FlowRowGroup>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FlowRowGroup({
  showCategoryDivider,
  category,
  columnCount,
  children,
}: {
  showCategoryDivider: boolean;
  category: string;
  columnCount: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {showCategoryDivider && (
        <tr className="bg-gray-100">
          <th colSpan={columnCount} className="p-0 text-left">
            <div className="sticky left-0 w-fit px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {category}
            </div>
          </th>
        </tr>
      )}
      {children}
    </>
  );
}

function ThreadLine({ side, broken }: { side: "left" | "right"; broken: boolean }) {
  return (
    <div
      aria-hidden
      className={`absolute top-1/2 ${side === "left" ? "left-0" : "right-0"} w-1/2 -translate-y-1/2 ${
        broken ? "border-t-2 border-dashed border-red-300" : "border-t-2 border-gray-300"
      }`}
    />
  );
}
