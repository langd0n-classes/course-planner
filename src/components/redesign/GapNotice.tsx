"use client";

import type { ReactNode } from "react";

// Design principle #4: gaps are more important than coverage. Every place
// that can be empty (unassigned topics, an adopted module with no
// sessions, a class day with nothing planned) renders through this shared
// dashed-outline treatment so gaps are visually consistent and impossible
// to miss, instead of blending into "just another empty list."
export default function GapNotice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded border border-dashed border-amber-400 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
      <p className="font-medium">{title}</p>
      {children ? <div className="mt-1 text-amber-800">{children}</div> : null}
    </div>
  );
}
