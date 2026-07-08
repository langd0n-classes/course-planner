"use client";

const TYPE_STYLES: Record<string, string> = {
  lecture: "bg-blue-100 text-blue-700",
  lab: "bg-green-100 text-green-700",
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-gray-100 text-gray-600",
  canceled: "bg-red-100 text-red-700",
  moved: "bg-orange-100 text-orange-700",
};

const ASSESSMENT_STYLES: Record<string, string> = {
  gaie: "bg-purple-100 text-purple-700",
  assignment: "bg-blue-100 text-blue-700",
  exam: "bg-red-100 text-red-700",
  project: "bg-green-100 text-green-700",
};

export function SessionTypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded ${TYPE_STYLES[type] ?? "bg-gray-100"}`}>
      {type}
    </span>
  );
}

export function SessionStatusBadge({ status }: { status: string }) {
  if (status === "scheduled") return null;
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded ${STATUS_STYLES[status] ?? "bg-gray-100"}`}>
      {status}
    </span>
  );
}

export function AssessmentTypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded ${ASSESSMENT_STYLES[type] ?? "bg-gray-100"}`}>
      {type}
    </span>
  );
}
