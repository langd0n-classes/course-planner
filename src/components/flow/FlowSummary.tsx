"use client";

import type { FlowSummary as FlowSummaryType } from "@/app/terms/[id]/flow/flow-utils";

interface FlowSummaryProps {
  summary: FlowSummaryType;
}

export default function FlowSummary({ summary }: FlowSummaryProps) {
  return (
    <div className="text-sm text-gray-700 flex flex-wrap gap-3 items-center">
      <span>
        {summary.totalSkills} skills: {summary.fullyCovered} fully covered · {summary.partiallyCovered} partial · {summary.uncovered} uncovered
      </span>
      <span className="text-gray-400">|</span>
      <span>
        {summary.totalSessions} sessions: {summary.scheduledSessions} scheduled · {summary.canceledSessions} canceled
      </span>
      <span className="text-gray-400">|</span>
      <span>{summary.skillsAtRiskFromCancellations} skills at risk</span>
    </div>
  );
}
