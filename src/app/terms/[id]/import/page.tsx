"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Tab = "calendar" | "structure" | "csv";

interface ValidationResult {
  valid: boolean;
  counts: Record<string, number>;
  warnings: string[];
  errors: string[];
}

function validateCalendarJson(text: string): ValidationResult {
  try {
    const data = JSON.parse(text);
    if (!data.slots || !Array.isArray(data.slots)) {
      return { valid: false, counts: {}, warnings: [], errors: ["Missing 'slots' array"] };
    }
    const counts: Record<string, number> = {};
    for (const slot of data.slots) {
      const type = slot.slotType || "unknown";
      counts[type] = (counts[type] || 0) + 1;
    }
    return { valid: true, counts, warnings: [], errors: [] };
  } catch {
    return { valid: false, counts: {}, warnings: [], errors: ["Invalid JSON"] };
  }
}

function validateStructureJson(text: string): ValidationResult {
  try {
    const data = JSON.parse(text);
    const counts: Record<string, number> = {};
    const warnings: string[] = [];
    const errors: string[] = [];

    counts.modules = data.modules?.length || 0;
    counts.sessions = (data.modules || []).reduce(
      (n: number, m: { sessions?: unknown[] }) => n + (m.sessions?.length || 0),
      0,
    );
    counts.skills = data.skills?.length || 0;
    counts.coverages = data.coverages?.length || 0;
    counts.assessments = data.assessments?.length || 0;

    // Check referential integrity
    const sessionCodes = new Set<string>();
    for (const mod of data.modules || []) {
      for (const s of mod.sessions || []) {
        sessionCodes.add(s.code);
      }
    }
    const skillCodes = new Set((data.skills || []).map((s: { code: string }) => s.code));

    for (const cov of data.coverages || []) {
      if (!sessionCodes.has(cov.sessionCode)) {
        errors.push(`Coverage references unknown session: ${cov.sessionCode}`);
      }
      if (!skillCodes.has(cov.skillCode)) {
        errors.push(`Coverage references unknown skill: ${cov.skillCode}`);
      }
    }

    return { valid: errors.length === 0, counts, warnings, errors };
  } catch {
    return { valid: false, counts: {}, warnings: [], errors: ["Invalid JSON"] };
  }
}

export default function ImportPage() {
  const { id: termId } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("calendar");
  const [text, setText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = useCallback(() => {
    setError(null);
    setResult(null);
    if (tab === "calendar") {
      setValidation(validateCalendarJson(text));
    } else if (tab === "structure") {
      setValidation(validateStructureJson(text));
    }
  }, [tab, text]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, target: "json" | "csv") => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        if (target === "csv") {
          setCsvText(content);
        } else {
          setText(content);
          setValidation(null);
          setResult(null);
        }
      };
      reader.readAsText(file);
    },
    [],
  );

  const handleImport = useCallback(async () => {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      let url = "";
      let body: string;
      let contentType = "application/json";

      if (tab === "calendar") {
        url = `/api/terms/${termId}/import-calendar`;
        body = text;
      } else if (tab === "structure") {
        url = `/api/terms/${termId}/import-structure`;
        body = text;
      } else {
        url = `/api/terms/${termId}/import-skills-csv`;
        body = csvText;
        contentType = "text/csv";
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error + (data.details ? `\n${JSON.stringify(data.details, null, 2)}` : ""));
      } else {
        setResult(data);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }, [tab, text, csvText, termId]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/terms/${termId}`}
          className="text-blue-600 hover:underline text-sm"
        >
          &larr; Back to Term
        </Link>
        <h1 className="text-2xl font-bold">Import Data</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(
          [
            ["calendar", "Academic Calendar"],
            ["structure", "Course Structure"],
            ["csv", "Skills CSV"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setValidation(null);
              setResult(null);
              setError(null);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Calendar / Structure tab */}
      {(tab === "calendar" || tab === "structure") && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload JSON file or paste below
            </label>
            <input
              type="file"
              accept=".json"
              onChange={(e) => handleFileUpload(e, "json")}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white hover:file:bg-gray-50 mb-2"
            />
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setValidation(null);
                setResult(null);
              }}
              rows={12}
              className="w-full border border-gray-300 rounded-md p-3 font-mono text-sm"
              placeholder={
                tab === "calendar"
                  ? '{\n  "slots": [\n    { "date": "2026-01-20", "dayOfWeek": "Tuesday", "slotType": "class_day" }\n  ]\n}'
                  : '{\n  "modules": [...],\n  "skills": [...],\n  "coverages": [...],\n  "assessments": [...]\n}'
              }
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleValidate}
              disabled={!text.trim()}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 text-sm font-medium"
            >
              Validate
            </button>
            <button
              onClick={handleImport}
              disabled={
                importing ||
                !text.trim() ||
                (validation !== null && !validation.valid)
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {importing ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      )}

      {/* CSV tab */}
      {tab === "csv" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload CSV file or paste below
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileUpload(e, "csv")}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white hover:file:bg-gray-50 mb-2"
            />
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setResult(null);
                setError(null);
              }}
              rows={10}
              className="w-full border border-gray-300 rounded-md p-3 font-mono text-sm"
              placeholder="code,category,description,module_code&#10;LM01-C01,Programming Basics,Use variables and assignment,LM-01"
            />
          </div>

          <button
            onClick={handleImport}
            disabled={importing || !csvText.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {importing ? "Importing..." : "Import Skills"}
          </button>
        </div>
      )}

      {/* Validation preview */}
      {validation && (
        <div
          className={`mt-4 p-4 rounded-md border ${
            validation.valid
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <h3 className="font-medium mb-2">
            {validation.valid ? "Validation passed" : "Validation failed"}
          </h3>
          {Object.keys(validation.counts).length > 0 && (
            <div className="mb-2">
              <span className="text-sm font-medium text-gray-600">Counts: </span>
              {Object.entries(validation.counts).map(([k, v]) => (
                <span
                  key={k}
                  className="inline-block bg-white px-2 py-1 rounded text-xs mr-2 border"
                >
                  {k}: {v}
                </span>
              ))}
            </div>
          )}
          {validation.errors.length > 0 && (
            <ul className="text-sm text-red-700 list-disc list-inside">
              {validation.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <ul className="text-sm text-yellow-700 list-disc list-inside">
              {validation.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Import result */}
      {result && (
        <div className="mt-4 p-4 rounded-md border bg-green-50 border-green-200">
          <h3 className="font-medium text-green-800 mb-2">Import successful</h3>
          <pre className="text-sm font-mono bg-white p-3 rounded border overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
          <div className="mt-3 flex gap-3">
            <Link
              href={`/terms/${termId}`}
              className="text-blue-600 hover:underline text-sm"
            >
              View Term
            </Link>
            <Link
              href={`/terms/${termId}/calendar`}
              className="text-blue-600 hover:underline text-sm"
            >
              View Calendar
            </Link>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 rounded-md border bg-red-50 border-red-200">
          <h3 className="font-medium text-red-800 mb-2">Import failed</h3>
          <pre className="text-sm text-red-700 whitespace-pre-wrap">{error}</pre>
        </div>
      )}
    </div>
  );
}
