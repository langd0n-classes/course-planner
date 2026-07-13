"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  CalendarSlotDto,
  CreateDeliveredRevisionRequest,
  Id,
  LearningModuleDto,
  LearningModuleVersionDto,
  PlannedDeliveredDiffResponse,
  SessionDto,
  TermLifecycleTransition,
  TopicVersionDto,
} from "@/lib/redesign-contract";
import { buildTermCalendarTimeline, deriveTermPlanningGaps } from "@/lib/redesign-workspace";
import {
  capacityBadgeClass,
  formatCapacitySourceLabel,
  formatInstructionalCapacityLabel,
  isCapacityAdvisory,
} from "./CalendarCapacityPresentation";
import AdoptLearningModulePanel from "./AdoptLearningModulePanel";
import DeliveredRevisionEditor from "./DeliveredRevisionEditor";
import GapNotice from "./GapNotice";
import LifecycleBadge from "./LifecycleBadge";
import LifecycleConfirmPanel from "./LifecycleConfirmPanel";

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

const TODAY_SIGNAL_COPY = {
  no_class_days: "No class days have been materialized yet.",
  before_term: "Today is before the first class day in this term.",
  today_class_day: "Today is a scheduled class day in this term.",
  between_class_days: "Today falls between scheduled class days.",
  after_term: "Today is after the last class day in this term.",
} as const;

function formatSlotTypeLabel(slotType: CalendarSlotDto["slotType"]) {
  switch (slotType) {
    case "class_day":
      return "Class day";
    case "holiday":
      return "Holiday";
    case "finals":
      return "Finals";
    case "break_day":
      return "Break day";
  }
}

