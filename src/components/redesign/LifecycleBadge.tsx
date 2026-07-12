"use client";

import type { TermStatus } from "@/lib/redesign-contract";

const STYLES: Record<TermStatus, string> = {
  planned: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  closed: "bg-slate-200 text-slate-600",
};

const LABELS: Record<TermStatus, string> = {
  planned: "Planned",
  active: "Active",
  closed: "Closed",
};

export default function LifecycleBadge({ status }: { status: TermStatus }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
