"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

interface Term {
  id: string;
  code: string;
  name: string;
  courseCode: string;
  startDate: string;
  endDate: string;
  clonedFromId: string | null;
  instructor: { id: string; name: string };
  _count: { modules: number; assessments: number };
}

interface Instructor {
  id: string;
  name: string;
  email: string;
}

export default function TermsPage() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showClone, setShowClone] = useState<string | null>(null);
  const [form, setForm] = useState({
    instructorId: "",
    code: "",
    name: "",
    startDate: "",
    endDate: "",
    courseCode: "DS-100",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [t, i] = await Promise.all([
      api.getTerms() as unknown as Promise<Term[]>,
      api.getInstructors() as unknown as Promise<Instructor[]>,
    ]);
    setTerms(t);
    setInstructors(i);
    if (i.length > 0 && !form.instructorId) {
      setForm((f) => ({ ...f, instructorId: i[0].id }));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.createTerm(form);
    setShowCreate(false);
    setForm({ ...form, code: "", name: "", startDate: "", endDate: "" });
    loadData();
  }

  async function handleClone(sourceId: string, e: React.FormEvent) {
    e.preventDefault();
    await api.cloneTerm(sourceId, form);
    setShowClone(null);
    setForm({ ...form, code: "", name: "", startDate: "", endDate: "" });
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this term and all its data?")) return;
    await api.deleteTerm(id);
    loadData();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Terms</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Create Term
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white border rounded p-4 mb-4 grid grid-cols-2 gap-3"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Instructor</label>
            <select
              value={form.instructorId}
              onChange={(e) =>
                setForm({ ...form, instructorId: e.target.value })
              }
              className="w-full border rounded px-2 py-1.5 text-sm"
            >
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Course Code
            </label>
            <input
              value={form.courseCode}
              onChange={(e) =>
                setForm({ ...form, courseCode: e.target.value })
              }
              className="w-full border rounded px-2 py-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Term Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. S26"
              className="w-full border rounded px-2 py-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Term Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Spring 2026"
              className="w-full border rounded px-2 py-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) =>
                setForm({ ...form, startDate: e.target.value })
              }
              className="w-full border rounded px-2 py-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) =>
                setForm({ ...form, endDate: e.target.value })
              }
              className="w-full border rounded px-2 py-1.5 text-sm"
              required
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

      {terms.length === 0 ? (
        <p className="text-gray-500">
          No terms yet. Create one to get started.
        </p>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {terms.map((t) => (
            <div key={t.id} className="px-4 py-3">
              <div className="flex justify-between items-start">
                <Link
                  href={`/terms/${t.id}`}
                  className="hover:text-blue-600"
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="text-gray-500 ml-2 text-sm">
                    {t.courseCode} ({t.code})
                  </span>
                  {t.clonedFromId && (
                    <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      cloned
                    </span>
                  )}
                </Link>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>{t._count.modules} modules</span>
                  <span>{t._count.assessments} assessments</span>
                  <span>{t.instructor.name}</span>
                  <button
                    onClick={() => {
                      setShowClone(showClone === t.id ? null : t.id);
                      setForm({
                        ...form,
                        code: "",
                        name: "",
                        startDate: "",
                        endDate: "",
                        instructorId: t.instructor.id,
                      });
                    }}
                    className="text-blue-600 hover:underline"
                  >
                    Clone
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(t.startDate).toLocaleDateString()} —{" "}
                {new Date(t.endDate).toLocaleDateString()}
              </div>

              {showClone === t.id && (
                <form
                  onSubmit={(e) => handleClone(t.id, e)}
                  className="mt-3 bg-gray-50 border rounded p-3 grid grid-cols-2 gap-2"
                >
                  <h3 className="col-span-2 font-medium text-sm">
                    Clone &ldquo;{t.name}&rdquo;
                  </h3>
                  <input
                    value={form.code}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value })
                    }
                    placeholder="New term code (e.g. F26)"
                    className="border rounded px-2 py-1 text-sm"
                    required
                  />
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="New term name"
                    className="border rounded px-2 py-1 text-sm"
                    required
                  />
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                    className="border rounded px-2 py-1 text-sm"
                    required
                  />
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                    className="border rounded px-2 py-1 text-sm"
                    required
                  />
                  <div className="col-span-2 flex gap-2">
                    <button
                      type="submit"
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Clone
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClone(null)}
                      className="border px-3 py-1 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
