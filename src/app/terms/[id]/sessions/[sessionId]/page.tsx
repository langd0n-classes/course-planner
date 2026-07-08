"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  api,
  type Session,
  type Coverage,
  type Assessment,
} from "@/lib/api-client";
import Breadcrumbs from "@/components/Breadcrumbs";
import EditableText from "@/components/EditableText";
import CoverageBadge, { CoverageLevelLabel } from "@/components/CoverageBadge";
import { SessionTypeBadge, SessionStatusBadge } from "@/components/StatusBadge";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { useToast } from "@/components/Toast";
import WhatIfPanel from "@/components/WhatIfPanel";

export default function SessionDetailPage() {
  const { id: termId, sessionId } = useParams<{ id: string; sessionId: string }>();
  const { showToast } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [termName, setTermName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showWhatIf, setShowWhatIf] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, term, sessions] = await Promise.all([
      api.getSession(sessionId),
      api.getTerm(termId),
      api.getSessions({ termId }),
    ]);
    setSession(s);
    setTermName(term.name);
    setAllSessions(sessions);
    setLoading(false);
  }, [sessionId, termId]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateField(field: string, value: unknown) {
    try {
      await api.updateSession(sessionId, { [field]: value });
      showToast("Session updated");
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  const handleApplyCancel = useCallback(
    async (
      sid: string,
      reason: string,
      redistributions: Array<{ skillId: string; level: string; targetSessionId: string }>,
      force?: boolean,
    ) => {
      try {
        await api.cancelSession(sid, { reason, redistributions, force });
        load();
      } catch (err) {
        console.error("Cancel error:", err);
      }
    },
    [load],
  );

  if (loading) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: "Terms", href: "/" },
            { label: "...", href: `/terms/${termId}` },
            { label: "Session" },
          ]}
        />
        <CardSkeleton />
      </div>
    );
  }

  if (!session) {
    return <p className="text-gray-500">Session not found.</p>;
  }

  const coverages = session.coverages ?? [];
  const assessments = (session as Session & { assessments?: Assessment[] }).assessments ?? [];

  // Identify redistributed coverages (audit trail)
  const redistributedCoverages = coverages.filter((c) => c.redistributedFrom);
  const originalCoverages = coverages.filter((c) => !c.redistributedFrom);

  return (
    <div className={showWhatIf ? "mr-[420px] transition-all" : "transition-all"}>
      <Breadcrumbs
        items={[
          { label: "Terms", href: "/" },
          { label: termName, href: `/terms/${termId}` },
          ...(session.module
            ? [
                {
                  label: `${session.module.code}: ${session.module.title}`,
                  href: `/terms/${termId}/modules/${session.module.id}`,
                },
              ]
            : []),
          { label: `${session.code}: ${session.title}` },
        ]}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <SessionTypeBadge type={session.sessionType} />
        <SessionStatusBadge status={session.status} />
        <h1 className={`text-2xl font-bold ${session.status === "canceled" ? "line-through text-gray-400" : ""}`}>
          {session.code}: {session.title}
        </h1>
        {session.date && (
          <span className="text-sm text-gray-400">
            {new Date(session.date).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Cancellation notice */}
      {session.status === "canceled" && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
          <p className="text-sm font-medium text-red-700">This session was canceled</p>
          {session.canceledReason && (
            <p className="text-sm text-red-600 mt-1">Reason: {session.canceledReason}</p>
          )}
          {session.canceledAt && (
            <p className="text-xs text-red-400 mt-1">
              Canceled on: {new Date(session.canceledAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* Description */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Description</h2>
        <EditableText
          value={session.description ?? ""}
          onSave={(val) => updateField("description", val)}
          placeholder="Click to add a description..."
          multiline
          className="bg-white border rounded p-3"
        />
      </section>

      {/* Coverage */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">
          Coverage ({originalCoverages.length} entries)
        </h2>
        {originalCoverages.length === 0 ? (
          <div className="bg-white border rounded p-4 text-center text-sm text-gray-500">
            No coverage entries for this session.{" "}
            <Link href={`/terms/${termId}/coverage`} className="text-blue-600 hover:underline">
              Add coverage in the matrix
            </Link>
          </div>
        ) : (
          <div className="bg-white border rounded divide-y">
            {originalCoverages.map((cov) => (
              <div key={cov.id} className="px-4 py-2 flex items-center gap-3">
                <CoverageBadge level={cov.level} size="md" />
                {cov.skill && (
                  <Link
                    href={`/terms/${termId}/skills/${cov.skill.id}`}
                    className="hover:underline"
                  >
                    <span className="font-medium text-sm">{cov.skill.code}</span>{" "}
                    <span className="text-sm text-gray-500">{cov.skill.description}</span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Redistribution audit trail */}
      {redistributedCoverages.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">
            Redistributed Coverage ({redistributedCoverages.length})
          </h2>
          <div className="bg-orange-50 border border-orange-200 rounded divide-y divide-orange-200">
            {redistributedCoverages.map((cov) => (
              <div key={cov.id} className="px-4 py-2 flex items-center gap-3">
                <CoverageLevelLabel level={cov.level} />
                {cov.skill && (
                  <span className="text-sm">
                    <span className="font-medium">{cov.skill.code}</span>{" "}
                    <span className="text-gray-500">{cov.skill.description}</span>
                  </span>
                )}
                <span className="text-xs text-orange-600">redistributed here</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Assessments */}
      {assessments.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Linked Assessments</h2>
          <div className="bg-white border rounded divide-y">
            {assessments.map((a: Assessment) => (
              <div key={a.id} className="px-4 py-2">
                <span className="font-medium text-sm">{a.code}: {a.title}</span>
                <span className="text-xs text-gray-400 ml-2">{a.assessmentType}</span>
                {a.dueDate && (
                  <span className="text-xs text-gray-400 ml-2">
                    Due: {new Date(a.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Notes</h2>
        <EditableText
          value={session.notes ?? ""}
          onSave={(val) => updateField("notes", val)}
          placeholder="Click to add notes..."
          multiline
          className="bg-white border rounded p-3"
        />
      </section>

      {/* Actions */}
      {session.status === "scheduled" && (
        <div className="mb-6">
          <button
            onClick={() => setShowWhatIf(true)}
            className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded text-sm hover:bg-red-100"
          >
            What if I cancel this session?
          </button>
        </div>
      )}

      {/* What-If Panel */}
      {showWhatIf && (
        <WhatIfPanel
          sessionId={sessionId}
          termId={termId}
          sessions={allSessions}
          onClose={() => setShowWhatIf(false)}
          onApplyCancel={handleApplyCancel}
        />
      )}
    </div>
  );
}
