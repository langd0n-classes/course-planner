"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  CreateDeliveredRevisionRequest,
  Id,
  LearningModuleVersionDto,
  PlannedDeliveredDiffResponse,
  TermLifecycleTransition,
  TopicVersionDto,
} from "@/lib/redesign-contract";
import { deriveTermPlanningGaps } from "@/lib/redesign-workspace";
import DeliveredRevisionEditor from "./DeliveredRevisionEditor";
import GapNotice from "./GapNotice";
import LifecycleBadge from "./LifecycleBadge";

type Props = {
  termId: string;
};

type ModuleWorkspace = {
  termLearningModule: Awaited<ReturnType<typeof redesignApi.getTermLearningModule>>;
  plannedVersion: LearningModuleVersionDto;
  deliveredVersion: LearningModuleVersionDto | null;
  diff: PlannedDeliveredDiffResponse;
};

const TRANSITIONS: Record<
  "planned" | "active" | "closed",
  { label: string; transition: TermLifecycleTransition } | null
> = {
  planned: { label: "Activate term", transition: "activate" },
  active: { label: "Close term", transition: "close" },
  closed: { label: "Reopen term", transition: "reopen" },
};

export default function TermWorkspacePage({ termId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState<Awaited<ReturnType<typeof redesignApi.getTerm>> | null>(null);
  const [course, setCourse] = useState<Awaited<ReturnType<typeof redesignApi.getCourse>> | null>(null);
  const [moduleWorkspaces, setModuleWorkspaces] = useState<ModuleWorkspace[]>([]);
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof redesignApi.listTermSessions>>>([]);
  const [calendarSlots, setCalendarSlots] = useState<Awaited<ReturnType<typeof redesignApi.listCalendarSlots>>>([]);
  const [coverageHealth, setCoverageHealth] = useState<Awaited<ReturnType<typeof redesignApi.computeCoverageHealth>> | null>(null);
  const [assessments, setAssessments] = useState<Awaited<ReturnType<typeof redesignApi.listTermAssessments>>>([]);
  const [availableTopicVersions, setAvailableTopicVersions] = useState<TopicVersionDto[]>([]);
  const [topicVersionsById, setTopicVersionsById] = useState(new Map<Id, TopicVersionDto>());
  const [editingTermLearningModuleId, setEditingTermLearningModuleId] = useState<Id | null>(null);
  const [transitionBusy, setTransitionBusy] = useState(false);

  async function loadWorkspace() {
    setLoading(true);
    setError(null);
    try {
      const loadedTerm = await redesignApi.getTerm(termId);
      const [
        loadedCourse,
        loadedTermLearningModules,
        loadedSessions,
        loadedCalendarSlots,
        loadedCoverageHealth,
        loadedAssessments,
        loadedTopics,
      ] = await Promise.all([
        redesignApi.getCourse(loadedTerm.courseId),
        redesignApi.listTermLearningModules(termId),
        redesignApi.listTermSessions(termId),
        redesignApi.listCalendarSlots(termId),
        redesignApi.computeCoverageHealth(termId),
        redesignApi.listTermAssessments(termId),
        redesignApi.listTopics(loadedTerm.courseId),
      ]);

      const [moduleVersions, diffs, topicDetails] = await Promise.all([
        Promise.all(
          loadedTermLearningModules.map((termLearningModule) =>
            redesignApi.listLearningModuleVersions(termLearningModule.learningModuleId),
          ),
        ),
        Promise.all(
          loadedTermLearningModules.map((termLearningModule) =>
            redesignApi.getPlannedDeliveredDiff(termLearningModule.id),
          ),
        ),
        Promise.all(loadedTopics.map((topic) => redesignApi.getTopic(topic.id))),
      ]);

      const versionMap = new Map<Id, LearningModuleVersionDto>();
      const referencedTopicVersionIds = new Set<Id>();
      for (const versions of moduleVersions) {
        for (const version of versions) {
          versionMap.set(version.id, version);
          for (const topic of version.topics) {
            referencedTopicVersionIds.add(topic.topicVersionId);
          }
        }
      }

      const workspaceRows: ModuleWorkspace[] = loadedTermLearningModules.map((termLearningModule, index) => {
        const plannedVersion = versionMap.get(termLearningModule.learningModuleVersionId);
        if (!plannedVersion) {
          throw new Error(`Planned version ${termLearningModule.learningModuleVersionId} is missing from the frozen mock.`);
        }
        const deliveredVersion = termLearningModule.deliveredLearningModuleVersionId
          ? (versionMap.get(termLearningModule.deliveredLearningModuleVersionId) ?? null)
          : null;
        return {
          termLearningModule,
          plannedVersion,
          deliveredVersion,
          diff: diffs[index],
        };
      });

      const currentTopicVersions: TopicVersionDto[] = [];
      for (const detail of topicDetails) {
        if (detail.currentVersion) currentTopicVersions.push(detail.currentVersion);
      }
      const resolvedTopicVersions = await Promise.all(
        [...referencedTopicVersionIds].map((topicVersionId) => redesignApi.getTopicVersion(topicVersionId)),
      );
      const nextTopicVersionsById = new Map<Id, TopicVersionDto>();
      for (const topicVersion of resolvedTopicVersions) {
        nextTopicVersionsById.set(topicVersion.id, topicVersion);
      }

      setTerm(loadedTerm);
      setCourse(loadedCourse);
      setModuleWorkspaces(workspaceRows);
      setSessions(loadedSessions);
      setCalendarSlots(loadedCalendarSlots);
      setCoverageHealth(loadedCoverageHealth);
      setAssessments(loadedAssessments);
      setAvailableTopicVersions(
        currentTopicVersions.slice().sort((left, right) => left.title.localeCompare(right.title)),
      );
      setTopicVersionsById(nextTopicVersionsById);
      setEditingTermLearningModuleId((current) =>
        current && workspaceRows.some((row) => row.termLearningModule.id === current) ? current : null,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load term workspace.");
    } finally {
      setLoading(false);
    }
  }

  const loadFromEffect = useEffectEvent(loadWorkspace);

  useEffect(() => {
    void loadFromEffect();
  }, [termId]);

  const planningGaps = useMemo(
    () => deriveTermPlanningGaps({ calendarSlots, sessions }),
    [calendarSlots, sessions],
  );

  async function handleTransition() {
    if (!term) return;
    const next = TRANSITIONS[term.status];
    if (!next) return;
    setTransitionBusy(true);
    try {
      await redesignApi.transitionTerm(term.id, next.transition, term.status);
      await loadWorkspace();
    } finally {
      setTransitionBusy(false);
    }
  }

  async function handleSaveDeliveredRevision(
    termLearningModuleId: Id,
    request: CreateDeliveredRevisionRequest,
  ) {
    await redesignApi.createDeliveredRevision(termLearningModuleId, request);
    setEditingTermLearningModuleId(null);
    await loadWorkspace();
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading term workspace...</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }

  if (!term || !course) {
    return <p className="text-sm text-rose-700">Term not found.</p>;
  }

  const transition = TRANSITIONS[term.status];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href={`/courses/${term.courseId}`} className="text-sm font-medium text-sky-700">
          Back to course workspace
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              {course.number} · {course.title}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">{term.name}</h1>
            <p className="mt-2 text-base text-slate-600">
              {term.code} · {term.startDate} to {term.endDate}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LifecycleBadge status={term.status} />
            {transition ? (
              <button
                type="button"
                onClick={handleTransition}
                disabled={transitionBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                {transitionBusy ? "Updating..." : transition.label}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sessions</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{sessions.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Class days</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {calendarSlots.filter((slot) => slot.slotType === "class_day").length}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Uncovered topics</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{coverageHealth?.uncovered ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Assessments</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{assessments.length}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Planning gaps</h2>
          <div className="mt-4 space-y-4">
            {planningGaps.unplannedClassDays.length === 0 && planningGaps.unscheduledSessions.length === 0 ? (
              <p className="text-sm text-slate-600">No date gaps are visible right now.</p>
            ) : null}
            {planningGaps.unplannedClassDays.length > 0 ? (
              <GapNotice title={`${planningGaps.unplannedClassDays.length} class day(s) have no session assigned.`}>
                {planningGaps.unplannedClassDays.map((slot) => slot.date).join(", ")}
              </GapNotice>
            ) : null}
            {planningGaps.unscheduledSessions.length > 0 ? (
              <GapNotice title={`${planningGaps.unscheduledSessions.length} session(s) still have no date.`}>
                {planningGaps.unscheduledSessions.map((session) => session.code).join(", ")}
              </GapNotice>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Coverage health</h2>
          {coverageHealth ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Fully covered</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">{coverageHealth.fullyCovered}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Partially covered</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">{coverageHealth.partiallyCovered}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Uncovered</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">{coverageHealth.uncovered}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Total tracked topics</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">{coverageHealth.totalTopics}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Planned vs. delivered learning modules</h2>
          <p className="mt-1 text-sm text-slate-600">
            Active terms can record delivery changes as immutable revisions. Closed terms show the delivered snapshot
            read-only.
          </p>
        </div>

        {moduleWorkspaces.map((workspace) => {
          const isEditing = editingTermLearningModuleId === workspace.termLearningModule.id;
          const effectiveDeliveredVersion = workspace.deliveredVersion ?? workspace.plannedVersion;
          return (
            <article key={workspace.termLearningModule.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{workspace.plannedVersion.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Planned revision {workspace.plannedVersion.revision}
                    {workspace.deliveredVersion
                      ? ` · delivered revision ${workspace.deliveredVersion.revision}`
                      : " · no delivered divergence recorded"}
                  </p>
                </div>
                {term.status === "active" ? (
                  <button
                    type="button"
                    onClick={() =>
                      setEditingTermLearningModuleId((current) =>
                        current === workspace.termLearningModule.id ? null : workspace.termLearningModule.id,
                      )
                    }
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    {isEditing ? "Hide editor" : "Edit delivered version"}
                  </button>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    Read-only snapshot
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">Planned snapshot</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {workspace.plannedVersion.learningObjectives.map((objective) => (
                      <li key={objective}>{objective}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">
                    {term.status === "closed" ? "Delivered snapshot" : "Current delivery snapshot"}
                  </p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {effectiveDeliveredVersion.learningObjectives.map((objective) => (
                      <li key={objective}>{objective}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                <p className="font-medium text-slate-900">Planned vs. delivered diff</p>
                {workspace.diff.topicChanges.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">No topic-level divergence recorded.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {workspace.diff.topicChanges.map((change) => (
                      <div key={`${change.kind}-${change.topicId}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        {change.topicId === "__module_objectives__" ? (
                          <p className="text-slate-700">Learning objectives changed during delivery.</p>
                        ) : (
                          <p className="text-slate-700">
                            <span className="font-medium text-slate-900">
                              {topicVersionsById.get(change.deliveredTopicVersionId ?? change.plannedTopicVersionId ?? "")?.title ??
                                "Topic"}
                            </span>{" "}
                            {change.kind === "added"
                              ? `Added topic at delivered position ${change.deliveredSequence}.`
                              : change.kind === "removed"
                                ? `Removed planned topic from position ${change.plannedSequence}.`
                                : change.kind === "reordered"
                                  ? `Moved topic from ${change.plannedSequence} to ${change.deliveredSequence}.`
                                  : "Changed topic."}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {term.status === "active" && isEditing ? (
                <div className="mt-5">
                  <DeliveredRevisionEditor
                    plannedVersion={workspace.plannedVersion}
                    deliveredVersion={workspace.deliveredVersion}
                    availableTopicVersions={availableTopicVersions}
                    onCancel={() => setEditingTermLearningModuleId(null)}
                    onSave={(request) => handleSaveDeliveredRevision(workspace.termLearningModule.id, request)}
                  />
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
