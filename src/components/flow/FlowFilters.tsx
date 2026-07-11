"use client";

import type { FlowModuleGroup } from "@/app/terms/[id]/flow/flow-utils";

export interface FlowFiltersState {
  category: string;
  moduleId: string;
  gapsOnly: boolean;
  showCanceled: boolean;
}

interface FlowFiltersProps {
  categories: string[];
  modules: FlowModuleGroup[];
  filters: FlowFiltersState;
  onChange: (filters: FlowFiltersState) => void;
}

export default function FlowFilters({ categories, modules, filters, onChange }: FlowFiltersProps) {
  const handleCategoryChange = (value: string) => onChange({ ...filters, category: value });
  const handleModuleChange = (value: string) => onChange({ ...filters, moduleId: value });
  const handleToggle = (key: "gapsOnly" | "showCanceled") =>
    onChange({ ...filters, [key]: !filters[key] });

  return (
    <div className="bg-white rounded border px-4 py-3 flex flex-wrap gap-4 items-center">
      <div className="flex flex-col">
        <label className="text-xs font-semibold text-gray-500 uppercase">Category</label>
        <select
          value={filters.category}
          onChange={(event) => handleCategoryChange(event.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-semibold text-gray-500 uppercase">Module</label>
        <select
          value={filters.moduleId}
          onChange={(event) => handleModuleChange(event.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="all">All modules</option>
          {modules.map((group) => (
            <option key={group.module.id} value={group.module.id}>
              {group.module.code}: {group.module.title}
            </option>
          ))}
        </select>
      </div>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={filters.gapsOnly}
          onChange={() => handleToggle("gapsOnly")}
          className="h-4 w-4 border-gray-300 rounded"
        />
        Gaps only
      </label>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={filters.showCanceled}
          onChange={() => handleToggle("showCanceled")}
          className="h-4 w-4 border-gray-300 rounded"
        />
        Show canceled
      </label>
    </div>
  );
}
