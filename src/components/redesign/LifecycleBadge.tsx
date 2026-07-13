"use client";

import type { TermStatus } from "@/lib/redesign-contract";

const STYLES: Record<TermStatus, string> = {
  planned: "bg-paper-inset text-ink-muted",
  active: "bg-accent-tint text-accent-strong",
  closed: "bg-line text-ink-soft",
};

const LABELS: Record<TermStatus, string> = {
  planned: "Planned",
  active: "Active",
  closed: "Closed",
};

export default function LifecycleBadge({ status }: { status: TermStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-wide ${STYLES[status]}`}
    >
      <span aria-hidden className="text-[0.6rem]">
        {status === "active" ? "●" : status === "closed" ? "■" : "○"}
      </span>
      {LABELS[status]}
    </span>
  );
}
