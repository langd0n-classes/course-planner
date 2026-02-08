"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";

interface Skill {
  id: string;
  code: string;
  category: string;
  description: string;
}

interface Session {
  id: string;
  code: string;
  title: string;
  sessionType: string;
  date: string | null;
  module: { id: string; code: string; sequence: number };
  sequence: number;
}

interface CoverageRow {
  id: string;
  level: string;
  sessionId: string;
  skillId: string;
  session: Session;
  skill: Skill;
}

export default function CoverageMatrixPage() {
  const { id: termId } = useParams<{ id: string }>();
  const [coverages, setCoverages] = useState<CoverageRow[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filterModule, setFilterModule] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    sessionId: "",
    skillId: "",
    level: "introduced" as string,
  });

  const load = useCallback(async () => {
    const [c, sk, se] = await Promise.all([
      api.getCoverages({ termId }) as unknown as Promise<CoverageRow[]>,
      api.getSkills() as unknown as Promise<Skill[]>,
      api.getSessions({ termId }) as unknown as Promise<Session[]>,
    ]);
    setCoverages(c);
    setSkills(sk);
    setSessions(se);
  }, [termId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addCoverage(e: React.FormEvent) {
    e.preventDefault();
    await api.createCoverage({
      sessionId: addForm.sessionId,
      skillId: addForm.skillId,
      level: addForm.level as "introduced" | "practiced" | "assessed",
    });
    setShowAdd(false);
    setAddForm({ sessionId: "", skillId: "", level: "introduced" });
    load();
  }

  async function deleteCoverage(covId: string) {
    await api.deleteCoverage(covId);
    load();
  }

  // Build unique modules for filter
  const modules = [
    ...new Map(
      sessions.map((s) => [s.module.id, s.module]),
    ).values(),
  ].sort((a, b) => a.sequence - b.sequence);

  // Filter sessions
  const filteredSessions = sessions.filter((s) => {
    if (filterModule && s.module.id !== filterModule) return false;
    if (filterType && s.sessionType !== filterType) return false;
    return true;
  });

  // Build matrix: skills as rows, sessions as columns
  const matrix = new Map<string, Map<string, CoverageRow>>();
  for (const cov of coverages) {
    const key = `${cov.skillId}-${cov.sessionId}`;
    if (!matrix.has(cov.skillId)) matrix.set(cov.skillId, new Map());
    matrix.get(cov.skillId)!.set(cov.sessionId, cov);
  }

  const levelBadge = (level: string) => {
    switch (level) {
      case "introduced":
        return "bg-yellow-100 text-yellow-800";
      case "practiced":
        return "bg-blue-100 text-blue-800";
      case "assessed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100";
    }
  };

  const levelAbbrev = (level: string) => {
    switch (level) {
      case "introduced":
        return "I";
      case "practiced":
        return "P";
      case "assessed":
        return "A";
      default:
        return "?";
    }
  };

  // Determine which skills to show (those that appear in coverages or all)
  const coveredSkillIds = new Set(coverages.map((c) => c.skillId));
  const displaySkills = skills.filter((s) => coveredSkillIds.has(s.id));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <Link
            href={`/terms/${termId}`}
            className="text-blue-600 text-sm hover:underline"
          >
            &larr; Back to Term
          </Link>
          <h1 className="text-2xl font-bold mt-1">Coverage Matrix</h1>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
        >
          Add Coverage
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
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
      </div>

      {/* Add Coverage form */}
      {showAdd && (
        <form
          onSubmit={addCoverage}
          className="bg-white border rounded p-3 mb-4 flex gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Session</label>
            <select
              value={addForm.sessionId}
              onChange={(e) =>
                setAddForm({ ...addForm, sessionId: e.target.value })
              }
              className="border rounded px-2 py-1 text-sm"
              required
            >
              <option value="">Select...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}: {s.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Skill</label>
            <select
              value={addForm.skillId}
              onChange={(e) =>
                setAddForm({ ...addForm, skillId: e.target.value })
              }
              className="border rounded px-2 py-1 text-sm"
              required
            >
              <option value="">Select...</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}: {s.description.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Level</label>
            <select
              value={addForm.level}
              onChange={(e) =>
                setAddForm({ ...addForm, level: e.target.value })
              }
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="introduced">Introduced</option>
              <option value="practiced">Practiced</option>
              <option value="assessed">Assessed</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(false)}
            className="border px-3 py-1 rounded text-sm"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Matrix table */}
      {displaySkills.length === 0 || filteredSessions.length === 0 ? (
        <div className="bg-white border rounded p-6 text-center text-gray-500">
          <p>No coverage data yet. Add skills and coverage entries to build the matrix.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="bg-white border rounded text-sm w-full">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium sticky left-0 bg-white min-w-[120px]">
                  Skill
                </th>
                {filteredSessions.map((s) => (
                  <th
                    key={s.id}
                    className="px-2 py-2 text-center font-medium min-w-[60px]"
                  >
                    <span
                      className={`inline-block text-xs px-1 rounded ${
                        s.sessionType === "lecture"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-green-50 text-green-600"
                      }`}
                    >
                      {s.code}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displaySkills.map((skill) => (
                <tr key={skill.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-medium sticky left-0 bg-white">
                    <span className="text-xs text-gray-500">{skill.code}</span>{" "}
                    <span className="text-xs text-gray-400">
                      {skill.description.slice(0, 30)}
                    </span>
                  </td>
                  {filteredSessions.map((session) => {
                    const cov = matrix.get(skill.id)?.get(session.id);
                    return (
                      <td
                        key={session.id}
                        className="px-2 py-1.5 text-center"
                      >
                        {cov ? (
                          <button
                            onClick={() => deleteCoverage(cov.id)}
                            className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer ${levelBadge(cov.level)}`}
                            title={`${cov.level} — click to remove`}
                          >
                            {levelAbbrev(cov.level)}
                          </button>
                        ) : (
                          <span className="text-gray-200">&middot;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
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
      </div>
    </div>
  );
}
