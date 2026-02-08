"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";

interface Skill {
  id: string;
  code: string;
  description: string;
}

interface AssessmentSkill {
  skill: Skill;
}

interface Assessment {
  id: string;
  code: string;
  title: string;
  assessmentType: string;
  description: string | null;
  dueDate: string | null;
  progressionStage: string | null;
  skills: AssessmentSkill[];
  session: { id: string; code: string; title: string } | null;
}

export default function AssessmentsPage() {
  const { id: termId } = useParams<{ id: string }>();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [sessions, setSessions] = useState<
    { id: string; code: string; title: string }[]
  >([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    code: "",
    title: "",
    assessmentType: "assignment",
    description: "",
    dueDate: "",
    sessionId: "",
    skillIds: [] as string[],
    progressionStage: "",
  });

  const load = useCallback(async () => {
    const [a, sk, se] = await Promise.all([
      api.getAssessments(termId) as unknown as Promise<Assessment[]>,
      api.getSkills() as unknown as Promise<Skill[]>,
      api.getSessions({ termId }) as unknown as Promise<
        { id: string; code: string; title: string }[]
      >,
    ]);
    setAssessments(a);
    setSkills(sk);
    setSessions(se);
  }, [termId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.createAssessment({
      termId,
      code: form.code,
      title: form.title,
      assessmentType: form.assessmentType as "gaie" | "assignment" | "exam" | "project",
      description: form.description || undefined,
      dueDate: form.dueDate || null,
      sessionId: form.sessionId || null,
      skillIds: form.skillIds,
      progressionStage: form.progressionStage || null,
    });
    setShowCreate(false);
    setForm({
      code: "",
      title: "",
      assessmentType: "assignment",
      description: "",
      dueDate: "",
      sessionId: "",
      skillIds: [],
      progressionStage: "",
    });
    load();
  }

  async function handleDelete(assessmentId: string) {
    if (!confirm("Delete this assessment?")) return;
    await api.deleteAssessment(assessmentId);
    load();
  }

  const typeBadge = (type: string) => {
    switch (type) {
      case "gaie":
        return "bg-purple-100 text-purple-700";
      case "assignment":
        return "bg-blue-100 text-blue-700";
      case "exam":
        return "bg-red-100 text-red-700";
      case "project":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100";
    }
  };

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
          <h1 className="text-2xl font-bold mt-1">Assessments</h1>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
        >
          Create Assessment
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white border rounded p-4 mb-4 grid grid-cols-2 gap-3"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. GAIE-01"
              className="w-full border rounded px-2 py-1 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Assessment title"
              className="w-full border rounded px-2 py-1 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Type</label>
            <select
              value={form.assessmentType}
              onChange={(e) =>
                setForm({ ...form, assessmentType: e.target.value })
              }
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="assignment">Assignment</option>
              <option value="gaie">GAIE</option>
              <option value="exam">Exam</option>
              <option value="project">Project</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Due Date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) =>
                setForm({ ...form, dueDate: e.target.value })
              }
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Session (optional)
            </label>
            <select
              value={form.sessionId}
              onChange={(e) =>
                setForm({ ...form, sessionId: e.target.value })
              }
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="">None</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}: {s.title}
                </option>
              ))}
            </select>
          </div>
          {form.assessmentType === "gaie" && (
            <div>
              <label className="block text-xs font-medium mb-1">
                Progression Stage
              </label>
              <select
                value={form.progressionStage}
                onChange={(e) =>
                  setForm({ ...form, progressionStage: e.target.value })
                }
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="">Select...</option>
                <option value="copy-paste">Copy-Paste</option>
                <option value="modify">Modify</option>
                <option value="write-own">Write Own</option>
              </select>
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">
              Skills Assessed
            </label>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto border rounded p-2">
              {skills.map((s) => (
                <label
                  key={s.id}
                  className={`inline-flex items-center text-xs px-2 py-0.5 rounded cursor-pointer ${
                    form.skillIds.includes(s.id)
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.skillIds.includes(s.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm({
                          ...form,
                          skillIds: [...form.skillIds, s.id],
                        });
                      } else {
                        setForm({
                          ...form,
                          skillIds: form.skillIds.filter(
                            (sid) => sid !== s.id,
                          ),
                        });
                      }
                    }}
                    className="mr-1"
                  />
                  {s.code}
                </label>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full border rounded px-2 py-1 text-sm"
              rows={2}
            />
          </div>
          <div className="col-span-2 flex gap-2">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="border px-4 py-1.5 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {assessments.length === 0 ? (
        <p className="text-gray-500">No assessments yet.</p>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {assessments.map((a) => (
            <div key={a.id} className="px-4 py-3">
              <div className="flex justify-between items-start">
                <div>
                  <span
                    className={`inline-block text-xs px-1.5 py-0.5 rounded mr-2 ${typeBadge(a.assessmentType)}`}
                  >
                    {a.assessmentType}
                  </span>
                  <span className="font-medium">{a.code}: {a.title}</span>
                  {a.progressionStage && (
                    <span className="ml-2 text-xs text-purple-600">
                      [{a.progressionStage}]
                    </span>
                  )}
                </div>
                <div className="flex gap-2 text-xs">
                  {a.dueDate && (
                    <span className="text-gray-500">
                      Due: {new Date(a.dueDate).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {a.description && (
                <p className="text-sm text-gray-500 mt-1">{a.description}</p>
              )}
              {a.skills.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {a.skills.map((as) => (
                    <span
                      key={as.skill.id}
                      className="text-xs bg-gray-100 px-1.5 py-0.5 rounded"
                    >
                      {as.skill.code}
                    </span>
                  ))}
                </div>
              )}
              {a.session && (
                <p className="text-xs text-gray-400 mt-1">
                  Linked to: {a.session.code}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
