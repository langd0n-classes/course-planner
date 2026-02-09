"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";

interface Skill {
  id: string;
  code: string;
  category: string;
  description: string;
  isGlobal: boolean;
  _count: { coverages: number; assessmentSkills: number };
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [form, setForm] = useState({
    code: "",
    category: "",
    description: "",
    isGlobal: true,
  });

  useEffect(() => {
    loadSkills();
  }, []);

  async function loadSkills() {
    const s = (await api.getSkills()) as unknown as Skill[];
    setSkills(s);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.createSkill(form);
    setShowCreate(false);
    setForm({ code: "", category: "", description: "", isGlobal: true });
    loadSkills();
  }

  async function handleUpdate(id: string, e: React.FormEvent) {
    e.preventDefault();
    await api.updateSkill(id, form);
    setEditingSkill(null);
    loadSkills();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this skill? This will also remove coverage entries."))
      return;
    await api.deleteSkill(id);
    loadSkills();
  }

  const categories = [...new Set(skills.map((s) => s.category))].sort();
  const filtered = filterCategory
    ? skills.filter((s) => s.category === filterCategory)
    : skills;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Skills</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Add Skill
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500 ml-3">
          {filtered.length} skill(s)
        </span>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white border rounded p-4 mb-4 grid grid-cols-2 gap-3"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. A01"
              className="w-full border rounded px-2 py-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <input
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value })
              }
              placeholder="e.g. Foundations"
              className="w-full border rounded px-2 py-1.5 text-sm"
              list="categories"
              required
            />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="What the student can do"
              className="w-full border rounded px-2 py-1.5 text-sm"
              required
            />
          </div>
          <div className="col-span-2 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isGlobal}
                onChange={(e) =>
                  setForm({ ...form, isGlobal: e.target.checked })
                }
              />
              Global (shared across terms)
            </label>
            <div className="flex gap-2 ml-auto">
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
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <p className="text-gray-500">No skills found.</p>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filtered.map((s) =>
            editingSkill === s.id ? (
              <form
                key={s.id}
                onSubmit={(e) => handleUpdate(s.id, e)}
                className="px-4 py-3 grid grid-cols-4 gap-2"
              >
                <input
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value })
                  }
                  className="border rounded px-2 py-1 text-sm"
                />
                <input
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="border rounded px-2 py-1 text-sm"
                />
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="border rounded px-2 py-1 text-sm"
                />
                <div className="flex gap-1">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-2 py-1 rounded text-sm"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSkill(null)}
                    className="border px-2 py-1 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div key={s.id} className="px-4 py-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-mono text-sm font-medium">
                      {s.code}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded ml-2">
                      {s.category}
                    </span>
                    {!s.isGlobal && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded ml-1">
                        term-specific
                      </span>
                    )}
                    <span className="text-gray-600 text-sm ml-3">
                      {s.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{s._count.coverages} coverages</span>
                    <span>{s._count.assessmentSkills} assessments</span>
                    <button
                      onClick={() => {
                        setEditingSkill(s.id);
                        setForm({
                          code: s.code,
                          category: s.category,
                          description: s.description,
                          isGlobal: s.isGlobal,
                        });
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
