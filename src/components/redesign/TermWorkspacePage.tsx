"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  CalendarSlotDto,
  CreateDeliveredRevisionRequest,
  Id,
  LearningModuleVersionDto,
  PlannedDeliveredDiffResponse,
  SessionDto,
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

type CalendarRow = { slot: CalendarSlotDto; session: SessionDto | null };

function buildCalendarRows(calendarSlots: CalendarSlotDto[], sessions: SessionDto[]): CalendarRow[] {
  const sessionsByDate = new Map<string, SessionDto>();
  for (const session of sessions) {
    if (session.date) sessionsByDate.set(session.date, session);
  }
  return calendarSlots.slice(0, 20).map((slot) => ({
    slot,
    session: sessionsByDate.get(slot.date) ?? null,
  }));
}

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
          throw new Error(`Planned version ${termLearningModule.learningModuleVersionId} is missing.`);
        }
        const deliveredVersion = termLearningModule.deliveredLearningModuleVersionId
          ? (versionMap.get(termLearningModule.deliveredLearningModuleVersionId) ?? null)
          : null;
        return {
          termLearningModule,
          plannedVersion,
          deliveredVersion,
          diff: diffs[index]!,
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

  const calendarRows = useMemo(
    () => buildCalendarRows(calendarSlots, sessions),
    [calendarSlots, sessions],
  );

  const classDays = calendarSlots.filter((s) => s.slotType === "class_day");

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
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-40 rounded-3xl bg-slate-100" />
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="h-48 rounded-2xl bg-slate-100" />
          <div className="h-48 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm font-medium text-rose-800">Failed to load term workspace</p>
        <p className="mt-1 text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  if (!term || !course) {
    return <p className="text-sm text-rose-700">Term not found.</p>;
  }

  const transition = TRANSITIONS[term.status];
  const unscheduledSessions = sessions.filter((s) => !s.date && s.status === "scheduled");
  const canceledSessions = sessions.filter((s) => s.status === "canceled");

  return (
    <div className="space-y-8">
      {/* Term header */}
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href={`/courses/${term.courseId}`} className="text-sm font-medium text-sky-700 hover:text-sky-800">
          ← {course.number} · {course.title}
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{term.name}</h1>
            <p className="mt-1.5 text-base text-slate-600">
              {term.code} · {term.startDate} – {term.endDate}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LifecycleBadge status={term.status} />
            {transition ? (
              <button
                type="button"
                onClick={handleTransition}
                disabled={transitionBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
              >
                {transitionBusy ? "Updating..." : transition.label}
              </button>
            ) : null}
          </div>
        </div>

        {/* Capacity summary row */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Class days</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{classDays.length}</p>
          </div>
          <div className={`rounded-2xl p-4 ${sessions.length === 0 ? "bg-amber-50" : "bg-slate-50"}`}>
            <p className="text-xs uppercase tracking-wide text-slate-500">Sessions</p>
            <p className={`mt-1 text-2xl font-semibold ${sessions.length === 0 ? "text-amber-700" : "text-slate-900"}`}>
              {sessions.length}
            </p>
          </div>
          <div className={`rounded-2xl p-4 ${(coverageHealth?.uncovered ?? 0) > 0 ? "bg-amber-50" : "bg-slate-50"}`}>
            <p className="text-xs uppercase tracking-wide text-slate-500">Uncovered topics</p>
            <p className={`mt-1 text-2xl font-semibold ${(coverageHealth?.uncovered ?? 0) > 0 ? "text-amber-700" : "text-slate-900"}`}>
              {coverageHealth?.uncovered ?? 0}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Assessments</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{assessments.length}</p>
          </div>
        </div>
      </section>

      {/* Planning gaps + coverage health */}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Planning gaps</h2>
          <div className="mt-4 space-y-3">
            {planningGaps.unplannedClassDays.length === 0 && planningGaps.unscheduledSessions.length === 0 ? (
              <p className="text-sm text-slate-500">No date gaps visible right now.</p>
            ) : null}
            {planningGaps.unplannedClassDays.length > 0 ? (
              <GapNotice title={`${planningGaps.unplannedClassDays.length} class day(s) have no session assigned.`}>
                {planningGaps.unplannedClassDays.slice(0, 5).map((slot) => slot.date).join(", ")}
                {planningGaps.unplannedClassDays.length > 5 ? ` +${planningGaps.unplannedClassDays.length - 5} more` : ""}
              </GapNotice>
            ) : null}
            {planningGaps.unscheduledSessions.length > 0 ? (
              <GapNotice title={`${planningGaps.unscheduledSessions.length} session(s) have no date.`}>
                {planningGaps.unscheduledSessions.slice(0, 5).map((session) => session.code).join(", ")}
                {planningGaps.unscheduledSessions.length > 5 ? ` +${planningGaps.unscheduledSessions.length - 5} more` : ""}
              </GapNotice>
            ) : null}
            {canceledSessions.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <span className="font-medium">{canceledSessions.length} session(s) canceled.</span>{" "}
                Coverage for these dates may need redistribution.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Coverage health</h2>
          {coverageHealth ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Fully covered</dt>
                <dd className="mt-0.5 text-xl font-semibold text-slate-900">{coverageHealth.fullyCovered}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Partially covered</dt>
                <dd className="mt-0.5 text-xl font-semibold text-slate-900">{coverageHealth.partiallyCovered}</dd>
              </div>
              <div className={`rounded-xl p-3 ${coverageHealth.uncovered > 0 ? "bg-amber-50" : "bg-slate-50"}`}>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Uncovered</dt>
                <dd className={`mt-0.5 text-xl font-semibold ${coverageHealth.uncovered > 0 ? "text-amber-700" : "text-slate-900"}`}>
                  {coverageHealth.uncovered}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Total tracked</dt>
                <dd className="mt-0.5 text-xl font-semibold text-slate-900">{coverageHealth.totalTopics}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Coverage data not available.</p>
          )}
        </div>
      </section>

      {/* Calendar timeline */}
      {calendarSlots.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Calendar timeline</h2>
            <span className="text-sm text-slate-500">
              {classDays.length} class day{classDays.length === 1 ? "" : "s"} · showing first {Math.min(calendarRows.length, 20)}
            </span>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {calendarRows.map(({ slot, session }) => {
              const isClassDay = slot.slotType === "class_day";
              const hasSession = !!session;
              const isGap = isClassDay && !hasSession;
              return (
                <div
                  key={slot.id}
                  className={`flex items-start gap-4 py-2.5 ${isGap ? "opacity-70" : ""}`}
                >
                  <span className={`w-24 shrink-0 text-sm tabular-nums ${isGap ? "text-amber-700" : "text-slate-600"}`}>
                    {slot.date}
                  </span>
                  <span
                    className={`w-20 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-medium ${
                      slot.slotType === "class_day"
                        ? "bg-sky-50 text-sky-800"
                        : slot.slotType === "holiday"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {slot.slotType === "class_day" ? "class" : slot.slotType.replace("_", " ")}
                  </span>
                  <div className="min-w-0 flex-1">
                    {session ? (
                      <p className="truncate text-sm font-medium text-slate-900">
                        {session.code}: {session.title}
                        {session.status === "canceled" ? (
                          <span className="ml-2 text-xs font-normal text-rose-600">canceled</span>
                        ) : null}
                      </p>
                    ) : isClassDay ? (
                      <p className="text-sm text-amber-600">No session assigned</p>
                    ) : (
                      <p className="text-sm text-slate-400">{slot.label ?? "—"}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {classDays.length > 20 ? (
            <p className="mt-3 text-xs text-slate-500">
              {classDays.length - 20} more class days not shown.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Unscheduled sessions */}
      {unscheduledSessions.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Unscheduled sessions</h2>
          <p className="mt-1 text-sm text-slate-600">
            These sessions have no date assigned. Assign them to class days.
          </p>
          <ul className="mt-3 space-y-2">
            {unscheduledSessions.map((session) => (
              <li key={session.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2">
                <span className="text-sm font-medium text-slate-900">{session.code}:</span>
                <span className="text-sm text-slate-700">{session.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Assessments */}
      {assessments.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Assessments</h2>
          <div className="mt-4 space-y-2">
            {assessments.map((assessment) => (
              <div key={assessment.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{assessment.code}: {assessment.title}</p>
                  <p className="text-xs text-slate-500">{assessment.assessmentType}{assessment.dueDate ? ` · due ${assessment.dueDate}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Planned vs. delivered learning modules */}
      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Planned vs. delivered learning modules</h2>
          <p className="mt-1 text-sm text-slate-600">
            {term.status === "active"
              ? "Active terms can record delivery changes as immutable revisions."
              : term.status === "closed"
                ? "Closed terms show the delivered snapshot read-only."
                : "Planned terms have no delivered divergence yet."}
          </p>
        </div>

        {moduleWorkspaces.length === 0 ? (
          <GapNotice title="No learning modules adopted for this term yet.">
            Add learning modules from the course workspace, then adopt them for this term.
          </GapNotice>
        ) : null}

        {moduleWorkspaces.map((workspace) => {
          const isEditing = editingTermLearningModuleId === workspace.termLearningModule.id;
          const effectiveDeliveredVersion = workspace.deliveredVersion ?? workspace.plannedVersion;
          return (
            <article key={workspace.termLearningModule.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{workspace.plannedVersion.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Planned rev. {workspace.plannedVersion.revision}
                    {workspace.deliveredVersion
                      ? ` · delivered rev. ${workspace.deliveredVersion.revision}`
                      : " · no in-term revisions yet"}
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
                    {isEditing ? "Hide editor" : "Record delivery change"}
                  </button>
                ) : term.status === "closed" ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    Read-only snapshot
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-medium text-slate-700">Planned snapshot</p>
                  {workspace.plannedVersion.learningObjectives.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {workspace.plannedVersion.learningObjectives.map((obj) => (
                        <li key={obj}>{obj}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No learning objectives recorded.</p>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    {term.status === "closed" ? "Delivered snapshot" : "Current delivery snapshot"}
                  </p>
                  {effectiveDeliveredVersion.learningObjectives.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {effectiveDeliveredVersion.learningObjectives.map((obj) => (
                        <li key={obj}>{obj}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No learning objectives recorded.</p>
                  )}
                </div>
              </div>

              {workspace.diff.topicChanges.length > 0 ? (
                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-900">Planned vs. delivered diff</p>
                  <div className="mt-2 space-y-1.5">
                    {workspace.diff.topicChanges.map((change) => (
                      <div key={`${change.kind}-${change.topicId}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        {change.topicId === "__module_objectives__" ? (
                          <p className="text-slate-700">Learning objectives changed during delivery.</p>
                        ) : (
                          <p className="text-slate-700">
                            <span className="font-medium text-slate-900">
                              {topicVersionsById.get(change.deliveredTopicVersionId ?? change.plannedTopicVersionId ?? "")?.title ?? "Topic"}
                            </span>{" "}
                            {change.kind === "added"
                              ? `added at delivered position ${change.deliveredSequence}.`
                              : change.kind === "removed"
                                ? `removed from planned position ${change.plannedSequence}.`
                                : change.kind === "reordered"
                                  ? `moved from position ${change.plannedSequence} to ${change.deliveredSequence}.`
                                  : "changed."}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

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
