"use client";

import { useMemo, useState } from "react";

import type { FlowCoverageLevel, FlowData } from "@/app/terms/[id]/flow/flow-utils";

const LEVEL_BADGE = {
  introduced: { label: "Intro", letter: "I", color: "bg-indigo-50 text-indigo-700" },
  practiced: { label: "Practice", letter: "P", color: "bg-amber-50 text-amber-700" },
  assessed: { label: "Assess", letter: "A", color: "bg-emerald-50 text-emerald-800" },
} satisfies Record<FlowCoverageLevel, { label: string; letter: string; color: string }>;

interface FlowGridProps {
  data: FlowData;
  onAddCoverage: (skillId: string, sessionId: string, level: FlowCoverageLevel) => Promise<void> | void;
  onRemoveCoverage: (coverageId: string) => Promise<void> | void;
}

interface ActiveCell {
  skillId: string;
  sessionId: string;
}

export default function FlowGrid({ data, onAddCoverage, onRemoveCoverage }: FlowGridProps) {
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [mutating, setMutating] = useState(false);

  const moduleGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        moduleId: string;
        moduleCode: string;
        moduleTitle: string;
        sessions: typeof data.sessions;
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

  const sessionIdSet = useMemo(() => new Set(data.sessions.map((session) => session.sessionId)), [data.sessions]);

  const skillBorderClass = (status: string) => {
    if (status === "complete") return "border-l-4 border-green-500";
    if (status === "partial") return "border-l-4 border-yellow-400";
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

  return (
    <div className="overflow-auto bg-white border rounded">
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
                className="px-3 py-2 text-center text-xs font-semibold text-gray-500"
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
                className={`px-2 py-2 text-center text-xs font-medium uppercase ${
                  session.isCanceled ? "bg-red-50 text-red-500" : ""
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm text-gray-800">{session.code}</span>
                  <span className="text-[10px] tracking-wide text-gray-500">
                    {session.sessionType}
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
          {data.rows.map((row) => (
            <tr
              key={row.skill.id}
              className="group hover:bg-yellow-50 transition-colors"
            >
              <th
                className={`sticky left-0 z-10 bg-white px-3 py-2 text-left text-sm font-semibold ${skillBorderClass(
                  row.coverageStatus,
                )}`}
              >
                <div>{row.skill.code}</div>
                <div className="text-xs text-gray-500">
                  {row.skill.description || row.skill.code}
                </div>
                {row.coverageStatus === "none" && (
                  <div className="text-[10px] uppercase text-red-500 tracking-wide mt-1">
                    NOT COVERED
                  </div>
                )}
              </th>
              {row.cells.map((cell) => {
                const session = data.sessions.find((sessionData) => sessionData.sessionId === cell.sessionId);
                const filled = cell.entries.length > 0;
                const active = isCellActive(row.skill.id, cell.sessionId);
                return (
                  <td
                    key={`${row.skill.id}-${cell.sessionId}`}
                    className={`relative px-2 py-3 text-center text-sm border border-transparent transition-colors cursor-pointer hover:bg-blue-50 ${
                      cell.isCanceled
                        ? "bg-red-50 text-red-600"
                        : "bg-white text-gray-700"
                    }`}
                    onClick={() => focusCell(row.skill.id, cell.sessionId)}
                  >
                    {filled ? (
                      <div className="flex flex-wrap justify-center gap-1">
                        {cell.levels.map((level) => (
                          <span
                            key={level}
                            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              LEVEL_BADGE[level].color
                            }`}
                          >
                            {LEVEL_BADGE[level].letter}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">—</div>
                    )}
                    {active && (
                      <div className="absolute left-1/2 top-1/2 z-10 w-48 -translate-x-1/2 -translate-y-1/2 rounded border border-gray-200 bg-white p-3 shadow-lg space-y-2 text-left text-xs">
                        {filled ? (
                          <>
                            <div className="text-gray-800 font-semibold">
                              {row.skill.code} · {session?.code ?? "Session"}
                            </div>
                            {cell.entries.map((entry) => (
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
                          </>
                        ) : (
                          <>
                            <div className="text-gray-800 font-semibold">
                              Add coverage
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(Object.keys(LEVEL_BADGE) as FlowCoverageLevel[]).map((level) => (
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
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
