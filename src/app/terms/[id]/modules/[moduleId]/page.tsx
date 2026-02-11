"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  api,
  type Module,
  type Session,
  type Coverage,
  type Skill,
} from "@/lib/api-client";
import Breadcrumbs from "@/components/Breadcrumbs";
import EditableText from "@/components/EditableText";
import CoverageBadge from "@/components/CoverageBadge";
import { SessionTypeBadge, SessionStatusBadge } from "@/components/StatusBadge";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { useToast } from "@/components/Toast";

export default function ModuleDetailPage() {
  const { id: termId, moduleId } = useParams<{ id: string; moduleId: string }>();
  const { showToast } = useToast();

  const [mod, setMod] = useState<Module | null>(null);
  const [termName, setTermName] = useState("");
  const [loading, setLoading] = useState(true);
  const [newObjective, setNewObjective] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [m, term] = await Promise.all([
      api.getModule(moduleId),
      api.getTerm(termId),
    ]);
    setMod(m);
    setTermName(term.name);
    setLoading(false);
  }, [moduleId, termId]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateField(field: string, value: unknown) {
    try {
      await api.updateModule(moduleId, { [field]: value });
      showToast("Module updated");
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function updateSessionDescription(sessionId: string, description: string) {
    try {
      await api.updateSession(sessionId, { description });
      showToast("Description updated");
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function addObjective() {
    if (!newObjective.trim() || !mod) return;
    const updated = [...mod.learningObjectives, newObjective.trim()];
    await updateField("learningObjectives", updated);
    setNewObjective("");
  }

  async function removeObjective(index: number) {
    if (!mod) return;
    const updated = mod.learningObjectives.filter((_, i) => i !== index);
    await updateField("learningObjectives", updated);
  }

  if (loading) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: "Terms", href: "/" },
            { label: "...", href: `/terms/${termId}` },
            { label: "Module" },
          ]}
        />
        <CardSkeleton />
        <div className="mt-4 space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (!mod) {
    return <p className="text-gray-500">Module not found.</p>;
  }

  const sessions = mod.sessions ?? [];

  // Build a skills summary: all skills covered across module sessions
  const skillMap = new Map<string, { skill: Skill; levels: Set<string>; sessions: string[] }>();
  for (const session of sessions) {
    for (const cov of session.coverages ?? []) {
      if (!cov.skill) continue;
      const existing = skillMap.get(cov.skillId);
      if (existing) {
        existing.levels.add(cov.level);
        if (!existing.sessions.includes(session.code)) {
          existing.sessions.push(session.code);
        }
      } else {
        skillMap.set(cov.skillId, {
          skill: cov.skill,
          levels: new Set([cov.level]),
          sessions: [session.code],
        });
      }
    }
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Terms", href: "/" },
          { label: termName, href: `/terms/${termId}` },
          { label: `${mod.code}: ${mod.title}` },
        ]}
      />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm text-gray-400 font-mono">#{mod.sequence}</span>
          <h1 className="text-2xl font-bold">
            {mod.code}: {mod.title}
          </h1>
        </div>
        {mod.description && (
          <p className="text-gray-600">{mod.description}</p>
        )}
      </div>

      {/* Learning Objectives */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Learning Objectives</h2>
        {mod.learningObjectives.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No learning objectives defined yet.</p>
        ) : (
          <ol className="list-decimal list-inside space-y-1 mb-2">
            {mod.learningObjectives.map((obj, i) => (
              <li key={i} className="text-sm group">
                <span>{obj}</span>
                <button
                  onClick={() => removeObjective(i)}
                  className="ml-2 text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100"
                >
                  remove
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newObjective}
            onChange={(e) => setNewObjective(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addObjective();
            }}
            placeholder="Add learning objective..."
            className="border rounded px-2 py-1 text-sm flex-1"
          />
          <button
            onClick={addObjective}
            disabled={!newObjective.trim()}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </section>

      {/* Sessions */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">
          Sessions ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <div className="bg-white border rounded p-4 text-center text-gray-500 text-sm">
            No sessions in this module yet. Import course structure or add sessions from the term view.
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`bg-white border rounded p-4 ${
                  session.status === "canceled" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <SessionTypeBadge type={session.sessionType} />
                  <SessionStatusBadge status={session.status} />
                  <Link
                    href={`/terms/${termId}/sessions/${session.id}`}
                    className="font-medium text-sm hover:underline"
                  >
                    <span className={session.status === "canceled" ? "line-through" : ""}>
                      {session.code}: {session.title}
                    </span>
                  </Link>
                  {session.date && (
                    <span className="text-xs text-gray-400">
                      {new Date(session.date).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Editable description */}
                <EditableText
                  value={session.description ?? ""}
                  onSave={(val) => updateSessionDescription(session.id, val)}
                  placeholder="Click to add description..."
                  multiline
                  className="text-gray-600"
                />

                {/* Coverage badges */}
                {(session.coverages?.length ?? 0) > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {session.coverages!.map((cov: Coverage) => (
                      <span
                        key={cov.id}
                        className="inline-flex items-center gap-0.5 text-xs"
                      >
                        <span className="text-gray-500">{cov.skill?.code}:</span>
                        <CoverageBadge level={cov.level} />
                      </span>
                    ))}
                  </div>
                )}

                {/* Cancellation info */}
                {session.status === "canceled" && session.canceledReason && (
                  <p className="text-xs text-red-500 mt-2">
                    Canceled: {session.canceledReason}
                    {session.canceledAt && (
                      <span className="text-gray-400 ml-1">
                        ({new Date(session.canceledAt).toLocaleDateString()})
                      </span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Skills Summary */}
      {skillMap.size > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Skills Covered in This Module</h2>
          <div className="bg-white border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium">Skill</th>
                  <th className="px-3 py-2 text-left font-medium">Levels</th>
                  <th className="px-3 py-2 text-left font-medium">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {[...skillMap.values()].map(({ skill, levels, sessions: sessCodes }) => (
                  <tr key={skill.id} className="border-b">
                    <td className="px-3 py-2">
                      <Link
                        href={`/terms/${termId}/skills/${skill.id}`}
                        className="hover:underline"
                      >
                        <span className="font-medium">{skill.code}</span>{" "}
                        <span className="text-gray-400">{skill.description.slice(0, 40)}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {(["introduced", "practiced", "assessed"] as const).map((l) =>
                          levels.has(l) ? (
                            <CoverageBadge key={l} level={l} />
                          ) : null,
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {sessCodes.join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Notes */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Planning Notes</h2>
        <EditableText
          value={mod.notes ?? ""}
          onSave={(val) => updateField("notes", val)}
          placeholder="Click to add planning notes for this module..."
          multiline
          className="bg-white border rounded p-3"
        />
      </section>
    </div>
  );
}
