"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  api,
  type Term,
  type Session,
} from "@/lib/api-client";
import WhatIfPanel from "@/components/WhatIfPanel";

export default function TermDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [term, setTerm] = useState<Term | null>(null);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [showAddModule, setShowAddModule] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [showAddSession, setShowAddSession] = useState<string | null>(null);
  const [moveSession, setMoveSession] = useState<string | null>(null);
  const [whatIfSession, setWhatIfSession] = useState<string | null>(null);
  const [compareSession, setCompareSession] = useState<string | null>(null);
  const [moveResult, setMoveResult] = useState<{
    affectedSkillIds: string[];
    newViolations: { type: string; message: string }[];
  } | null>(null);
  const [modForm, setModForm] = useState({
    code: "",
    title: "",
    description: "",
  });
  const [sessionForm, setSessionForm] = useState({
    sessionType: "lecture" as "lecture" | "lab",
    code: "",
    title: "",
    date: "",
    description: "",
    format: "traditional",
  });
  const [moveForm, setMoveForm] = useState({ date: "", sequence: 0 });

  const load = useCallback(async () => {
    const [t, sessions] = await Promise.all([
      api.getTerm(id),
      api.getSessions({ termId: id }),
    ]);
    setTerm(t);
    setAllSessions(sessions);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApplyCancel = useCallback(
    async (
      sessionId: string,
      reason: string,
      redistributions: Array<{ skillId: string; level: string; targetSessionId: string }>,
    ) => {
      try {
        await api.cancelSession(sessionId, { reason, redistributions });
        load();
      } catch (err) {
        console.error("Cancel error:", err);
      }
    },
    [load],
  );

  async function addModule(e: React.FormEvent) {
    e.preventDefault();
    if (!term) return;
    await api.createModule({
      termId: term.id,
      sequence: term.modules?.length ?? 0,
      ...modForm,
    });
    setShowAddModule(false);
    setModForm({ code: "", title: "", description: "" });
    load();
  }

  async function deleteModule(moduleId: string) {
    if (!confirm("Delete this module and all its sessions?")) return;
    await api.deleteModule(moduleId);
    load();
  }

  async function addSession(moduleId: string, e: React.FormEvent) {
    e.preventDefault();
    const mod = term?.modules?.find((m) => m.id === moduleId);
    await api.createSession({
      moduleId,
      sequence: mod?.sessions?.length ?? 0,
      ...sessionForm,
      date: sessionForm.date || null,
    });
    setShowAddSession(null);
    setSessionForm({
      sessionType: "lecture",
      code: "",
      title: "",
      date: "",
      description: "",
      format: "traditional",
    });
    load();
  }

  async function updateSession(sessionId: string, e: React.FormEvent) {
    e.preventDefault();
    await api.updateSession(sessionId, {
      ...sessionForm,
      date: sessionForm.date || null,
    });
    setEditingSession(null);
    load();
  }

  async function deleteSession(sessionId: string) {
    if (!confirm("Delete this session?")) return;
    await api.deleteSession(sessionId);
    load();
  }

  async function handleMoveSession(sessionId: string, e: React.FormEvent) {
    e.preventDefault();
    const result = await api.moveSession(sessionId, {
      date: moveForm.date || null,
      sequence: moveForm.sequence,
    });
    if (result.impact) {
      setMoveResult(result.impact);
    }
    setMoveSession(null);
    load();
  }

  if (!term) return <p className="text-gray-500">Loading...</p>;

  const modules = term.modules ?? [];

  return (
    <div className={`${whatIfSession ? "mr-[420px]" : ""} transition-all`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold">
            {term.name}{" "}
            <span className="text-gray-400 font-normal text-lg">
              {term.courseCode} ({term.code})
            </span>
          </h1>
          <p className="text-sm text-gray-500">
            {term.instructor?.name} &middot;{" "}
            {new Date(term.startDate).toLocaleDateString()} —{" "}
            {new Date(term.endDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/terms/${id}/coverage`}
            className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700"
          >
            Coverage Matrix
          </Link>
          <Link
            href={`/terms/${id}/impact`}
            className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm hover:bg-orange-700"
          >
            Impact Report
          </Link>
          <Link
            href={`/terms/${id}/assessments`}
            className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"
          >
            Assessments
          </Link>
          <Link
            href={`/terms/${id}/calendar`}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
          >
            Calendar
          </Link>
          <Link
            href={`/terms/${id}/import`}
            className="bg-gray-600 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700"
          >
            Import
          </Link>
        </div>
      </div>

      {/* Move result banner */}
      {moveResult && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-sm">Session Moved</p>
              <p className="text-sm text-gray-600">
                Affected skills: {moveResult.affectedSkillIds.length}
              </p>
              {moveResult.newViolations.length > 0 && (
                <div className="mt-2">
                  <p className="text-red-600 text-sm font-medium">
                    New violations detected:
                  </p>
                  {moveResult.newViolations.map((v, i) => (
                    <p key={i} className="text-red-600 text-xs">
                      {v.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setMoveResult(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Modules */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Modules</h2>
        <button
          onClick={() => setShowAddModule(!showAddModule)}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
        >
          Add Module
        </button>
      </div>

      {showAddModule && (
        <form
          onSubmit={addModule}
          className="bg-white border rounded p-3 mb-3 grid grid-cols-3 gap-2"
        >
          <input
            value={modForm.code}
            onChange={(e) => setModForm({ ...modForm, code: e.target.value })}
            placeholder="Code (e.g. LM-01)"
            className="border rounded px-2 py-1 text-sm"
            required
          />
          <input
            value={modForm.title}
            onChange={(e) => setModForm({ ...modForm, title: e.target.value })}
            placeholder="Title"
            className="border rounded px-2 py-1 text-sm"
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAddModule(false)}
              className="border px-3 py-1 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {modules.length === 0 ? (
        <p className="text-gray-500 text-sm">No modules yet.</p>
      ) : (
        <div className="space-y-4">
          {modules.map((mod) => (
            <div key={mod.id} className="bg-white border rounded">
              <div className="px-4 py-3 border-b flex justify-between items-center">
                <div>
                  <span className="font-medium">
                    {mod.code}: {mod.title}
                  </span>
                  <span className="text-gray-400 text-sm ml-2">
                    ({(mod.sessions ?? []).length} sessions)
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setShowAddSession(
                        showAddSession === mod.id ? null : mod.id,
                      )
                    }
                    className="text-blue-600 text-sm hover:underline"
                  >
                    Add Session
                  </button>
                  <button
                    onClick={() => deleteModule(mod.id)}
                    className="text-red-600 text-sm hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {showAddSession === mod.id && (
                <form
                  onSubmit={(e) => addSession(mod.id, e)}
                  className="p-3 bg-gray-50 border-b grid grid-cols-3 gap-2"
                >
                  <select
                    value={sessionForm.sessionType}
                    onChange={(e) =>
                      setSessionForm({
                        ...sessionForm,
                        sessionType: e.target.value as "lecture" | "lab",
                      })
                    }
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="lab">Lab</option>
                  </select>
                  <input
                    value={sessionForm.code}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, code: e.target.value })
                    }
                    placeholder="Code (e.g. lec-05)"
                    className="border rounded px-2 py-1 text-sm"
                    required
                  />
                  <input
                    value={sessionForm.title}
                    onChange={(e) =>
                      setSessionForm({
                        ...sessionForm,
                        title: e.target.value,
                      })
                    }
                    placeholder="Title"
                    className="border rounded px-2 py-1 text-sm"
                    required
                  />
                  <input
                    type="date"
                    value={sessionForm.date}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, date: e.target.value })
                    }
                    className="border rounded px-2 py-1 text-sm"
                  />
                  <input
                    value={sessionForm.description}
                    onChange={(e) =>
                      setSessionForm({
                        ...sessionForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Description"
                    className="border rounded px-2 py-1 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddSession(null)}
                      className="border px-3 py-1 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {(mod.sessions ?? []).length > 0 && (
                <div className="divide-y">
                  {(mod.sessions ?? []).map((s) => (
                    <div key={s.id} className="px-4 py-2">
                      {editingSession === s.id ? (
                        <form
                          onSubmit={(e) => updateSession(s.id, e)}
                          className="grid grid-cols-3 gap-2"
                        >
                          <input
                            value={sessionForm.code}
                            onChange={(e) =>
                              setSessionForm({
                                ...sessionForm,
                                code: e.target.value,
                              })
                            }
                            className="border rounded px-2 py-1 text-sm"
                          />
                          <input
                            value={sessionForm.title}
                            onChange={(e) =>
                              setSessionForm({
                                ...sessionForm,
                                title: e.target.value,
                              })
                            }
                            className="border rounded px-2 py-1 text-sm"
                          />
                          <input
                            type="date"
                            value={sessionForm.date}
                            onChange={(e) =>
                              setSessionForm({
                                ...sessionForm,
                                date: e.target.value,
                              })
                            }
                            className="border rounded px-2 py-1 text-sm"
                          />
                          <input
                            value={sessionForm.description ?? ""}
                            onChange={(e) =>
                              setSessionForm({
                                ...sessionForm,
                                description: e.target.value,
                              })
                            }
                            placeholder="Description"
                            className="border rounded px-2 py-1 text-sm"
                          />
                          <input
                            value={sessionForm.format ?? ""}
                            onChange={(e) =>
                              setSessionForm({
                                ...sessionForm,
                                format: e.target.value,
                              })
                            }
                            placeholder="Format"
                            className="border rounded px-2 py-1 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="bg-blue-600 text-white px-2 py-1 rounded text-sm"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSession(null)}
                              className="border px-2 py-1 rounded text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div>
                            <span
                              className={`inline-block text-xs px-1.5 py-0.5 rounded mr-2 ${
                                s.sessionType === "lecture"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {s.sessionType}
                            </span>
                            <span className="font-medium text-sm">
                              {s.code}: {s.title}
                            </span>
                            {s.date && (
                              <span className="text-gray-400 text-xs ml-2">
                                {new Date(s.date).toLocaleDateString()}
                              </span>
                            )}
                            {(s.coverages?.length ?? 0) > 0 && (
                              <span className="text-gray-400 text-xs ml-2">
                                [{s.coverages!.map((c) => `${c.skill?.code}:${c.level[0].toUpperCase()}`).join(", ")}]
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2 text-xs">
                            {s.status === "scheduled" && (
                              <button
                                onClick={() => setWhatIfSession(s.id)}
                                className="text-red-500 hover:underline"
                              >
                                What if cancel?
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingSession(s.id);
                                setSessionForm({
                                  sessionType: s.sessionType,
                                  code: s.code,
                                  title: s.title,
                                  date: s.date
                                    ? s.date.split("T")[0]
                                    : "",
                                  description: s.description ?? "",
                                  format: s.format ?? "traditional",
                                });
                              }}
                              className="text-blue-600 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setMoveSession(
                                  moveSession === s.id ? null : s.id,
                                );
                                setMoveForm({
                                  date: s.date
                                    ? s.date.split("T")[0]
                                    : "",
                                  sequence: s.sequence,
                                });
                              }}
                              className="text-orange-600 hover:underline"
                            >
                              Move
                            </button>
                            <button
                              onClick={() => deleteSession(s.id)}
                              className="text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}

                      {moveSession === s.id && (
                        <form
                          onSubmit={(e) => handleMoveSession(s.id, e)}
                          className="mt-2 bg-orange-50 border border-orange-200 rounded p-2 flex gap-2 items-end"
                        >
                          <div>
                            <label className="block text-xs font-medium">
                              New Date
                            </label>
                            <input
                              type="date"
                              value={moveForm.date}
                              onChange={(e) =>
                                setMoveForm({
                                  ...moveForm,
                                  date: e.target.value,
                                })
                              }
                              className="border rounded px-2 py-1 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium">
                              Sequence
                            </label>
                            <input
                              type="number"
                              value={moveForm.sequence}
                              onChange={(e) =>
                                setMoveForm({
                                  ...moveForm,
                                  sequence: parseInt(e.target.value) || 0,
                                })
                              }
                              className="border rounded px-2 py-1 text-sm w-20"
                            />
                          </div>
                          <button
                            type="submit"
                            className="bg-orange-600 text-white px-3 py-1 rounded text-sm"
                          >
                            Move & Show Impact
                          </button>
                          <button
                            type="button"
                            onClick={() => setMoveSession(null)}
                            className="border px-3 py-1 rounded text-sm"
                          >
                            Cancel
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* What-If side panel */}
      {whatIfSession && (
        <WhatIfPanel
          sessionId={whatIfSession}
          termId={id}
          sessions={allSessions}
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
