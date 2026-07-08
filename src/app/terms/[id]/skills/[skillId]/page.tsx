"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  api,
  type Skill,
  type Coverage,
  type Assessment,
} from "@/lib/api-client";
import Breadcrumbs from "@/components/Breadcrumbs";
import CoverageBadge from "@/components/CoverageBadge";
import { SessionTypeBadge } from "@/components/StatusBadge";
import { CardSkeleton } from "@/components/LoadingSkeleton";

export default function SkillDetailPage() {
  const { id: termId, skillId } = useParams<{ id: string; skillId: string }>();

  const [skill, setSkill] = useState<Skill | null>(null);
  const [termName, setTermName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, term] = await Promise.all([
      api.getSkill(skillId),
      api.getTerm(termId),
    ]);
    setSkill(s);
    setTermName(term.name);
    setLoading(false);
  }, [skillId, termId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: "Terms", href: "/" },
            { label: "...", href: `/terms/${termId}` },
            { label: "Skill" },
          ]}
        />
        <CardSkeleton />
      </div>
    );
  }

  if (!skill) {
    return <p className="text-gray-500">Skill not found.</p>;
  }

  const coverages = skill.coverages ?? [];
  const assessmentSkills = skill.assessmentSkills ?? [];

  // Organize coverages by level for gap detection
  const hasIntroduced = coverages.some((c) => c.level === "introduced");
  const hasPracticed = coverages.some((c) => c.level === "practiced");
  const hasAssessed = coverages.some((c) => c.level === "assessed");
  const isFullyCovered = hasIntroduced && hasPracticed && hasAssessed;

  // Sort coverages chronologically (by session date or module/session sequence)
  const sortedCoverages = [...coverages].sort((a, b) => {
    const aDate = a.session?.date ?? "";
    const bDate = b.session?.date ?? "";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return (a.session?.sequence ?? 0) - (b.session?.sequence ?? 0);
  });

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Terms", href: "/" },
          { label: termName, href: `/terms/${termId}` },
          { label: "Coverage Matrix", href: `/terms/${termId}/coverage` },
          { label: `${skill.code}: ${skill.description.slice(0, 40)}` },
        ]}
      />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">{skill.code}</h1>
        <p className="text-gray-600">{skill.description}</p>
        <p className="text-sm text-gray-400 mt-1">
          Category: {skill.category}
          {skill.isGlobal && " (global)"}
        </p>
      </div>

      {/* Coverage Status */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Coverage Status</h2>
        <div className={`rounded p-4 border ${isFullyCovered ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}`}>
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${hasIntroduced ? "bg-yellow-200 text-yellow-800" : "bg-gray-200 text-gray-400"}`}>
                I
              </span>
              <span>{hasIntroduced ? "Introduced" : "Not introduced"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${hasPracticed ? "bg-blue-200 text-blue-800" : "bg-gray-200 text-gray-400"}`}>
                P
              </span>
              <span>{hasPracticed ? "Practiced" : "Not practiced"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${hasAssessed ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-400"}`}>
                A
              </span>
              <span>{hasAssessed ? "Assessed" : "Not assessed"}</span>
            </div>
          </div>
          {!isFullyCovered && (
            <p className="text-sm text-yellow-700 mt-2">
              This skill has coverage gaps.
              {!hasIntroduced && " Missing introduction."}
              {!hasPracticed && " Missing practice."}
              {!hasAssessed && " Missing assessment."}
            </p>
          )}
        </div>
      </section>

      {/* Coverage Timeline */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Coverage Timeline</h2>
        {sortedCoverages.length === 0 ? (
          <div className="bg-white border rounded p-4 text-center text-sm text-gray-500">
            No coverage entries for this skill.{" "}
            <Link href={`/terms/${termId}/coverage`} className="text-blue-600 hover:underline">
              Add coverage in the matrix
            </Link>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline bar */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-3">
              {sortedCoverages.map((cov: Coverage) => (
                <div key={cov.id} className="flex items-start gap-3 pl-2">
                  <div className="relative z-10 mt-1">
                    <CoverageBadge level={cov.level} size="md" />
                  </div>
                  <div className="flex-1 bg-white border rounded p-3">
                    {cov.session && (
                      <div className="flex items-center gap-2">
                        <SessionTypeBadge type={cov.session.sessionType} />
                        <Link
                          href={`/terms/${termId}/sessions/${cov.session.id}`}
                          className="font-medium text-sm hover:underline"
                        >
                          {cov.session.code}: {cov.session.title}
                        </Link>
                        {cov.session.date && (
                          <span className="text-xs text-gray-400">
                            {new Date(cov.session.date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                    {cov.redistributedFrom && (
                      <p className="text-xs text-orange-500 mt-1">Redistributed from another session</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Assessment Links */}
      {assessmentSkills.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Assessments</h2>
          <div className="bg-white border rounded divide-y">
            {assessmentSkills.map((as: { assessment: Assessment }) => (
              <div key={as.assessment.id} className="px-4 py-2 flex items-center gap-3">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  as.assessment.assessmentType === "gaie" ? "bg-purple-100 text-purple-700" :
                  as.assessment.assessmentType === "exam" ? "bg-red-100 text-red-700" :
                  as.assessment.assessmentType === "project" ? "bg-green-100 text-green-700" :
                  "bg-blue-100 text-blue-700"
                }`}>
                  {as.assessment.assessmentType}
                </span>
                <span className="font-medium text-sm">{as.assessment.code}: {as.assessment.title}</span>
                {as.assessment.dueDate && (
                  <span className="text-xs text-gray-400">
                    Due: {new Date(as.assessment.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
