"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";

interface ValidationItem {
  type: string;
  message: string;
  skillId?: string;
  sessionId?: string;
  moduleId?: string;
}

interface ImpactReport {
  termId: string;
  errors: ValidationItem[];
  warnings: ValidationItem[];
  info: ValidationItem[];
  summary: {
    totalSkills: number;
    totalSessions: number;
    totalCoverageEntries: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
}

export default function ImpactPage() {
  const { id: termId } = useParams<{ id: string }>();
  const [report, setReport] = useState<ImpactReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = (await api.getTermImpact(termId)) as ImpactReport;
    setReport(r);
    setLoading(false);
  }, [termId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-gray-500">Loading impact report...</p>;
  if (!report) return <p className="text-gray-500">No data.</p>;

  const typeIcon = (type: string) => {
    if (type.includes("before")) return "border-red-300 bg-red-50";
    if (type === "gaie_progression_broken") return "border-red-300 bg-red-50";
    if (type === "skill_not_assessed" || type === "module_no_skills")
      return "border-yellow-300 bg-yellow-50";
    return "border-blue-300 bg-blue-50";
  };

  return (
    <div>
      <Link
        href={`/terms/${termId}`}
        className="text-blue-600 text-sm hover:underline"
      >
        &larr; Back to Term
      </Link>
      <h1 className="text-2xl font-bold mt-1 mb-4">
        Impact & Validation Report
      </h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded p-4 text-center">
          <p className="text-2xl font-bold text-red-600">
            {report.summary.errorCount}
          </p>
          <p className="text-sm text-gray-500">Errors</p>
        </div>
        <div className="bg-white border rounded p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {report.summary.warningCount}
          </p>
          <p className="text-sm text-gray-500">Warnings</p>
        </div>
        <div className="bg-white border rounded p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {report.summary.infoCount}
          </p>
          <p className="text-sm text-gray-500">Info</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded p-3 text-center">
          <p className="font-semibold">{report.summary.totalSkills}</p>
          <p className="text-xs text-gray-500">Skills</p>
        </div>
        <div className="bg-white border rounded p-3 text-center">
          <p className="font-semibold">{report.summary.totalSessions}</p>
          <p className="text-xs text-gray-500">Sessions</p>
        </div>
        <div className="bg-white border rounded p-3 text-center">
          <p className="font-semibold">
            {report.summary.totalCoverageEntries}
          </p>
          <p className="text-xs text-gray-500">Coverage Entries</p>
        </div>
      </div>

      {/* All clear? */}
      {report.errors.length === 0 &&
        report.warnings.length === 0 &&
        report.info.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded p-4 text-green-800">
            All checks passed. No issues found.
          </div>
        )}

      {/* Errors */}
      {report.errors.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-red-600 mb-2">
            Errors ({report.errors.length})
          </h2>
          <div className="space-y-2">
            {report.errors.map((e, i) => (
              <div
                key={i}
                className={`border rounded p-3 ${typeIcon(e.type)}`}
              >
                <p className="text-sm font-medium">{e.message}</p>
                <p className="text-xs text-gray-500 mt-1">Type: {e.type}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-yellow-600 mb-2">
            Warnings ({report.warnings.length})
          </h2>
          <div className="space-y-2">
            {report.warnings.map((w, i) => (
              <div
                key={i}
                className={`border rounded p-3 ${typeIcon(w.type)}`}
              >
                <p className="text-sm font-medium">{w.message}</p>
                <p className="text-xs text-gray-500 mt-1">Type: {w.type}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      {report.info.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-blue-600 mb-2">
            Info ({report.info.length})
          </h2>
          <div className="space-y-2">
            {report.info.map((inf, i) => (
              <div
                key={i}
                className={`border rounded p-3 ${typeIcon(inf.type)}`}
              >
                <p className="text-sm font-medium">{inf.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={load}
        className="mt-4 border px-4 py-2 rounded text-sm hover:bg-gray-100"
      >
        Refresh Report
      </button>
    </div>
  );
}