function formatInstructionalModeLabel(mode: SessionDto["instructionalMode"]) {
  switch (mode) {
    case "standard":
      return "Standard";
    case "recovery":
      return "Recovery";
    case "review":
      return "Review";
    case "buffer":
      return "Buffer";
    case "assessment":
      return "Assessment";
    case "other":
      return "Other";
  }
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function TermWorkspacePage({ termId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState<Awaited<ReturnType<typeof redesignApi.getTerm>> | null>(null);
  const [course, setCourse] = useState<Awaited<ReturnType<typeof redesignApi.getCourse>> | null>(null);
  const [courseLearningModules, setCourseLearningModules] = useState<LearningModuleDto[]>([]);
  const [currentVersionsByLearningModuleId, setCurrentVersionsByLearningModuleId] = useState(
    new Map<Id, LearningModuleVersionDto | null>(),
  );
  const [versionsByLearningModuleId, setVersionsByLearningModuleId] = useState(
    new Map<Id, LearningModuleVersionDto[]>(),
  );
  const [moduleWorkspaces, setModuleWorkspaces] = useState<ModuleWorkspace[]>([]);
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof redesignApi.listTermSessions>>>([]);
  const [calendarSlots, setCalendarSlots] = useState<Awaited<ReturnType<typeof redesignApi.listCalendarSlots>>>([]);
  const [coverageHealth, setCoverageHealth] = useState<Awaited<ReturnType<typeof redesignApi.computeCoverageHealth>> | null>(null);
  const [assessments, setAssessments] = useState<Awaited<ReturnType<typeof redesignApi.listTermAssessments>>>([]);
  const [availableTopicVersions, setAvailableTopicVersions] = useState<TopicVersionDto[]>([]);
  const [topicVersionsById, setTopicVersionsById] = useState(new Map<Id, TopicVersionDto>());
  const [editingTermLearningModuleId, setEditingTermLearningModuleId] = useState<Id | null>(null);
  const [showAdoptPanel, setShowAdoptPanel] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<TermLifecycleTransition | null>(null);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [showAllCalendarRows, setShowAllCalendarRows] = useState(false);
  const todayIso = useMemo(() => getTodayIsoDate(), []);

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
        loadedLearningModules,
        loadedTopics,
      ] = await Promise.all([
        redesignApi.getCourse(loadedTerm.courseId),
        redesignApi.listTermLearningModules(termId),
        redesignApi.listTermSessions(termId),
        redesignApi.listCalendarSlots(termId),
        redesignApi.computeCoverageHealth(termId),
        redesignApi.listTermAssessments(termId),
        redesignApi.listLearningModules(loadedTerm.courseId),
        redesignApi.listTopics(loadedTerm.courseId),
      ]);

      const [learningModuleDetails, moduleVersions, diffs, topicDetails] = await Promise.all([
        Promise.all(loadedLearningModules.map((learningModule) => redesignApi.getLearningModule(learningModule.id))),
        Promise.all(loadedLearningModules.map((learningModule) => redesignApi.listLearningModuleVersions(learningModule.id))),
        Promise.all(
          loadedTermLearningModules.map((termLearningModule) =>
            redesignApi.getPlannedDeliveredDiff(termLearningModule.id),
          ),
        ),
        Promise.all(loadedTopics.map((topic) => redesignApi.getTopic(topic.id))),
      ]);

      const nextCurrentLmVersions = new Map<Id, LearningModuleVersionDto | null>();
      for (const detail of learningModuleDetails) {
        nextCurrentLmVersions.set(detail.learningModule.id, detail.currentVersion);
      }

      const nextVersionsByLearningModuleId = new Map<Id, LearningModuleVersionDto[]>();
      const versionMap = new Map<Id, LearningModuleVersionDto>();
      const referencedTopicVersionIds = new Set<Id>();
      for (const versions of moduleVersions) {
        if (versions[0]) {
          nextVersionsByLearningModuleId.set(versions[0].learningModuleId, versions);
        }
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
      setCourseLearningModules(loadedLearningModules);
      setCurrentVersionsByLearningModuleId(nextCurrentLmVersions);
      setVersionsByLearningModuleId(nextVersionsByLearningModuleId);
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
      setPendingTransition(null);
      setTransitionError(null);
      setShowAdoptPanel((current) => current && loadedLearningModules.length > workspaceRows.length);
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

  const calendarTimeline = useMemo(
    () => buildTermCalendarTimeline({ calendarSlots, sessions, today: todayIso }),
    [calendarSlots, sessions, todayIso],
  );

  const visibleCalendarRows = showAllCalendarRows ? calendarTimeline.allRows : calendarTimeline.windowRows;
  const classDays = calendarSlots.filter((slot) => slot.slotType === "class_day");
  const existingLearningModuleIds = useMemo(
    () => new Set(moduleWorkspaces.map((workspace) => workspace.termLearningModule.learningModuleId)),
    [moduleWorkspaces],
  );
  const adoptableLearningModuleCount = courseLearningModules.filter(
    (learningModule) => !existingLearningModuleIds.has(learningModule.id),
  ).length;
  const nextLearningModuleSequence =
    moduleWorkspaces.reduce(
      (maxSequence, workspace) => Math.max(maxSequence, workspace.termLearningModule.sequence),
      0,
    ) + 1;

  async function handleConfirmTransition() {
    if (!term || !pendingTransition) return;
    setTransitionBusy(true);
    setTransitionError(null);
    try {
      await redesignApi.transitionTerm(term.id, pendingTransition, term.status);
      await loadWorkspace();
      setPendingTransition(null);
    } catch (caught) {
      setTransitionError(caught instanceof Error ? caught.message : "Unable to update term lifecycle.");
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
        <div className="h-40 rounded-xl bg-paper-inset" />
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="h-48 rounded-lg bg-paper-inset" />
          <div className="h-48 rounded-lg bg-paper-inset" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm font-medium text-rose-800">Failed to load term workspace</p>
        <p className="mt-1 text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  if (!term || !course) {
    return <p className="text-sm text-rose-700">Term not found.</p>;
  }

  const transition = TRANSITIONS[term.status];
  const unscheduledSessions = sessions.filter((session) => !session.date && session.status === "scheduled");
  const canceledSessions = sessions.filter((session) => session.status === "canceled");
  const attentionCount =
    planningGaps.unplannedClassDays.length + planningGaps.unscheduledSessions.length + canceledSessions.length;
  const workspaceContext =
    term.status === "active"
      ? {
          label: "Run workspace",
          description: "Use today’s calendar and open gaps to adapt delivery without erasing the original plan.",
        }
      : term.status === "closed"
        ? {
            label: "Record workspace",
            description: "Review the delivered record. Historical curriculum stays visible and read-only.",
          }
        : {
            label: "Plan workspace",
            description: "Shape dates and curriculum before activation; preview consequential changes before applying them.",
          };

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-line bg-surface p-8">
        <Link href={`/courses/${term.courseId}`} className="text-sm font-medium text-accent hover:text-accent-strong">
          ← {course.number} · {course.title}
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">{workspaceContext.label}</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{term.name}</h1>
            <p className="mt-1.5 font-mono text-base text-ink-muted">
              {term.code} · {term.startDate} – {term.endDate}
            </p>
            <p className="mt-2 max-w-3xl text-sm text-ink-muted">{workspaceContext.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LifecycleBadge status={term.status} />
            {transition ? (
              <button
                type="button"
                onClick={() => setPendingTransition(transition.transition)}
                disabled={transitionBusy}
                className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-soft disabled:opacity-60"
              >
                {transition.label}
              </button>
            ) : null}
          </div>
        </div>

        {pendingTransition ? (
          <div className="mt-5">
            <LifecycleConfirmPanel
              transition={pendingTransition}
              expectedStatus={term.status}
              busy={transitionBusy}
              onConfirm={handleConfirmTransition}
              onCancel={() => {
                if (transitionBusy) return;
                setPendingTransition(null);
                setTransitionError(null);
              }}
            />
            {transitionError ? <p className="mt-3 text-sm text-rose-700">{transitionError}</p> : null}
          </div>
        ) : null}

        <nav aria-label="Term workspace sections" className="mt-5 flex flex-wrap gap-2 border-t border-dashed border-line pt-4">
          <a href="#term-attention" className="rounded border border-line bg-surface-sunken px-3 py-1.5 text-sm font-medium text-ink-soft hover:border-line-strong">
            Attention{attentionCount > 0 ? ` · ${attentionCount}` : " · clear"}
          </a>
          <a href="#term-calendar" className="rounded border border-line bg-surface-sunken px-3 py-1.5 text-sm font-medium text-ink-soft hover:border-line-strong">
            Calendar
          </a>
          <a href="#term-curriculum" className="rounded border border-line bg-surface-sunken px-3 py-1.5 text-sm font-medium text-ink-soft hover:border-line-strong">
            Planned vs. delivered
          </a>
        </nav>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded border border-line bg-surface-sunken p-4">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Class days</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-ink">{classDays.length}</p>
          </div>
          <div className={`rounded border p-4 ${sessions.length === 0 ? "border-amber-200 bg-amber-50" : "border-line bg-surface-sunken"}`}>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Sessions</p>
            <p className={`mt-1 font-mono text-2xl font-semibold ${sessions.length === 0 ? "text-amber-800" : "text-ink"}`}>
              {sessions.length}
            </p>
          </div>
          <div className={`rounded border p-4 ${(coverageHealth?.uncovered ?? 0) > 0 ? "border-amber-200 bg-amber-50" : "border-line bg-surface-sunken"}`}>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Uncovered topics</p>
            <p className={`mt-1 font-mono text-2xl font-semibold ${(coverageHealth?.uncovered ?? 0) > 0 ? "text-amber-800" : "text-ink"}`}>
              {coverageHealth?.uncovered ?? 0}
            </p>
          </div>
          <div className="rounded border border-line bg-surface-sunken p-4">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Assessments</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-ink">{assessments.length}</p>
          </div>
        </div>
      </section>

      <section id="term-attention" className="scroll-mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Planning gaps</h2>
          <div className="mt-4 space-y-3">
            {planningGaps.unplannedClassDays.length === 0 && planningGaps.unscheduledSessions.length === 0 ? (
              <p className="text-sm text-ink-faint">No date gaps visible right now.</p>
            ) : null}
            {planningGaps.unplannedClassDays.length > 0 ? (
              <GapNotice title={`${planningGaps.unplannedClassDays.length} class day(s) have no active session assigned.`}>
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
              <div className="rounded border border-line bg-surface-sunken p-3 text-sm text-ink-soft">
                <span className="font-medium">{canceledSessions.length} session(s) canceled.</span>{" "}
                These dates remain visible as planning gaps until they are recovered.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Coverage health</h2>
          {coverageHealth ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-line bg-surface-sunken p-3">
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Fully covered</dt>
                <dd className="mt-0.5 font-mono text-xl font-semibold text-ink">{coverageHealth.fullyCovered}</dd>
              </div>
              <div className="rounded border border-line bg-surface-sunken p-3">
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Partially covered</dt>
                <dd className="mt-0.5 font-mono text-xl font-semibold text-ink">{coverageHealth.partiallyCovered}</dd>
              </div>
              <div className={`rounded p-3 ${coverageHealth.uncovered > 0 ? "border border-amber-200 bg-amber-50" : "border border-line bg-surface-sunken"}`}>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Uncovered</dt>
                <dd className={`mt-0.5 font-mono text-xl font-semibold ${coverageHealth.uncovered > 0 ? "text-amber-800" : "text-ink"}`}>
                  {coverageHealth.uncovered}
                </dd>
              </div>
              <div className="rounded border border-line bg-surface-sunken p-3">
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Total tracked</dt>
                <dd className="mt-0.5 font-mono text-xl font-semibold text-ink">{coverageHealth.totalTopics}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-ink-faint">Coverage data not available.</p>
          )}
        </div>
      </section>

      {calendarSlots.length > 0 ? (
        <section id="term-calendar" className="scroll-mt-6 rounded-lg border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Calendar timeline</h2>
              <p className="mt-1 text-sm text-ink-faint">
                {classDays.length} class day{classDays.length === 1 ? "" : "s"} in this term
                {showAllCalendarRows
                  ? ` · showing all ${calendarTimeline.allRows.length} dated slots`
                  : ` · showing ${visibleCalendarRows.length} dates around today`}
              </p>
            </div>
            {(calendarTimeline.hiddenBeforeCount > 0 || calendarTimeline.hiddenAfterCount > 0) ? (
              <button
                type="button"
                aria-controls="term-calendar-timeline"
                aria-expanded={showAllCalendarRows}
                onClick={() => setShowAllCalendarRows((current) => !current)}
                className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-soft"
              >
                {showAllCalendarRows ? "Show less" : "Show all"}
              </button>
            ) : null}
          </div>

          <div className="mt-4 rounded border border-line bg-surface-sunken p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">Semester progress</p>
                <p className="mt-1 text-sm text-ink-muted">{TODAY_SIGNAL_COPY[calendarTimeline.todaySignal]}</p>
              </div>
              <div className="min-w-[14rem] flex-1">
                <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-ink-faint">
                  <span>
                    {calendarTimeline.completedClassDays} of {calendarTimeline.totalClassDays} class days reached
                  </span>
                  <span className="font-mono">{calendarTimeline.progressPercent}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-line">
                  <div
                    className="h-2 rounded-full bg-accent transition-[width]"
                    style={{ width: `${calendarTimeline.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
            {!showAllCalendarRows && (calendarTimeline.hiddenBeforeCount > 0 || calendarTimeline.hiddenAfterCount > 0) ? (
              <p className="mt-3 text-xs text-ink-faint">
                {calendarTimeline.hiddenBeforeCount > 0 ? `${calendarTimeline.hiddenBeforeCount} earlier` : "No earlier"}
                {" · "}
                {calendarTimeline.hiddenAfterCount > 0 ? `${calendarTimeline.hiddenAfterCount} later` : "No later"} dates hidden.
              </p>
            ) : null}
          </div>

          <div id="term-calendar-timeline" className="mt-4 divide-y divide-line">
            {visibleCalendarRows.map((row) => {
              const { slot, session, isClassDay, isGap, isToday } = row;

              return (
                <div
                  key={slot.id}
                  className={`flex items-start gap-4 py-3 ${
                    isToday ? "rounded-lg bg-accent-tint px-3" : ""
                  } ${isGap ? "bg-amber-50/70 px-3" : ""}`}
                >
                  <span className={`w-24 shrink-0 font-mono text-sm tabular-nums ${isGap ? "text-amber-800" : "text-ink-muted"}`}>
                    {slot.date}
                  </span>
                  <span
                    className={`w-24 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-medium ${
                      slot.slotType === "class_day"
                        ? "bg-accent-tint text-accent-strong"
                        : slot.slotType === "holiday"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-paper-inset text-ink-muted"
                    }`}
                  >
                    {formatSlotTypeLabel(slot.slotType)}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-start gap-2">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-medium ${capacityBadgeClass(slot.instructionalCapacity)}`}
                        aria-label={`Instructional capacity: ${formatInstructionalCapacityLabel(slot.instructionalCapacity)}`}
                      >
                        {formatInstructionalCapacityLabel(slot.instructionalCapacity)}
                      </span>
                      {isCapacityAdvisory(slot) ? (
                        <>
                          <span className="rounded-full border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-soft">
                            Capacity source: {formatCapacitySourceLabel(slot.capacitySource)}
                          </span>
                          {slot.capacityReason ? (
                            <span className="min-w-0 text-xs text-ink-faint">{slot.capacityReason}</span>
                          ) : null}
                          {slot.source ? (
                            <span className="min-w-0 text-xs text-ink-faint">Schedule source: {slot.source}</span>
                          ) : null}
                        </>
                      ) : null}
                    </div>

                    {session ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-ink">
                            {session.code}: {session.title}
                            {session.status === "canceled" ? (
                              <span className="ml-2 text-xs font-normal text-rose-600">canceled</span>
                            ) : null}
                          </p>
                          <span className="rounded-full border border-line bg-surface-sunken px-2 py-1 text-xs font-medium text-ink-soft">
                            Mode: {formatInstructionalModeLabel(session.instructionalMode)}
                          </span>
                        </div>
                        {session.scheduleOverrideLabel ? (
                          <p className="text-xs text-ink-faint">Override: {session.scheduleOverrideLabel}</p>
                        ) : null}
                        {isGap ? (
                          <p className="text-xs font-medium text-amber-800">
                            Planning gap: this class day needs an active replacement session.
                          </p>
                        ) : null}
                      </>
                    ) : isClassDay ? (
                      <>
                        <p className="text-sm text-amber-800">No session assigned</p>
                        <p className="text-xs font-medium text-amber-800">
                          Planning gap: this materialized class day is still empty.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-ink-faint">{slot.label ?? "—"}</p>
                    )}
                  </div>
                  {isToday ? (
                    <span className="rounded-full bg-accent-tint px-2 py-1 text-xs font-medium text-accent-strong">
                      Today
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {unscheduledSessions.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Unscheduled sessions</h2>
          <p className="mt-1 text-sm text-ink-muted">
            These sessions have no date assigned. Assign them to class days.
          </p>
          <ul className="mt-3 space-y-2">
            {unscheduledSessions.map((session) => (
              <li key={session.id} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2">
                <span className="text-sm font-medium text-ink">{session.code}:</span>
                <span className="text-sm text-ink-soft">{session.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {assessments.length > 0 ? (
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Assessments</h2>
          <div className="mt-4 space-y-2">
            {assessments.map((assessment) => (
              <div key={assessment.id} className="flex items-center justify-between rounded-lg border border-line bg-surface-sunken px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {assessment.code}: {assessment.title}
                  </p>
                  <p className="font-mono text-xs text-ink-faint">
                    {assessment.assessmentType}
                    {assessment.dueDate ? ` · due ${assessment.dueDate}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section id="term-curriculum" className="scroll-mt-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Planned vs. delivered learning modules</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {term.status === "active"
                ? "Active terms can record delivery changes as immutable revisions."
                : term.status === "closed"
                  ? "Closed terms show the delivered snapshot read-only."
                  : "Planned terms can still adopt course learning modules before delivery begins."}
            </p>
          </div>
          {term.status !== "closed" && adoptableLearningModuleCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAdoptPanel((current) => !current)}
              className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-soft"
            >
              {showAdoptPanel ? "Hide adoption form" : "Adopt learning module"}
            </button>
          ) : null}
        </div>

        {showAdoptPanel ? (
          <div className="rounded-lg border border-line bg-surface p-5">
            <AdoptLearningModulePanel
              termId={term.id}
              learningModules={courseLearningModules}
              currentVersionsByLearningModuleId={currentVersionsByLearningModuleId}
              versionsByLearningModuleId={versionsByLearningModuleId}
              existingLearningModuleIds={existingLearningModuleIds}
              nextSequence={nextLearningModuleSequence}
              onAdopted={async () => {
                setShowAdoptPanel(false);
                await loadWorkspace();
              }}
            />
          </div>
        ) : null}

        {courseLearningModules.length === 0 ? (
          <GapNotice title="No course learning modules exist yet.">
            Create them in the course workspace before adopting them into this term.
          </GapNotice>
        ) : null}

        {courseLearningModules.length > 0 && adoptableLearningModuleCount === 0 ? (
          <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3 text-sm text-ink-muted">
            All course learning modules are already adopted for this term.
          </div>
        ) : null}

        {moduleWorkspaces.length === 0 && courseLearningModules.length > 0 ? (
          <GapNotice title="No learning modules adopted for this term yet.">
            Adopt one or more course learning modules to start building the term plan.
          </GapNotice>
        ) : null}

        {moduleWorkspaces.length > 0 ? (
          <div className="space-y-5">
            {moduleWorkspaces.map((workspace) => {
              const isEditing = editingTermLearningModuleId === workspace.termLearningModule.id;
              const effectiveDeliveredVersion = workspace.deliveredVersion ?? workspace.plannedVersion;
              const moduleCurrentVersion =
                currentVersionsByLearningModuleId.get(workspace.termLearningModule.learningModuleId) ?? null;

              return (
                <article key={workspace.termLearningModule.id} className="rounded-lg border border-line bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-xl font-semibold text-ink">{workspace.plannedVersion.title}</h3>
                      <p className="mt-1 text-sm text-ink-faint">
                        Sequence {workspace.termLearningModule.sequence} · planned rev. {workspace.plannedVersion.revision}
                        {workspace.deliveredVersion
                          ? ` · delivered rev. ${workspace.deliveredVersion.revision}`
                          : " · no in-term revisions yet"}
                        {moduleCurrentVersion && moduleCurrentVersion.id !== workspace.plannedVersion.id
                          ? ` · course is now at rev. ${moduleCurrentVersion.revision}`
                          : ""}
                      </p>
                      {workspace.termLearningModule.notes ? (
                        <p className="mt-2 text-sm text-ink-muted">{workspace.termLearningModule.notes}</p>
                      ) : null}
                    </div>
                    {term.status === "active" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingTermLearningModuleId((current) =>
                            current === workspace.termLearningModule.id ? null : workspace.termLearningModule.id,
                          )
                        }
                        className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-soft"
                      >
                        {isEditing ? "Hide editor" : "Record delivery change"}
                      </button>
                    ) : term.status === "closed" ? (
                      <span className="rounded-full bg-paper-inset px-3 py-1 text-xs font-medium text-ink-muted">
                        Read-only snapshot
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-2">
                    <div className="rounded border border-line bg-surface-sunken p-4">
                      <p className="mb-2 text-sm font-medium text-ink-soft">Planned snapshot</p>
                      {workspace.plannedVersion.learningObjectives.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
                          {workspace.plannedVersion.learningObjectives.map((objective) => (
                            <li key={objective}>{objective}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-ink-faint italic">No learning objectives recorded.</p>
                      )}
                    </div>

                    <div className="rounded border border-line bg-surface-sunken p-4">
                      <p className="mb-2 text-sm font-medium text-ink-soft">
                        {term.status === "closed" ? "Delivered snapshot" : "Current delivery snapshot"}
                      </p>
                      {effectiveDeliveredVersion.learningObjectives.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
                          {effectiveDeliveredVersion.learningObjectives.map((objective) => (
                            <li key={objective}>{objective}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-ink-faint italic">No learning objectives recorded.</p>
                      )}
                    </div>
                  </div>

                  {workspace.diff.topicChanges.length > 0 ? (
                    <div className="mt-4 rounded border border-line p-4">
                      <p className="text-sm font-medium text-ink">Planned vs. delivered diff</p>
                      <div className="mt-2 space-y-1.5">
                        {workspace.diff.topicChanges.map((change) => (
                          <div key={`${change.kind}-${change.topicId}`} className="rounded-lg bg-surface-sunken px-3 py-2 text-sm">
                            {change.topicId === "__module_objectives__" ? (
                              <p className="text-ink-soft">Learning objectives changed during delivery.</p>
                            ) : (
                              <p className="text-ink-soft">
                                <span className="font-medium text-ink">
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
          </div>
        ) : null}
      </section>
    </div>
  );
}
