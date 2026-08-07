"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState, type FormEvent } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  CalendarSlotDto,
  CreateDeliveredRevisionRequest,
  Id,
  LearningModuleDto,
  LearningModuleVersionDto,
  PlannedDeliveredDiffResponse,
  SessionDto,
  TermCalendarExceptionAction,
  TermCalendarExceptionDto,
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
  const [calendarExceptions, setCalendarExceptions] = useState<TermCalendarExceptionDto[]>([]);
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
  const [exceptionAction, setExceptionAction] = useState<TermCalendarExceptionAction>("modify");
  const [exceptionCalendarSlotId, setExceptionCalendarSlotId] = useState("");
  const [exceptionTargetDate, setExceptionTargetDate] = useState("");
  const [exceptionActivityTypeVersionId, setExceptionActivityTypeVersionId] = useState("");
  const [exceptionStartsAt, setExceptionStartsAt] = useState("");
  const [exceptionEndsAt, setExceptionEndsAt] = useState("");
  const [exceptionLabel, setExceptionLabel] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [editingExceptionId, setEditingExceptionId] = useState<Id | null>(null);
  const [exceptionBusy, setExceptionBusy] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [calendarAnnouncement, setCalendarAnnouncement] = useState("");
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
        loadedCalendarExceptions,
        loadedCoverageHealth,
        loadedAssessments,
        loadedLearningModules,
        loadedTopics,
      ] = await Promise.all([
        redesignApi.getCourse(loadedTerm.courseId),
        redesignApi.listTermLearningModules(termId),
        redesignApi.listTermSessions(termId),
        redesignApi.listCalendarSlots(termId),
        redesignApi.listTermCalendarExceptions(termId),
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
      setCalendarExceptions(loadedCalendarExceptions);
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
    () => deriveTermPlanningGaps({ calendarSlots, sessions, exceptions: calendarExceptions }),
    [calendarSlots, calendarExceptions, sessions],
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

  function resetExceptionForm() {
    setExceptionAction("modify");
    setExceptionCalendarSlotId("");
    setExceptionTargetDate("");
    setExceptionActivityTypeVersionId("");
    setExceptionStartsAt("");
    setExceptionEndsAt("");
    setExceptionLabel("");
    setExceptionReason("");
    setEditingExceptionId(null);
    setExceptionError(null);
  }

  function beginEditingException(exception: TermCalendarExceptionDto) {
    setExceptionAction(exception.action);
    setExceptionCalendarSlotId(exception.calendarSlotId ?? "");
    setExceptionTargetDate(exception.targetDate ?? "");
    setExceptionActivityTypeVersionId(exception.activityTypeVersionId ?? "");
    setExceptionStartsAt(exception.startsAt ?? "");
    setExceptionEndsAt(exception.endsAt ?? "");
    setExceptionLabel(exception.label ?? "");
    setExceptionReason(exception.reason ?? "");
    setEditingExceptionId(exception.id);
    setExceptionError(null);
  }

  async function handleSaveCalendarException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExceptionBusy(true);
    setExceptionError(null);
    const input = {
      action: exceptionAction,
      activityTypeVersionId: exceptionActivityTypeVersionId || null,
      calendarSlotId: exceptionCalendarSlotId || null,
      targetDate: exceptionTargetDate || null,
      startsAt: exceptionStartsAt || null,
      endsAt: exceptionEndsAt || null,
      label: exceptionLabel || null,
      reason: exceptionReason || null,
    };
    try {
      const saved = editingExceptionId
        ? await redesignApi.updateTermCalendarException(termId, editingExceptionId, input)
        : await redesignApi.createTermCalendarException(termId, input);
      setCalendarExceptions((current) =>
        editingExceptionId
          ? current.map((exception) => exception.id === saved.id ? saved : exception)
          : [...current, saved],
      );
      setCalendarAnnouncement(editingExceptionId ? "Calendar exception updated." : "Calendar exception created.");
      resetExceptionForm();
    } catch (caught) {
      setExceptionError(caught instanceof Error ? caught.message : "Unable to save calendar exception.");
    } finally {
      setExceptionBusy(false);
    }
  }

  async function handleDeleteCalendarException(exceptionId: Id) {
    setExceptionBusy(true);
    setExceptionError(null);
    try {
      await redesignApi.deleteTermCalendarException(termId, exceptionId);
      setCalendarExceptions((current) => current.filter((exception) => exception.id !== exceptionId));
      if (editingExceptionId === exceptionId) resetExceptionForm();
      setCalendarAnnouncement("Calendar exception deleted.");
    } catch (caught) {
      setExceptionError(caught instanceof Error ? caught.message : "Unable to delete calendar exception.");
    } finally {
      setExceptionBusy(false);
    }
  }

  async function handleResolveSpecialSlot(slot: CalendarSlotDto) {
    setExceptionBusy(true);
    setExceptionError(null);
    try {
      const exception = await redesignApi.createTermCalendarException(termId, {
        action: "modify",
        calendarSlotId: slot.id,
        targetDate: slot.date,
        label: `Alternate schedule: ${slot.label ?? slot.date}`,
        reason: "Instructor-approved alternate schedule.",
      });
      setCalendarExceptions((current) => [...current, exception]);
      setCalendarAnnouncement(`${slot.label ?? slot.date} marked with an explicit alternate schedule.`);
    } catch (caught) {
      setExceptionError(caught instanceof Error ? caught.message : "Unable to resolve alternate schedule.");
    } finally {
      setExceptionBusy(false);
    }
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
  const unscheduledSessions = sessions.filter((session) => !session.date && session.status === "scheduled");
  const canceledSessions = sessions.filter((session) => session.status === "canceled");

  return (
    <div className="space-y-8">
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
                onClick={() => setPendingTransition(transition.transition)}
                disabled={transitionBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
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

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Planning gaps</h2>
          <div className="mt-4 space-y-3">
            {planningGaps.unplannedClassDays.length === 0 && planningGaps.unscheduledSessions.length === 0 && planningGaps.unplannedSpecialScheduleSlots.length === 0 ? (
              <p className="text-sm text-slate-500">No date gaps visible right now.</p>
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
            {planningGaps.unplannedSpecialScheduleSlots.length > 0 ? (
              <GapNotice title={`${planningGaps.unplannedSpecialScheduleSlots.length} special/finals slot(s) need an explicit alternate schedule.`}>
                <div className="space-y-2">
                  {planningGaps.unplannedSpecialScheduleSlots.slice(0, 5).map((slot) => (
                    <div key={slot.id} className="flex flex-wrap items-center gap-2">
                      <span>{slot.label ?? slot.date}</span>
                      <button type="button" onClick={() => void handleResolveSpecialSlot(slot)} disabled={exceptionBusy} className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800 disabled:opacity-60">
                        Record alternate schedule
                      </button>
                    </div>
                  ))}
                  {planningGaps.unplannedSpecialScheduleSlots.length > 5 ? <span>+{planningGaps.unplannedSpecialScheduleSlots.length - 5} more</span> : null}
                </div>
              </GapNotice>
            ) : null}
            {canceledSessions.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <span className="font-medium">{canceledSessions.length} session(s) canceled.</span>{" "}
                These dates remain visible as planning gaps until they are recovered.
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Calendar exceptions</h2>
        <p className="mt-1 text-sm text-slate-600">Record Term-specific cancel, add, replace, or modify decisions without changing the institution calendar.</p>
        <p aria-live="polite" className="sr-only">{calendarAnnouncement}</p>
        {exceptionError ? <p className="mt-3 text-sm text-rose-700">{exceptionError}</p> : null}
        <div className="mt-4 space-y-2">
          {calendarExceptions.length === 0 ? <p className="text-sm text-slate-500">No Term calendar exceptions recorded.</p> : calendarExceptions.map((exception) => (
            <div key={exception.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <span><span className="font-medium capitalize text-slate-900">{exception.action}</span>{exception.label ? ` · ${exception.label}` : ""}{exception.targetDate ? ` · ${exception.targetDate}` : ""}{exception.reason ? ` · ${exception.reason}` : ""}</span>
              <span className="flex gap-2"><button type="button" onClick={() => beginEditingException(exception)} className="text-sky-700">Edit</button><button type="button" onClick={() => void handleDeleteCalendarException(exception.id)} disabled={exceptionBusy} className="text-rose-700 disabled:opacity-60">Delete</button></span>
            </div>
          ))}
        </div>
        <form className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2" onSubmit={(event) => void handleSaveCalendarException(event)}>
          <label className="text-sm text-slate-700">Action<select aria-label="Exception action" value={exceptionAction} onChange={(event) => setExceptionAction(event.target.value as TermCalendarExceptionAction)} className="mt-1 block w-full rounded-md border border-slate-300 p-2"><option value="cancel">Cancel</option><option value="add">Add</option><option value="replace">Replace</option><option value="modify">Modify</option></select></label>
          <label className="text-sm text-slate-700">Calendar slot<select aria-label="Exception calendar slot" value={exceptionCalendarSlotId} onChange={(event) => { setExceptionCalendarSlotId(event.target.value); const slot = calendarSlots.find((candidate) => candidate.id === event.target.value); if (slot) setExceptionTargetDate(slot.date); }} className="mt-1 block w-full rounded-md border border-slate-300 p-2"><option value="">Date-only target</option>{calendarSlots.map((slot) => <option key={slot.id} value={slot.id}>{slot.date} · {slot.label ?? formatSlotTypeLabel(slot.slotType)}</option>)}</select></label>
          <label className="text-sm text-slate-700">Target date<input aria-label="Exception target date" type="date" value={exceptionTargetDate} onChange={(event) => setExceptionTargetDate(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 p-2" /></label>
          <label className="text-sm text-slate-700">Label<input aria-label="Exception label" value={exceptionLabel} onChange={(event) => setExceptionLabel(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 p-2" /></label>
          <label className="text-sm text-slate-700">Reason<input aria-label="Exception reason" value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 p-2" /></label>
          <label className="text-sm text-slate-700">Activity type version ID (required for add)<input aria-label="Exception activity type version ID" value={exceptionActivityTypeVersionId} onChange={(event) => setExceptionActivityTypeVersionId(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 p-2" /></label>
          <label className="text-sm text-slate-700">Starts at (ISO date-time)<input aria-label="Exception starts at" value={exceptionStartsAt} onChange={(event) => setExceptionStartsAt(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 p-2" /></label>
          <label className="text-sm text-slate-700">Ends at (ISO date-time)<input aria-label="Exception ends at" value={exceptionEndsAt} onChange={(event) => setExceptionEndsAt(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 p-2" /></label>
          <div className="flex items-end gap-2"><button type="submit" disabled={exceptionBusy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{editingExceptionId ? "Save exception" : "Create exception"}</button>{editingExceptionId ? <button type="button" onClick={resetExceptionForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel edit</button> : null}</div>
        </form>
      </section>

      {calendarSlots.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Calendar timeline</h2>
              <p className="mt-1 text-sm text-slate-500">
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
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                {showAllCalendarRows ? "Show less" : "Show all"}
              </button>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Semester progress</p>
                <p className="mt-1 text-sm text-slate-600">{TODAY_SIGNAL_COPY[calendarTimeline.todaySignal]}</p>
              </div>
              <div className="min-w-[14rem] flex-1">
                <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
                  <span>
                    {calendarTimeline.completedClassDays} of {calendarTimeline.totalClassDays} class days reached
                  </span>
                  <span>{calendarTimeline.progressPercent}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-sky-600 transition-[width]"
                    style={{ width: `${calendarTimeline.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
            {!showAllCalendarRows && (calendarTimeline.hiddenBeforeCount > 0 || calendarTimeline.hiddenAfterCount > 0) ? (
              <p className="mt-3 text-xs text-slate-500">
                {calendarTimeline.hiddenBeforeCount > 0 ? `${calendarTimeline.hiddenBeforeCount} earlier` : "No earlier"}
                {" · "}
                {calendarTimeline.hiddenAfterCount > 0 ? `${calendarTimeline.hiddenAfterCount} later` : "No later"} dates hidden.
              </p>
            ) : null}
          </div>

          <div id="term-calendar-timeline" className="mt-4 divide-y divide-slate-100">
            {visibleCalendarRows.map((row) => {
              const { slot, session, isClassDay, isGap, isToday, provenance } = row;

              return (
                <div
                  key={slot.id}
                  className={`flex items-start gap-4 py-3 ${
                    isToday ? "rounded-xl bg-sky-50 px-3" : ""
                  } ${isGap ? "bg-amber-50/70 px-3" : ""}`}
                >
                  <span className={`w-24 shrink-0 text-sm tabular-nums ${isGap ? "text-amber-700" : "text-slate-600"}`}>
                    {slot.date}
                  </span>
                  <span
                    className={`w-24 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-medium ${
                      slot.slotType === "class_day"
                        ? "bg-sky-50 text-sky-800"
                        : slot.slotType === "holiday"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {formatSlotTypeLabel(slot.slotType)}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-start gap-2">
                      <span className={`rounded-full border px-2 py-1 text-xs font-medium ${provenance === "calendar_inherited" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-violet-200 bg-violet-50 text-violet-800"}`}>
                        {provenance === "calendar_inherited" ? "Institution calendar" : "Term-specific"}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-medium ${capacityBadgeClass(slot.instructionalCapacity)}`}
                        aria-label={`Instructional capacity: ${formatInstructionalCapacityLabel(slot.instructionalCapacity)}`}
                      >
                        {formatInstructionalCapacityLabel(slot.instructionalCapacity)}
                      </span>
                      {isCapacityAdvisory(slot) ? (
                        <>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                            Capacity source: {formatCapacitySourceLabel(slot.capacitySource)}
                          </span>
                          {slot.capacityReason ? (
                            <span className="min-w-0 text-xs text-slate-500">{slot.capacityReason}</span>
                          ) : null}
                          {slot.source ? (
                            <span className="min-w-0 text-xs text-slate-500">Schedule source: {slot.source}</span>
                          ) : null}
                        </>
                      ) : null}
                    </div>

                    {session ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {session.code}: {session.title}
                            {session.status === "canceled" ? (
                              <span className="ml-2 text-xs font-normal text-rose-600">canceled</span>
                            ) : null}
                          </p>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                            Mode: {formatInstructionalModeLabel(session.instructionalMode)}
                          </span>
                        </div>
                        {session.scheduleOverrideLabel ? (
                          <p className="text-xs text-slate-500">Override: {session.scheduleOverrideLabel}</p>
                        ) : null}
                        {isGap ? (
                          <p className="text-xs font-medium text-amber-700">
                            Planning gap: this class day needs an active replacement session.
                          </p>
                        ) : null}
                      </>
                    ) : isClassDay ? (
                      <>
                        <p className="text-sm text-amber-700">No session assigned</p>
                        <p className="text-xs font-medium text-amber-700">
                          Planning gap: this materialized class day is still empty.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">{slot.label ?? "—"}</p>
                    )}
                  </div>
                  {isToday ? (
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800">
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

      {assessments.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Assessments</h2>
          <div className="mt-4 space-y-2">
            {assessments.map((assessment) => (
              <div key={assessment.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {assessment.code}: {assessment.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {assessment.assessmentType}
                    {assessment.dueDate ? ` · due ${assessment.dueDate}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Planned vs. delivered learning modules</h2>
            <p className="mt-1 text-sm text-slate-600">
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
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              {showAdoptPanel ? "Hide adoption form" : "Adopt learning module"}
            </button>
          ) : null}
        </div>

        {showAdoptPanel ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
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
                <article key={workspace.termLearningModule.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{workspace.plannedVersion.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Sequence {workspace.termLearningModule.sequence} · planned rev. {workspace.plannedVersion.revision}
                        {workspace.deliveredVersion
                          ? ` · delivered rev. ${workspace.deliveredVersion.revision}`
                          : " · no in-term revisions yet"}
                        {moduleCurrentVersion && moduleCurrentVersion.id !== workspace.plannedVersion.id
                          ? ` · course is now at rev. ${moduleCurrentVersion.revision}`
                          : ""}
                      </p>
                      {workspace.termLearningModule.notes ? (
                        <p className="mt-2 text-sm text-slate-600">{workspace.termLearningModule.notes}</p>
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
                          {workspace.plannedVersion.learningObjectives.map((objective) => (
                            <li key={objective}>{objective}</li>
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
                          {effectiveDeliveredVersion.learningObjectives.map((objective) => (
                            <li key={objective}>{objective}</li>
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
          </div>
        ) : null}
      </section>
    </div>
  );
}
