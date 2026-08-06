"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  AcademicCalendarDto,
  ActivityTypeDto,
  ActivityTypeVersionDto,
  Id,
  InstitutionDto,
  LearningModuleDto,
  LearningModuleVersionDto,
  TermDto,
  TopicVersionDto,
} from "@/lib/redesign-contract";
import { buildTopicBrowserBuckets, suggestTopicStableCode } from "@/lib/redesign-workspace";
import CreateTermPanel from "./CreateTermPanel";
import GapNotice from "./GapNotice";
import LifecycleBadge from "./LifecycleBadge";
import RevisionHistoryPanel from "./RevisionHistoryPanel";
import TopicBrowser from "./TopicBrowser";

type Props = {
  courseId: string;
};

type InstitutionFormState =
  | { open: false }
  | { open: true; name: string; shortName: string; submitting: boolean; error: string | null };

type CalendarFormState =
  | { open: false }
  | {
      open: true;
      institutionId: Id;
      name: string;
      academicYear: string;
      sourceUri: string;
      submitting: boolean;
      error: string | null;
    };

type LinkInstitutionState =
  | { open: false }
  | { open: true; selectedId: Id; submitting: boolean; error: string | null };

type CreateLmState =
  | { open: false }
  | {
      open: true;
      stableCode: string;
      title: string;
      description: string;
      objectives: string;
      submitting: boolean;
      error: string | null;
    };

type CreateTopicState =
  | { open: false }
  | {
      open: true;
      stableCode: string;
      title: string;
      category: string;
      codeOverridden: boolean;
      submitting: boolean;
      error: string | null;
    };

type CreateActivityTypeState =
  | { open: false }
  | {
      open: true;
      label: string;
      behaviorFamily: "meeting" | "coursework" | "assessment";
      description: string;
      submitting: boolean;
      error: string | null;
    };

