"use client";

import { useState, useEffect } from "react";
import {
  api,
  type Session,
  type WhatIfImpact,
  type ScenarioComparison,
} from "@/lib/api-client";

// ─── Types for redistribution workflow ─────────────────

interface RedistributionMapping {
  skillId: string;
  skillCode: string;
  level: string;
  targetSessionId: string;
}

type PanelStep = "impact" | "redistribute" | "validate" | "done";

// ─── Props ─────────────────────────────────────────────

interface WhatIfPanelProps {
  sessionId: string;
  termId: string;
  sessions: Session[];
  onClose: () => void;
  onApplyCancel: (
    sessionId: string,
    reason: string,
    redistributions: Array<{ skillId: string; level: string; targetSessionId: string }>,
    force?: boolean,
  ) => void;
  compareSessionId: string | null;
  onSetCompare: (id: string | null) => void;
}

export default function WhatIfPanel({
  sessionId,
  termId,
  sessions,
  onClose,
  onApplyCancel,
  compareSessionId,
  onSetCompare,
}: WhatIfPanelProps) {
  const [impact, setImpact] = useState<WhatIfImpact | null>(null);
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelReason, setCancelReason] = useState("");
  const [demoScenario, setDemoScenario] = useState("");
  const [step, setStep] = useState<PanelStep>("impact");

  // Redistribution state
  const [redistributions, setRedistributions] = useState<RedistributionMapping[]>([]);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    violations: Array<{ type: string; message: string }>;
  } | null>(null);
  const [validating, setValidating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [showNonAtRisk, setShowNonAtRisk] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState<{
    sessionCode: string;
    redistributedCount: number;
  } | null>(null);

  const activeSessionId = demoScenario || sessionId;

  // Demo scenarios
  const demoScenarios = sessions
    .filter((s) => s.status === "scheduled" && (s.coverages?.length ?? 0) > 0)
    .slice(0, 3)
    .map((s) => ({
      id: s.id,
      label: `Cancel ${s.code} -- ${s.coverages?.length ?? 0} skills affected`,
    }));

  // Load impact data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.getSessionWhatIf(activeSessionId);
        setImpact(data);
      } catch (err) {
        console.error("What-if error:", err);
      }
      setLoading(false);
    }
    load();
  }, [activeSessionId]);

  // Load comparison data
  useEffect(() => {
    if (!compareSessionId) {
      setComparison(null);
      return;
    }
    async function loadComparison() {
      try {
        const data = await api.whatIfCompare(termId, activeSessionId, compareSessionId!);
        setComparison(data);
      } catch (err) {
        console.error("Comparison error:", err);
      }
    }
    loadComparison();
  }, [compareSessionId, activeSessionId, termId]);

  const session = sessions.find((s) => s.id === activeSessionId);

  // Get eligible target sessions for redistribution
  const eligibleTargets = sessions
    .filter(
      (s) =>
        s.status === "scheduled" &&
        s.id !== activeSessionId,
    )
    .sort((a, b) => {
      // Same module first, then by module sequence, then session sequence
      const canceledSession = sessions.find((s) => s.id === activeSessionId);
      const aModule = a.module?.id;
      const bModule = b.module?.id;
      const canceledModule = canceledSession?.module?.id;
      if (aModule === canceledModule && bModule !== canceledModule) return -1;
      if (bModule === canceledModule && aModule !== canceledModule) return 1;
      const aMSeq = a.module?.sequence ?? 0;
      const bMSeq = b.module?.sequence ?? 0;
      if (aMSeq !== bMSeq) return aMSeq - bMSeq;
      return a.sequence - b.sequence;
    });

  // Initialize redistribution mappings when entering redistribute step
  function initRedistributions() {
    if (!impact) return;
    const atRisk = impact.atRiskSkills.filter((s) => s.uniqueCoverage);
    const mappings: RedistributionMapping[] = atRisk.map((skill) => ({
      skillId: skill.skillId,
      skillCode: skill.skillCode,
      level: skill.level,
      targetSessionId: "",
    }));
    setRedistributions(mappings);
    setValidationResult(null);
    setStep("redistribute");
  }

  // Update a single redistribution mapping
  function updateRedistribution(index: number, targetSessionId: string) {
    setRedistributions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], targetSessionId };
      return next;
    });
    setValidationResult(null);
  }

  // Suggest redistribution using mock AI
  async function suggestRedistribution() {
    if (!impact) return;
    setSuggesting(true);
    try {
      const suggestions = await api.suggestRedistribution(activeSessionId, termId);
      setRedistributions((prev) =>
        prev.map((r) => {
          const suggestion = suggestions.find((s) => s.skillId === r.skillId);
          if (suggestion) {
            return { ...r, targetSessionId: suggestion.targetSessionId };
          }
          return r;
        }),
      );
    } catch (err) {
      console.error("Suggest redistribution error:", err);
    }
    setSuggesting(false);
  }

  // Validate redistributions
  async function validateRedistributions() {
    setValidating(true);
    try {
      const filled = redistributions.filter((r) => r.targetSessionId);
      const result = await api.cancelSession(activeSessionId, {
        reason: cancelReason,
        redistributions: filled.map((r) => ({
          skillId: r.skillId,
          level: r.level,
          targetSessionId: r.targetSessionId,
        })),
        dryRun: true,
      });
      // dryRun returns { valid, violations }
      const dryRunResult = result as { valid: boolean; violations: Array<{ type: string; message: string }> };
      setValidationResult(dryRunResult);
    } catch (err) {
      console.error("Validation error:", err);
      setValidationResult({
        valid: false,
        violations: [{ type: "error", message: err instanceof Error ? err.message : "Failed to validate" }],
      });
    }
    setValidating(false);
  }

  // Confirm cancellation with redistributions
  function confirmCancellation(force?: boolean) {
    const filled = redistributions.filter((r) => r.targetSessionId);
    onApplyCancel(
      activeSessionId,
      cancelReason,
      filled.map((r) => ({
        skillId: r.skillId,
        level: r.level,
        targetSessionId: r.targetSessionId,
      })),
      force,
    );
    setCancelSuccess({
      sessionCode: session?.code || "",
      redistributedCount: filled.length,
    });
    setStep("done");
  }

  // Cancel without redistributing
  function cancelWithoutRedistributing() {
    onApplyCancel(activeSessionId, cancelReason, []);
    setCancelSuccess({
      sessionCode: session?.code || "",
      redistributedCount: 0,
    });
    setStep("done");
  }

  // At-risk and non-at-risk skill lists
  const atRiskSkills = impact?.atRiskSkills.filter((s) => s.uniqueCoverage) || [];
  const nonAtRiskSkills = impact?.atRiskSkills.filter((s) => !s.uniqueCoverage) || [];

  return (
    <div className="fixed right-0 top-0 h-full w-[420px] bg-white border-l border-gray-200 shadow-lg z-50 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <h2 className="font-bold text-lg">
          {step === "impact" && "What-If Analysis"}
          {step === "redistribute" && "Redistribute Skills"}
          {step === "validate" && "Validate & Confirm"}
          {step === "done" && "Cancellation Complete"}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
          &times;
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* ─── DONE STEP ─────────────────────────────────── */}
        {step === "done" && cancelSuccess && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <h3 className="font-medium text-green-800 mb-2">Session Canceled</h3>
              <p className="text-sm text-green-700">
                {cancelSuccess.sessionCode} has been canceled.
              </p>
              {cancelSuccess.redistributedCount > 0 && (
                <p className="text-sm text-green-700 mt-1">
                  {cancelSuccess.redistributedCount} skill{cancelSuccess.redistributedCount !== 1 ? "s" : ""} redistributed to other sessions.
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
            >
              Close
            </button>
          </div>
        )}

        {/* ─── IMPACT STEP ───────────────────────────────── */}
        {step === "impact" && (
          <>
            {/* Demo scenarios dropdown */}
            {demoScenarios.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Load demo scenario
                </label>
                <select
                  value={demoScenario}
                  onChange={(e) => {
                    setDemoScenario(e.target.value);
                    onSetCompare(null);
                  }}
                  className="w-full border border-gray-300 rounded text-sm p-2"
                >
                  <option value="">Current selection: {session?.code}</option>
                  {demoScenarios.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {loading ? (
              <div className="text-sm text-gray-500">Analyzing impact...</div>
            ) : impact ? (
              <>
                {/* Session info */}
                <div className="bg-gray-50 rounded p-3">
                  <div className="font-mono font-bold">{session?.code}</div>
                  <div className="text-sm text-gray-600">{session?.title}</div>
                </div>

                {/* Coverage impact */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Coverage Impact</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="text-xs text-gray-500">Before</div>
                      <div className="font-bold">
                        {impact.healthBefore.fullyCovered} / {impact.healthBefore.totalSkills}
                      </div>
                      <div className="text-xs text-gray-500">fully covered</div>
                    </div>
                    <div className="bg-red-50 p-2 rounded">
                      <div className="text-xs text-gray-500">After</div>
                      <div className="font-bold text-red-700">
                        {impact.healthAfter.fullyCovered} / {impact.healthAfter.totalSkills}
                      </div>
                      <div className="text-xs text-gray-500">fully covered</div>
                    </div>
                  </div>
                </div>

                {/* At-risk skills */}
                {atRiskSkills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">
                      At-Risk Skills ({atRiskSkills.length} unique)
                    </h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {atRiskSkills.map((skill, i) => (
                        <div
                          key={i}
                          className="text-xs p-2 rounded border bg-red-50 border-red-200"
                        >
                          <span className="font-mono font-medium">{skill.skillCode}</span>
                          <span className="ml-1 text-gray-500">({skill.level})</span>
                          <span className="ml-1 text-red-600 font-medium">UNIQUE</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Non-at-risk skills (collapsible) */}
                {nonAtRiskSkills.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowNonAtRisk(!showNonAtRisk)}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <span>{showNonAtRisk ? "\u25BC" : "\u25B6"}</span>
                      Also covered elsewhere ({nonAtRiskSkills.length} -- no action needed)
                    </button>
                    {showNonAtRisk && (
                      <div className="space-y-1 mt-1 max-h-32 overflow-y-auto">
                        {nonAtRiskSkills.map((skill, i) => (
                          <div
                            key={i}
                            className="text-xs p-2 rounded border bg-yellow-50 border-yellow-200"
                          >
                            <span className="font-mono font-medium">{skill.skillCode}</span>
                            <span className="ml-1 text-gray-500">({skill.level})</span>
                            {skill.otherSessions.length > 0 && (
                              <div className="text-gray-500 mt-1">
                                Also in: {skill.otherSessions.map((s) => s.sessionCode).join(", ")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* New violations */}
                {impact.newViolations.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <h3 className="text-sm font-medium text-red-800 mb-1">
                      New Ordering Violations
                    </h3>
                    {impact.newViolations.map((v, i) => (
                      <div key={i} className="text-xs text-red-700">
                        {v.message}
                      </div>
                    ))}
                  </div>
                )}

                {/* Compare section */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Compare with another session</h3>
                  <select
                    value={compareSessionId || ""}
                    onChange={(e) => onSetCompare(e.target.value || null)}
                    className="w-full border border-gray-300 rounded text-sm p-2"
                  >
                    <option value="">Select a session to compare...</option>
                    {sessions
                      .filter(
                        (s) =>
                          s.status === "scheduled" &&
                          s.id !== activeSessionId,
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code}: {s.title} ({s.coverages?.length ?? 0} skills)
                        </option>
                      ))}
                  </select>
                </div>

                {/* Side-by-side comparison */}
                {comparison && (
                  <div className="border border-gray-200 rounded">
                    <div className="grid grid-cols-2 text-xs">
                      <div className="p-3 border-r border-gray-200">
                        <div className="font-bold mb-1">
                          {sessions.find((s) => s.id === comparison.scenarioA.canceledSessionId)?.code}
                        </div>
                        <div>At-risk (unique): {comparison.scenarioA.atRiskSkills.filter((s) => s.uniqueCoverage).length}</div>
                        <div>Fully covered: {comparison.scenarioA.healthBefore.fullyCovered} &rarr; {comparison.scenarioA.healthAfter.fullyCovered}</div>
                        <div>New violations: {comparison.scenarioA.newViolations.length}</div>
                      </div>
                      <div className="p-3">
                        <div className="font-bold mb-1">
                          {sessions.find((s) => s.id === comparison.scenarioB.canceledSessionId)?.code}
                        </div>
                        <div>At-risk (unique): {comparison.scenarioB.atRiskSkills.filter((s) => s.uniqueCoverage).length}</div>
                        <div>Fully covered: {comparison.scenarioB.healthBefore.fullyCovered} &rarr; {comparison.scenarioB.healthAfter.fullyCovered}</div>
                        <div>New violations: {comparison.scenarioB.newViolations.length}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="space-y-2">
                  {/* Cancel reason */}
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancellation (optional)"
                    rows={2}
                    className="w-full border border-gray-300 rounded p-2 text-sm"
                  />

                  {atRiskSkills.length > 0 ? (
                    <button
                      onClick={initRedistributions}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
                    >
                      Cancel &amp; Redistribute
                    </button>
                  ) : (
                    <button
                      onClick={cancelWithoutRedistributing}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
                    >
                      Apply Cancellation
                    </button>
                  )}

                  {atRiskSkills.length > 0 && (
                    <button
                      onClick={cancelWithoutRedistributing}
                      className="w-full text-center text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Cancel Without Redistributing
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">No impact data available.</div>
            )}
          </>
        )}

        {/* ─── REDISTRIBUTE STEP ─────────────────────────── */}
        {step === "redistribute" && impact && (
          <>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-sm">
                Canceling <span className="font-mono font-bold">{session?.code}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Assign each at-risk skill to another session.
              </div>
            </div>

            <button
              onClick={suggestRedistribution}
              disabled={suggesting}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {suggesting ? "Suggesting..." : "Suggest Redistribution (AI)"}
            </button>

            <div className="space-y-3">
              {redistributions.map((r, i) => {
                const canceledSession = sessions.find((s) => s.id === activeSessionId);
                const canceledModuleId = canceledSession?.module?.id;

                // Split targets into same-module and other-module
                const sameModule = eligibleTargets.filter(
                  (s) => s.module?.id === canceledModuleId,
                );
                const otherModule = eligibleTargets.filter(
                  (s) => s.module?.id !== canceledModuleId,
                );

                return (
                  <div key={i} className="border border-gray-200 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm font-medium">{r.skillCode}</span>
                      <span
                        className={`px-1.5 rounded text-[10px] ${
                          r.level === "introduced"
                            ? "bg-blue-100 text-blue-700"
                            : r.level === "practiced"
                              ? "bg-green-100 text-green-700"
                              : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {r.level}
                      </span>
                    </div>
                    <select
                      value={r.targetSessionId}
                      onChange={(e) => updateRedistribution(i, e.target.value)}
                      className="w-full border border-gray-300 rounded text-sm p-2"
                    >
                      <option value="">Select target session...</option>
                      {sameModule.length > 0 && (
                        <optgroup label="Same module">
                          {sameModule.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code}: {s.title}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherModule.length > 0 && (
                        <optgroup label="Other modules">
                          {otherModule.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code}: {s.title} ({s.module?.code})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Non-at-risk reference */}
            {nonAtRiskSkills.length > 0 && (
              <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                {nonAtRiskSkills.length} other skill(s) are covered elsewhere and don&apos;t need redistribution.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={validateRedistributions}
                disabled={validating || redistributions.every((r) => !r.targetSessionId)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium disabled:opacity-50"
              >
                {validating ? "Validating..." : "Validate"}
              </button>
              <button
                onClick={() => {
                  setStep("impact");
                  setValidationResult(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
              >
                Back
              </button>
            </div>

            {/* Validation results */}
            {validationResult && (
              <div
                className={`rounded p-3 border ${
                  validationResult.valid
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                {validationResult.valid ? (
                  <>
                    <div className="text-sm font-medium text-green-800">
                      No ordering violations. Safe to proceed.
                    </div>
                    <button
                      onClick={confirmCancellation}
                      className="mt-2 w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
                    >
                      Confirm Cancellation
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-medium text-red-800 mb-1">
                      Ordering Violations Detected
                    </div>
                    {validationResult.violations.map((v, i) => (
                      <div key={i} className="text-xs text-red-700">
                        {v.message}
                      </div>
                    ))}
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => confirmCancellation(true)}
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
                      >
                        Proceed Anyway
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              onClick={cancelWithoutRedistributing}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Cancel Without Redistributing
            </button>
          </>
        )}
      </div>
    </div>
  );
}
