"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  api,
  type Skill,
  type Session,
  type Coverage,
} from "@/lib/api-client";
import {
  assembleCoverageMatrix,
  computeHealthBar,
  filterMatrixRows,
  type MatrixSkill,
  type MatrixSession,
  type MatrixCoverage,
  type MatrixRow,
} from "@/domain/coverage-matrix";
import Breadcrumbs from "@/components/Breadcrumbs";
import CoverageBadge from "@/components/CoverageBadge";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { useToast } from "@/components/Toast";

type FilterMode = "all" | "gaps" | "at_risk";

export default function CoverageMatrixPage() {
  const { id: termId } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [coverages, setCoverages] = useState<Coverage[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterModule, setFilterModule] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [termName, setTermName] = useState("");

  // Popover state for adding coverage via empty cell click
  const [popover, setPopover] = useState<{
    skillId: string;
    sessionId: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, sk, se, term] = await Promise.all([
      api.getCoverages({ termId }),
      api.getSkills(termId),
      api.getSessions({ termId }),
      api.getTerm(termId),
    ]);
    setCoverages(c);
    setSkills(sk);
    setSessions(se);
    setTermName(term.name);
    setLoading(false);
  }, [termId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addCoverage(
    sessionId: string,
    skillId: string,
    level: "introduced" | "practiced" | "assessed",
  ) {
    try {
      await api.createCoverage({ sessionId, skillId, level });
      setPopover(null);
      showToast("Coverage added");
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function deleteCoverage(covId: string) {
    try {
      await api.deleteCoverage(covId);
      showToast("Coverage removed");
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  // Build unique modules for filter
  const modules = [
    ...new Map(
      sessions
        .filter((s) => s.module)
        .map((s) => [s.module!.id, s.module!]),
    ).values(),
  ].sort((a, b) => a.sequence - b.sequence);

  // Filter sessions
  const filteredSessions = sessions.filter((s) => {
    if (filterModule && s.module?.id !== filterModule) return false;
    if (filterType && s.sessionType !== filterType) return false;
    return true;
  });

  // Transform to matrix domain types
  const matrixSkills: MatrixSkill[] = skills.map((s) => ({
    id: s.id,
    code: s.code,
    category: s.category,
    description: s.description,
  }));

  const matrixSessions: MatrixSession[] = filteredSessions.map((s) => ({
    id: s.id,
    code: s.code,
    title: s.title,
    sessionType: s.sessionType,
    date: s.date,
    status: s.status,
    moduleId: s.module?.id ?? "",
    moduleCode: s.module?.code ?? "",
    moduleSequence: s.module?.sequence ?? 0,
    sequence: s.sequence,
  }));

  const matrixCoverages: MatrixCoverage[] = coverages.map((c) => ({
    id: c.id,
    sessionId: c.sessionId,
    skillId: c.skillId,
    level: c.level,
    redistributedFrom: c.redistributedFrom,
  }));

  const allRows = assembleCoverageMatrix(matrixSkills, matrixSessions, matrixCoverages);
  const healthBar = computeHealthBar(allRows);
  const displayRows = filterMatrixRows(allRows, filterMode);

  // Build a quick lookup: `${skillId}-${sessionId}` → coverage entries
  const cellLookup = new Map<string, MatrixCoverage[]>();
  for (const row of displayRows) {
    for (const [sessionId, covs] of row.coverageBySession) {
      cellLookup.set(`${row.skill.id}-${sessionId}`, covs);
    }
  }

  if (loading) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: "Terms", href: "/" },
            { label: "...", href: `/terms/${termId}` },
            { label: "Coverage Matrix" },
          ]}
        />
        <h1 className="text-2xl font-bold mb-4">Coverage Matrix</h1>
        <TableSkeleton rows={8} cols={6} />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Terms", href: "/" },
          { label: termName, href: `/terms/${termId}` },
          { label: "Coverage Matrix" },
        ]}
      />

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Coverage Matrix</h1>
      </div>

      {/* Health Summary Bar */}
      {skills.length > 0 && (
        <div className="mb-4 bg-white border rounded p-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
              <span>
                <strong>{healthBar.fullyCovered}</strong> fully covered
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
              <span>
                <strong>{healthBar.partiallyCovered}</strong> partially covered
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              <span>
                <strong>{healthBar.uncovered}</strong> uncovered
              </span>
            </div>
            <div className="text-gray-400">
              {healthBar.total} skills total
            </div>
          </div>
          {/* Visual bar */}
          {healthBar.total > 0 && (
            <div className="mt-2 flex h-2 rounded-full overflow-hidden bg-gray-100">
              {healthBar.fullyCovered > 0 && (
                <div
                  className="bg-green-500"
                  style={{ width: `${(healthBar.fullyCovered / healthBar.total) * 100}%` }}
                />
              )}
              {healthBar.partiallyCovered > 0 && (
                <div
                  className="bg-yellow-500"
                  style={{ width: `${(healthBar.partiallyCovered / healthBar.total) * 100}%` }}
                />
              )}
              {healthBar.uncovered > 0 && (
                <div
                  className="bg-red-400"
                  style={{ width: `${(healthBar.uncovered / healthBar.total) * 100}%` }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={filterModule}
          onChange={(e) => setFilterModule(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">All Modules</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">All Types</option>
          <option value="lecture">Lectures</option>
          <option value="lab">Labs</option>
        </select>
        <div className="flex gap-1">
          {(
            [
              ["all", "All Skills"],
              ["gaps", "Show Only Gaps"],
              ["at_risk", "Show Only At-Risk"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1 rounded text-sm border ${
                filterMode === mode
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix table */}
      {displayRows.length === 0 ? (
        <div className="bg-white border rounded p-6 text-center text-gray-500">
          {skills.length === 0 ? (
            <div>
              <p className="font-medium mb-1">No skills defined yet</p>
              <p className="text-sm">
                Import course structure or add skills manually to build the coverage matrix.
              </p>
            </div>
          ) : filterMode !== "all" ? (
            <p>No skills match the current filter. Try switching to &quot;All Skills&quot;.</p>
          ) : (
            <p>No sessions match the current filters.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="bg-white border rounded text-sm w-full">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium sticky left-0 bg-white min-w-[160px] z-10">
                  Skill
                </th>
                {filteredSessions.map((s) => (
                  <th
                    key={s.id}
                    className="px-2 py-2 text-center font-medium min-w-[60px]"
                  >
                    <Link
                      href={`/terms/${termId}/sessions/${s.id}`}
                      className={`inline-block text-xs px-1 rounded hover:underline ${
                        s.sessionType === "lecture"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-green-50 text-green-600"
                      } ${s.status === "canceled" ? "line-through opacity-50" : ""}`}
                    >
                      {s.code}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const status = row.fullyCovered
                  ? "bg-white"
                  : row.hasCoverage
                    ? "bg-yellow-50/50"
                    : "bg-red-50/30";
                return (
                  <tr
                    key={row.skill.id}
                    className={`border-b hover:bg-gray-50 ${status}`}
                  >
                    <td className={`px-3 py-1.5 font-medium sticky left-0 z-10 ${status}`}>
                      <Link
                        href={`/terms/${termId}/skills/${row.skill.id}`}
                        className="hover:underline"
                      >
                        <span className="text-xs text-gray-500">{row.skill.code}</span>{" "}
                        <span className="text-xs text-gray-400">
                          {row.skill.description.slice(0, 30)}
                        </span>
                      </Link>
                      {!row.hasCoverage && (
                        <span className="ml-1 text-xs text-red-500 font-normal">(no coverage)</span>
                      )}
                    </td>
                    {filteredSessions.map((session) => {
                      const covs = row.coverageBySession.get(session.id);
                      const isPopoverOpen =
                        popover?.skillId === row.skill.id &&
                        popover?.sessionId === session.id;

                      return (
                        <td
                          key={session.id}
                          className="px-2 py-1.5 text-center relative"
                        >
                          {covs && covs.length > 0 ? (
                            <div className="flex gap-0.5 justify-center">
                              {covs.map((cov) => (
                                <CoverageBadge
                                  key={cov.id}
                                  level={cov.level}
                                  onClick={() => deleteCoverage(cov.id)}
                                  title={`${cov.level} — click to remove`}
                                />
                              ))}
                            </div>
                          ) : session.status !== "canceled" ? (
                            <button
                              onClick={() =>
                                setPopover(
                                  isPopoverOpen
                                    ? null
                                    : { skillId: row.skill.id, sessionId: session.id },
                                )
                              }
                              className="text-gray-200 hover:text-gray-400 hover:bg-gray-100 rounded px-1 w-full"
                              title="Click to add coverage"
                            >
                              +
                            </button>
                          ) : (
                            <span className="text-gray-200">&middot;</span>
                          )}

                          {/* Popover for adding coverage */}
                          {isPopoverOpen && (
                            <div className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-1 bg-white border rounded shadow-lg p-2 flex gap-1 whitespace-nowrap">
                              {(["introduced", "practiced", "assessed"] as const).map(
                                (level) => (
                                  <button
                                    key={level}
                                    onClick={() =>
                                      addCoverage(session.id, row.skill.id, level)
                                    }
                                    className={`text-xs px-2 py-1 rounded font-medium ${
                                      level === "introduced"
                                        ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                        : level === "practiced"
                                          ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                                          : "bg-green-100 text-green-800 hover:bg-green-200"
                                    }`}
                                  >
                                    {level[0].toUpperCase()}
                                  </button>
                                ),
                              )}
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
      )}

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-xs text-gray-500">
        <span>
          <span className="inline-block w-4 h-4 bg-yellow-100 rounded mr-1 align-middle" />{" "}
          I = Introduced
        </span>
        <span>
          <span className="inline-block w-4 h-4 bg-blue-100 rounded mr-1 align-middle" />{" "}
          P = Practiced
        </span>
        <span>
          <span className="inline-block w-4 h-4 bg-green-100 rounded mr-1 align-middle" />{" "}
          A = Assessed
        </span>
        <span className="text-gray-400">
          Click badge to remove &middot; Click empty cell to add &middot; Click
          skill code for detail
        </span>
      </div>
    </div>
  );
}