export default function CourseWorkspacePage({ courseId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<Awaited<ReturnType<typeof redesignApi.getCourse>> | null>(null);
  const [allInstitutions, setAllInstitutions] = useState<InstitutionDto[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionDto[]>([]);
  const [calendars, setCalendars] = useState<AcademicCalendarDto[]>([]);
  const [terms, setTerms] = useState<TermDto[]>([]);
  const [learningModules, setLearningModules] = useState<LearningModuleDto[]>([]);
  const [currentVersionsByLearningModuleId, setCurrentVersionsByLearningModuleId] = useState(
    new Map<Id, LearningModuleVersionDto | null>(),
  );
  const [versionsByLearningModuleId, setVersionsByLearningModuleId] = useState(
    new Map<Id, LearningModuleVersionDto[]>(),
  );
  const [topics, setTopics] = useState<Awaited<ReturnType<typeof redesignApi.listTopics>>>([]);
  const [currentVersionsByTopicId, setCurrentVersionsByTopicId] = useState(new Map<Id, TopicVersionDto | null>());
  const [topicVersionsById, setTopicVersionsById] = useState(new Map<Id, TopicVersionDto>());
  const [prerequisites, setPrerequisites] = useState<Awaited<ReturnType<typeof redesignApi.listTopicPrerequisites>>>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeDto[]>([]);
  const [activityTypeVersionsById, setActivityTypeVersionsById] = useState(
    new Map<Id, ActivityTypeVersionDto[]>(),
  );

  const [institutionForm, setInstitutionForm] = useState<InstitutionFormState>({ open: false });
  const [calendarForm, setCalendarForm] = useState<CalendarFormState>({ open: false });
  const [linkInstForm, setLinkInstForm] = useState<LinkInstitutionState>({ open: false });
  const [createLmState, setCreateLmState] = useState<CreateLmState>({ open: false });
  const [createTopicState, setCreateTopicState] = useState<CreateTopicState>({ open: false });
  const [createActivityTypeState, setCreateActivityTypeState] = useState<CreateActivityTypeState>({
    open: false,
  });

  async function loadWorkspace() {
    setLoading(true);
    setError(null);
    try {
      const [
        loadedCourse,
        loadedAllInstitutions,
        loadedInstitutions,
        loadedTerms,
        loadedLearningModules,
        loadedTopics,
        loadedPrerequisites,
        loadedActivityTypes,
      ] = await Promise.all([
        redesignApi.getCourse(courseId),
        redesignApi.listInstitutions(),
        redesignApi.listCourseInstitutions(courseId),
        redesignApi.listTerms(courseId),
        redesignApi.listLearningModules(courseId),
        redesignApi.listTopics(courseId),
        redesignApi.listTopicPrerequisites(courseId),
        redesignApi.listActivityTypes(),
      ]);

      const [
        moduleDetails,
        moduleVersions,
        topicDetails,
        institutionCalendars,
        loadedActivityTypeVersions,
      ] = await Promise.all([
        Promise.all(loadedLearningModules.map((lm) => redesignApi.getLearningModule(lm.id))),
        Promise.all(loadedLearningModules.map((lm) => redesignApi.listLearningModuleVersions(lm.id))),
        Promise.all(loadedTopics.map((topic) => redesignApi.getTopic(topic.id))),
        Promise.all(loadedInstitutions.map((inst) => redesignApi.listAcademicCalendars(inst.id))),
        Promise.all(loadedActivityTypes.map((activityType) => redesignApi.listActivityTypeVersions(activityType.id))),
      ]);

      const nextCurrentLmVersions = new Map<Id, LearningModuleVersionDto | null>();
      for (const detail of moduleDetails) {
        nextCurrentLmVersions.set(detail.learningModule.id, detail.currentVersion);
      }

      const nextVersionsByLmId = new Map<Id, LearningModuleVersionDto[]>();
      for (const versions of moduleVersions) {
        if (versions[0]) nextVersionsByLmId.set(versions[0].learningModuleId, versions);
      }

      const nextCurrentTopicVersions = new Map<Id, TopicVersionDto | null>();
      const neededTopicVersionIds = new Set<Id>();
      for (const detail of topicDetails) {
        nextCurrentTopicVersions.set(detail.topic.id, detail.currentVersion);
        if (detail.currentVersion) neededTopicVersionIds.add(detail.currentVersion.id);
      }
      for (const versions of nextVersionsByLmId.values()) {
        for (const version of versions) {
          for (const topic of version.topics) {
            neededTopicVersionIds.add(topic.topicVersionId);
          }
        }
      }

      const loadedTopicVersions = await Promise.all(
        [...neededTopicVersionIds].map((id) => redesignApi.getTopicVersion(id)),
      );
      const nextTopicVersionsById = new Map<Id, TopicVersionDto>();
      for (const topicVersion of loadedTopicVersions) {
        nextTopicVersionsById.set(topicVersion.id, topicVersion);
      }

      const nextActivityTypeVersionsById = new Map<Id, ActivityTypeVersionDto[]>();
      for (let index = 0; index < loadedActivityTypes.length; index += 1) {
        nextActivityTypeVersionsById.set(
          loadedActivityTypes[index]!.id,
          loadedActivityTypeVersions[index] ?? [],
        );
      }

      setCourse(loadedCourse);
      setAllInstitutions(loadedAllInstitutions.filter((institution) => !institution.archivedAt));
      setInstitutions(loadedInstitutions);
      setCalendars(institutionCalendars.flat());
      setTerms(loadedTerms.slice().sort((left, right) => left.startDate.localeCompare(right.startDate)));
      setLearningModules(loadedLearningModules);
      setCurrentVersionsByLearningModuleId(nextCurrentLmVersions);
      setVersionsByLearningModuleId(nextVersionsByLmId);
      setTopics(loadedTopics);
      setCurrentVersionsByTopicId(nextCurrentTopicVersions);
      setTopicVersionsById(nextTopicVersionsById);
      setPrerequisites(loadedPrerequisites);
      setActivityTypes(loadedActivityTypes);
      setActivityTypeVersionsById(nextActivityTypeVersionsById);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load course workspace.");
    } finally {
      setLoading(false);
    }
  }

  const loadFromEffect = useEffectEvent(loadWorkspace);

  useEffect(() => {
    void loadFromEffect();
  }, [courseId]);

  const topicTitleById = useMemo(() => {
    const map = new Map<Id, string>();
    for (const topic of topics) {
      map.set(topic.id, currentVersionsByTopicId.get(topic.id)?.title ?? topic.stableCode);
    }
    return map;
  }, [currentVersionsByTopicId, topics]);

  const topicBuckets = useMemo(
    () =>
      buildTopicBrowserBuckets({
        learningModules,
        currentVersionsByLearningModuleId,
        topics,
        currentVersionsByTopicId,
        prerequisites,
      }),
    [currentVersionsByLearningModuleId, currentVersionsByTopicId, learningModules, prerequisites, topics],
  );

  async function handleSaveTopic(
    topicId: Id,
    input: {
      stableCode: string;
      title: string;
      category: string;
      prerequisiteTopicIds: Id[];
    },
  ) {
    const topic = topics.find((candidate) => candidate.id === topicId);
    const currentVersion = currentVersionsByTopicId.get(topicId) ?? null;
    if (!topic) throw new Error("Topic not found.");

    if (topic.stableCode !== input.stableCode) {
      await redesignApi.updateTopic(topicId, {
        stableCode: input.stableCode,
      });
    }

    if (
      currentVersion &&
      ((currentVersion.title ?? "") !== input.title || (currentVersion.category ?? "") !== input.category)
    ) {
      await redesignApi.createTopicVersion(topicId, {
        expectedCurrentVersionId: currentVersion.id,
        title: input.title,
        category: input.category || null,
        description: currentVersion.description,
        publish: false,
      });
    }

    await redesignApi.replaceTopicPrerequisites(topicId, input.prerequisiteTopicIds);
    await loadWorkspace();
  }

  async function handleRestoreVersion(learningModuleId: Id, versionId: Id) {
    await redesignApi.restoreLearningModuleVersion(
      learningModuleId,
      versionId,
      "Restored from course workspace revision history.",
    );
    await loadWorkspace();
  }

  async function handleCreateInstitution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!institutionForm.open) return;
    setInstitutionForm({ ...institutionForm, submitting: true, error: null });
    try {
      const institution = await redesignApi.createInstitution({
        name: institutionForm.name,
        shortName: institutionForm.shortName || null,
      });
      const currentIds = institutions.map((item) => item.id);
      await redesignApi.replaceCourseInstitutions(courseId, [...currentIds, institution.id]);
      setInstitutionForm({ open: false });
      await loadWorkspace();
    } catch (err) {
      setInstitutionForm({
        ...institutionForm,
        submitting: false,
        error: err instanceof Error ? err.message : "Failed to create institution.",
      });
    }
  }

  async function handleLinkInstitution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!linkInstForm.open) return;
    setLinkInstForm({ ...linkInstForm, submitting: true, error: null });
    try {
      const currentIds = institutions.map((item) => item.id);
      await redesignApi.replaceCourseInstitutions(courseId, [...currentIds, linkInstForm.selectedId]);
      setLinkInstForm({ open: false });
      await loadWorkspace();
    } catch (err) {
      setLinkInstForm({
        ...linkInstForm,
        submitting: false,
        error: err instanceof Error ? err.message : "Failed to link institution.",
      });
    }
  }

  async function handleCreateCalendar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!calendarForm.open) return;
    setCalendarForm({ ...calendarForm, submitting: true, error: null });
    try {
      await redesignApi.createAcademicCalendar({
        institutionId: calendarForm.institutionId,
        name: calendarForm.name,
        academicYear: calendarForm.academicYear,
        sourceUri: calendarForm.sourceUri || null,
      });
      setCalendarForm({ open: false });
      await loadWorkspace();
    } catch (err) {
      setCalendarForm({
        ...calendarForm,
        submitting: false,
        error: err instanceof Error ? err.message : "Failed to create academic calendar.",
      });
    }
  }

  async function handleCreateLm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createLmState.open) return;
    setCreateLmState({ ...createLmState, submitting: true, error: null });
    try {
      const objectives = createLmState.objectives
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      await redesignApi.createLearningModule(courseId, createLmState.stableCode, {
        title: createLmState.title,
        description: createLmState.description || null,
        learningObjectives: objectives,
      });
      setCreateLmState({ open: false });
      await loadWorkspace();
    } catch (err) {
      setCreateLmState({
        ...createLmState,
        submitting: false,
        error: err instanceof Error ? err.message : "Failed to create learning module.",
      });
    }
  }

  async function handleCreateTopic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createTopicState.open) return;
    setCreateTopicState({ ...createTopicState, submitting: true, error: null });
    try {
      await redesignApi.createTopic(
        courseId,
        createTopicState.stableCode,
        {
          title: createTopicState.title,
          category: createTopicState.category || null,
        },
      );
      setCreateTopicState({ open: false });
      await loadWorkspace();
    } catch (err) {
      setCreateTopicState({
        ...createTopicState,
        submitting: false,
        error: err instanceof Error ? err.message : "Failed to create topic.",
      });
    }
  }

  async function handleCreateActivityType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createActivityTypeState.open) return;
    setCreateActivityTypeState({ ...createActivityTypeState, submitting: true, error: null });
    try {
      await redesignApi.createActivityType({
        behaviorFamily: createActivityTypeState.behaviorFamily,
        version: {
          label: createActivityTypeState.label,
          description: createActivityTypeState.description || null,
          publish: true,
        },
      });
      setCreateActivityTypeState({ open: false });
      await loadWorkspace();
    } catch (err) {
      setCreateActivityTypeState({
        ...createActivityTypeState,
        submitting: false,
        error: err instanceof Error ? err.message : "Failed to create activity type.",
      });
    }
  }

  const activeTerms = terms.filter((term) => term.status === "active");
  const plannedTerms = terms.filter((term) => term.status === "planned");
  const closedTerms = terms.filter((term) => term.status === "closed");
  const unassignedTopicCount = topics.filter((topic) => topic.learningModuleId === null).length;
  const unlinkedInstitutions = allInstitutions.filter(
    (institution) => !institutions.some((linkedInstitution) => linkedInstitution.id === institution.id),
  );
  const needsInstitution = institutions.length === 0;
  const needsCalendar = institutions.length > 0 && calendars.length === 0;

  function openInstitutionSetup() {
    if (unlinkedInstitutions.length > 0) {
      setLinkInstForm({
        open: true,
        selectedId: unlinkedInstitutions[0]!.id,
        submitting: false,
        error: null,
      });
      return;
    }

    setInstitutionForm({ open: true, name: "", shortName: "", submitting: false, error: null });
  }

  function openCalendarSetup() {
    if (institutions.length === 0) return;
    setCalendarForm({
      open: true,
      institutionId: institutions[0]!.id,
      name: "",
      academicYear: "",
      sourceUri: "",
      submitting: false,
      error: null,
    });
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 rounded-3xl bg-slate-100" />
        <div className="h-64 rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm font-medium text-rose-800">Failed to load course workspace</p>
        <p className="mt-1 text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  if (!course) {
    return <p className="text-sm text-rose-700">Course not found.</p>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm font-medium text-sky-700 hover:text-sky-800">
          ← Courses
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">{course.shortId}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              {course.number} · {course.title}
            </h1>
            {course.description ? (
              <p className="mt-2 max-w-3xl text-base text-slate-600">{course.description}</p>
            ) : (
              <p className="mt-2 text-base text-slate-400 italic">No course description.</p>
            )}
          </div>
          {course.numberIsPlaceholder ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
              Placeholder number
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {institutions.map((institution) => (
            <span
              key={institution.id}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
            >
              {institution.shortName ?? institution.name}
            </span>
          ))}
          {institutions.length === 0 ? (
            <span className="text-xs text-slate-400">No institution linked yet</span>
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Learning modules</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{learningModules.length}</p>
          </div>
          <div className={`rounded-2xl px-4 py-3 ${unassignedTopicCount > 0 ? "bg-amber-50" : "bg-slate-50"}`}>
            <p className="text-xs uppercase tracking-wide text-slate-500">Unassigned topics</p>
            <p className={`mt-1 text-xl font-semibold ${unassignedTopicCount > 0 ? "text-amber-800" : "text-slate-900"}`}>
              {unassignedTopicCount}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total topics</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{topics.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Terms</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{terms.length}</p>
          </div>
        </div>
      </section>

      {needsInstitution ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Link an institution</h2>
          <p className="mt-1 text-sm text-slate-600">
            A term requires an institution and an academic calendar. Link one to this course to unlock term creation.
          </p>

          {unlinkedInstitutions.length > 0 ? (
            <div className="mt-5">
              {!linkInstForm.open ? (
                <button
                  type="button"
                  onClick={() =>
                    setLinkInstForm({
                      open: true,
                      selectedId: unlinkedInstitutions[0]!.id,
                      submitting: false,
                      error: null,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Link existing institution
                </button>
              ) : (
                <form onSubmit={handleLinkInstitution} className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="text-sm text-slate-700">
                    <span className="mb-1 block font-medium">Institution</span>
                    <select
                      value={linkInstForm.selectedId}
                      onChange={(event) =>
                        setLinkInstForm({ ...linkInstForm, selectedId: event.target.value })
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                      disabled={linkInstForm.submitting}
                    >
                      {unlinkedInstitutions.map((institution) => (
                        <option key={institution.id} value={institution.id}>
                          {institution.shortName ?? institution.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {linkInstForm.error ? <p className="text-sm text-rose-700">{linkInstForm.error}</p> : null}
                  <button
                    type="submit"
                    disabled={linkInstForm.submitting}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
                  >
                    {linkInstForm.submitting ? "Linking..." : "Link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkInstForm({ open: false })}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                </form>
              )}
              <p className="mt-4 text-xs text-slate-500">Or create a new institution:</p>
            </div>
          ) : null}

          {!institutionForm.open ? (
            <button
              type="button"
              onClick={() =>
                setInstitutionForm({ open: true, name: "", shortName: "", submitting: false, error: null })
              }
              className={`${unlinkedInstitutions.length > 0 ? "mt-2" : "mt-5"} rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white`}
            >
              Create institution
            </button>
          ) : (
            <form onSubmit={handleCreateInstitution} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Institution name</span>
                <input
                  value={institutionForm.name}
                  onChange={(event) =>
                    setInstitutionForm({ ...institutionForm, name: event.target.value })
                  }
                  placeholder="University of California, Berkeley"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  required
                  disabled={institutionForm.submitting}
                />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Short name (optional)</span>
                <input
                  value={institutionForm.shortName}
                  onChange={(event) =>
                    setInstitutionForm({ ...institutionForm, shortName: event.target.value })
                  }
                  placeholder="UC Berkeley"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  disabled={institutionForm.submitting}
                />
              </label>
              {institutionForm.error ? (
                <p className="col-span-full text-sm text-rose-700">{institutionForm.error}</p>
              ) : null}
              <div className="col-span-full flex gap-3">
                <button
                  type="submit"
                  disabled={institutionForm.submitting}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
                >
                  {institutionForm.submitting ? "Creating..." : "Create and link"}
                </button>
                <button
                  type="button"
                  onClick={() => setInstitutionForm({ open: false })}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      {needsCalendar ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Add an academic calendar</h2>
          <p className="mt-1 text-sm text-slate-600">
            Each term uses an academic calendar from its institution. Create one for{" "}
            {institutions.map((institution) => institution.shortName ?? institution.name).join(", ")}.
          </p>

          {!calendarForm.open ? (
            <button
              type="button"
              onClick={openCalendarSetup}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Create academic calendar
            </button>
          ) : (
            <form onSubmit={handleCreateCalendar} className="mt-4 grid gap-4 sm:grid-cols-2">
              {institutions.length > 1 ? (
                <label className="text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Institution</span>
                  <select
                    value={calendarForm.institutionId}
                    onChange={(event) =>
                      setCalendarForm({ ...calendarForm, institutionId: event.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    disabled={calendarForm.submitting}
                  >
                    {institutions.map((institution) => (
                      <option key={institution.id} value={institution.id}>
                        {institution.shortName ?? institution.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Calendar name</span>
                <input
                  value={calendarForm.name}
                  onChange={(event) => setCalendarForm({ ...calendarForm, name: event.target.value })}
                  placeholder="AY 2026–27"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  required
                  disabled={calendarForm.submitting}
                />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Academic year</span>
                <input
                  value={calendarForm.academicYear}
                  onChange={(event) =>
                    setCalendarForm({ ...calendarForm, academicYear: event.target.value })
                  }
                  placeholder="2026-27"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  required
                  disabled={calendarForm.submitting}
                />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Source URL (optional)</span>
                <input
                  type="url"
                  value={calendarForm.sourceUri}
                  onChange={(event) => setCalendarForm({ ...calendarForm, sourceUri: event.target.value })}
                  placeholder="https://registrar.example.edu/calendar"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  disabled={calendarForm.submitting}
                />
              </label>
              {calendarForm.error ? (
                <p className="col-span-full text-sm text-rose-700">{calendarForm.error}</p>
              ) : null}
              <div className="col-span-full flex gap-3">
                <button
                  type="submit"
                  disabled={calendarForm.submitting}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
                >
                  {calendarForm.submitting ? "Creating..." : "Create calendar"}
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarForm({ open: false })}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(21rem,0.95fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Terms</h2>
              <p className="mt-1 text-sm text-slate-600">
                Each term is a dated run of this course. Terms must name an institution and shared academic calendar.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {terms.length} term{terms.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {[...activeTerms, ...plannedTerms, ...closedTerms].map((term) => (
              <Link
                key={term.id}
                href={`/terms/${term.id}`}
                className="block rounded-2xl border border-slate-200 px-4 py-3 hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{term.name}</p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {term.code} · {term.startDate} – {term.endDate}
                    </p>
                  </div>
                  <LifecycleBadge status={term.status} />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {term.status === "closed"
                    ? "Historical term: delivered snapshot is read-only."
                    : term.status === "active"
                      ? "Active term: delivered edits create immutable revisions."
                      : "Planned term: activate when delivery begins."}
                </p>
              </Link>
            ))}
            {terms.length === 0 ? (
              <GapNotice title="No terms yet.">
                {needsInstitution
                  ? "Link an institution first, then create the first term."
                  : needsCalendar
                    ? "Create an academic calendar first, then create the first term."
                    : "Create the first term from this workspace."}
              </GapNotice>
            ) : null}
          </div>
        </div>

        <CreateTermPanel
          courseId={courseId}
          institutions={institutions}
          calendars={calendars}
          onTermCreated={loadWorkspace}
          onResolveMissingInstitution={openInstitutionSetup}
          onResolveMissingCalendar={openCalendarSetup}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Learning modules</h2>
            <p className="mt-1 text-sm text-slate-600">
              Modules group related topics. Create modules here, then place topics and later activities.
            </p>
          </div>
          {!createLmState.open ? (
            <button
              type="button"
              onClick={() =>
                setCreateLmState({
                  open: true,
                  stableCode: "",
                  title: "",
                  description: "",
                  objectives: "",
                  submitting: false,
                  error: null,
                })
              }
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              New module
            </button>
          ) : null}
        </div>

        {createLmState.open ? (
          <form onSubmit={handleCreateLm} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Stable code</span>
              <input
                value={createLmState.stableCode}
                onChange={(event) =>
                  setCreateLmState({ ...createLmState, stableCode: event.target.value })
                }
                placeholder="lm-intro-ds"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                required
                disabled={createLmState.submitting}
              />
              <p className="mt-1 text-xs text-slate-500">Lowercase slug used in exports and cross-references.</p>
            </label>
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Title</span>
              <input
                value={createLmState.title}
                onChange={(event) => setCreateLmState({ ...createLmState, title: event.target.value })}
                placeholder="Introduction to Data Science"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                required
                disabled={createLmState.submitting}
              />
            </label>
            <label className="col-span-full text-sm text-slate-700">
              <span className="mb-1 block font-medium">Description (optional)</span>
              <textarea
                value={createLmState.description}
                onChange={(event) =>
                  setCreateLmState({ ...createLmState, description: event.target.value })
                }
                rows={2}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                disabled={createLmState.submitting}
              />
            </label>
            <label className="col-span-full text-sm text-slate-700">
              <span className="mb-1 block font-medium">Learning objectives (one per line, optional)</span>
              <textarea
                value={createLmState.objectives}
                onChange={(event) =>
                  setCreateLmState({ ...createLmState, objectives: event.target.value })
                }
                rows={3}
                placeholder={"Understand the data science lifecycle\nApply Python for exploratory analysis"}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                disabled={createLmState.submitting}
              />
            </label>
            {createLmState.error ? (
              <p className="col-span-full text-sm text-rose-700">{createLmState.error}</p>
            ) : null}
            <div className="col-span-full flex gap-3">
              <button
                type="submit"
                disabled={createLmState.submitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
              >
                {createLmState.submitting ? "Creating..." : "Create module"}
              </button>
              <button
                type="button"
                onClick={() => setCreateLmState({ open: false })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {learningModules.length === 0 && !createLmState.open ? (
          <div className="mt-4">
            <GapNotice title="No learning modules yet.">
              Create modules to organize topics into coherent groups before building terms.
            </GapNotice>
          </div>
        ) : null}

        {learningModules.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {learningModules.map((learningModule) => {
              const version = currentVersionsByLearningModuleId.get(learningModule.id);
              return (
                <div key={learningModule.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">
                    {version?.title ?? learningModule.stableCode}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {learningModule.stableCode}
                    {version ? ` · rev. ${version.revision}` : " · no version yet"}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Topic-first browser</h2>
            <p className="mt-1 text-sm text-slate-600">
              Topics stay visible even before they have a module home. Edit title, code, category, and prerequisites without leaving the workspace.
            </p>
          </div>
          {!createTopicState.open ? (
            <button
              type="button"
              onClick={() =>
                setCreateTopicState({
                  open: true,
                  stableCode: "",
                  title: "",
                  category: "",
                  codeOverridden: false,
                  submitting: false,
                  error: null,
                })
              }
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              New topic
            </button>
          ) : null}
        </div>

        {createTopicState.open ? (
          <form onSubmit={handleCreateTopic} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-slate-900">New topic</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Topic title</span>
                <input
                  value={createTopicState.title}
                  onChange={(event) => {
                    const nextTitle = event.target.value;
                    setCreateTopicState({
                      ...createTopicState,
                      title: nextTitle,
                      stableCode: createTopicState.codeOverridden
                        ? createTopicState.stableCode
                        : suggestTopicStableCode(nextTitle),
                    });
                  }}
                  placeholder="Pandas basics"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  required
                  disabled={createTopicState.submitting}
                />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Topic code</span>
                <input
                  value={createTopicState.stableCode}
                  onChange={(event) =>
                    setCreateTopicState({
                      ...createTopicState,
                      stableCode: event.target.value,
                      codeOverridden:
                        event.target.value !== "" &&
                        event.target.value !== suggestTopicStableCode(createTopicState.title),
                    })
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Tab" &&
                      !event.shiftKey &&
                      !createTopicState.codeOverridden &&
                      suggestTopicStableCode(createTopicState.title) &&
                      createTopicState.stableCode !== suggestTopicStableCode(createTopicState.title)
                    ) {
                      setCreateTopicState({
                        ...createTopicState,
                        stableCode: suggestTopicStableCode(createTopicState.title),
                      });
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  disabled={createTopicState.submitting}
                  aria-describedby="new-topic-code-suggestion"
                />
              </label>
              <p id="new-topic-code-suggestion" className="text-xs text-slate-500 sm:col-span-2">
                Suggested from the title. Press Tab to accept it and continue.
              </p>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Category (optional)</span>
                <input
                  value={createTopicState.category}
                  onChange={(event) =>
                    setCreateTopicState({ ...createTopicState, category: event.target.value })
                  }
                  placeholder="tools / concepts / skills"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  disabled={createTopicState.submitting}
                />
              </label>
            </div>
            {createTopicState.error ? (
              <p className="mt-3 text-sm text-rose-700">{createTopicState.error}</p>
            ) : null}
            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={createTopicState.submitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
              >
                {createTopicState.submitting ? "Creating..." : "Create topic"}
              </button>
              <button
                type="button"
                onClick={() => setCreateTopicState({ open: false })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <TopicBrowser
          buckets={topicBuckets}
          topicTitleById={topicTitleById}
          onSaveTopic={handleSaveTopic}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Activity types</h2>
            <p className="mt-1 text-sm text-slate-600">
              The instructor&apos;s label stays separate from the stable behavior family used by the product.
            </p>
          </div>
          {!createActivityTypeState.open ? (
            <button
              type="button"
              onClick={() =>
                setCreateActivityTypeState({
                  open: true,
                  label: "",
                  behaviorFamily: "meeting",
                  description: "",
                  submitting: false,
                  error: null,
                })
              }
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              New activity type
            </button>
          ) : null}
        </div>

        {createActivityTypeState.open ? (
          <form onSubmit={handleCreateActivityType} className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Activity type label</span>
              <input
                value={createActivityTypeState.label}
                onChange={(event) =>
                  setCreateActivityTypeState({ ...createActivityTypeState, label: event.target.value })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                required
                disabled={createActivityTypeState.submitting}
              />
            </label>
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Stable behavior family</span>
              <select
                value={createActivityTypeState.behaviorFamily}
                onChange={(event) =>
                  setCreateActivityTypeState({
                    ...createActivityTypeState,
                    behaviorFamily: event.target.value as "meeting" | "coursework" | "assessment",
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                disabled={createActivityTypeState.submitting}
              >
                <option value="meeting">meeting</option>
                <option value="coursework">coursework</option>
                <option value="assessment">assessment</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Description (optional)</span>
              <input
                value={createActivityTypeState.description}
                onChange={(event) =>
                  setCreateActivityTypeState({
                    ...createActivityTypeState,
                    description: event.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                disabled={createActivityTypeState.submitting}
              />
            </label>
            {createActivityTypeState.error ? (
              <p className="sm:col-span-3 text-sm text-rose-700">{createActivityTypeState.error}</p>
            ) : null}
            <div className="sm:col-span-3 flex gap-3">
              <button
                type="submit"
                disabled={createActivityTypeState.submitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
              >
                {createActivityTypeState.submitting ? "Creating..." : "Create activity type"}
              </button>
              <button
                type="button"
                onClick={() => setCreateActivityTypeState({ open: false })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {activityTypes.length === 0 ? (
          <div className="mt-4">
            <GapNotice title="No instructor activity types yet.">
              Create the first custom label, then reuse its historical versions as the course design grows.
            </GapNotice>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Stable behavior family</th>
                  <th className="px-3 py-2 font-medium">Version</th>
                </tr>
              </thead>
              <tbody>
                {activityTypes.map((activityType) => {
                  const versions = activityTypeVersionsById.get(activityType.id) ?? [];
                  const currentVersion =
                    versions.find((version) => version.id === activityType.currentVersionId) ??
                    versions[0] ??
                    null;

                  return (
                    <tr key={activityType.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {currentVersion?.label ?? "Untitled"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{activityType.behaviorFamily}</td>
                      <td className="px-3 py-2 text-slate-600">
                        Historical version {currentVersion?.revision ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RevisionHistoryPanel
        learningModules={learningModules}
        currentVersionsByLearningModuleId={currentVersionsByLearningModuleId}
        versionsByLearningModuleId={versionsByLearningModuleId}
        topicVersionsById={topicVersionsById}
        onRestoreVersion={handleRestoreVersion}
      />
    </div>
  );
}
