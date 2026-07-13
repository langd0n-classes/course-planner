"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  AcademicCalendarDto,
  Id,
  LearningModuleDto,
  LearningModuleVersionDto,
  TermDto,
  TopicVersionDto,
} from "@/lib/redesign-contract";
import { buildTopicBrowserBuckets } from "@/lib/redesign-workspace";
import CreateTermPanel from "./CreateTermPanel";
import GapNotice from "./GapNotice";
import LifecycleBadge from "./LifecycleBadge";
import RevisionHistoryPanel from "./RevisionHistoryPanel";
import TopicBrowser from "./TopicBrowser";

type Props = {
  courseId: string;
};

export default function CourseWorkspacePage({ courseId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingTerm, setSubmittingTerm] = useState(false);
  const [course, setCourse] = useState<Awaited<ReturnType<typeof redesignApi.getCourse>> | null>(null);
  const [institutions, setInstitutions] = useState<Awaited<ReturnType<typeof redesignApi.listCourseInstitutions>>>([]);
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

  async function loadWorkspace() {
    setLoading(true);
    setError(null);
    try {
      const [loadedCourse, loadedInstitutions, loadedTerms, loadedLearningModules, loadedTopics, loadedPrerequisites] =
        await Promise.all([
          redesignApi.getCourse(courseId),
          redesignApi.listCourseInstitutions(courseId),
          redesignApi.listTerms(courseId),
          redesignApi.listLearningModules(courseId),
          redesignApi.listTopics(courseId),
          redesignApi.listTopicPrerequisites(courseId),
        ]);

      const [moduleDetails, moduleVersions, topicDetails, institutionCalendars] = await Promise.all([
        Promise.all(loadedLearningModules.map((learningModule) => redesignApi.getLearningModule(learningModule.id))),
        Promise.all(loadedLearningModules.map((learningModule) => redesignApi.listLearningModuleVersions(learningModule.id))),
        Promise.all(loadedTopics.map((topic) => redesignApi.getTopic(topic.id))),
        Promise.all(loadedInstitutions.map((institution) => redesignApi.listAcademicCalendars(institution.id))),
      ]);

      const nextCurrentLearningModuleVersions = new Map<Id, LearningModuleVersionDto | null>();
      for (const detail of moduleDetails) {
        nextCurrentLearningModuleVersions.set(detail.learningModule.id, detail.currentVersion);
      }

      const nextVersionsByLearningModuleId = new Map<Id, LearningModuleVersionDto[]>();
      for (const versions of moduleVersions) {
        if (versions[0]) {
          nextVersionsByLearningModuleId.set(versions[0].learningModuleId, versions);
        }
      }

      const nextCurrentTopicVersions = new Map<Id, TopicVersionDto | null>();
      const neededTopicVersionIds = new Set<Id>();
      for (const detail of topicDetails) {
        nextCurrentTopicVersions.set(detail.topic.id, detail.currentVersion);
        if (detail.currentVersion) neededTopicVersionIds.add(detail.currentVersion.id);
      }
      for (const versions of nextVersionsByLearningModuleId.values()) {
        for (const version of versions) {
          for (const topic of version.topics) {
            neededTopicVersionIds.add(topic.topicVersionId);
          }
        }
      }

      const loadedTopicVersions = await Promise.all(
        [...neededTopicVersionIds].map((topicVersionId) => redesignApi.getTopicVersion(topicVersionId)),
      );
      const nextTopicVersionsById = new Map<Id, TopicVersionDto>();
      for (const topicVersion of loadedTopicVersions) {
        nextTopicVersionsById.set(topicVersion.id, topicVersion);
      }

      setCourse(loadedCourse);
      setInstitutions(loadedInstitutions);
      setCalendars(institutionCalendars.flat());
      setTerms(loadedTerms.slice().sort((left, right) => left.startDate.localeCompare(right.startDate)));
      setLearningModules(loadedLearningModules);
      setCurrentVersionsByLearningModuleId(nextCurrentLearningModuleVersions);
      setVersionsByLearningModuleId(nextVersionsByLearningModuleId);
      setTopics(loadedTopics);
      setCurrentVersionsByTopicId(nextCurrentTopicVersions);
      setTopicVersionsById(nextTopicVersionsById);
      setPrerequisites(loadedPrerequisites);
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

  async function handleCreateTerm(request: {
    institutionId: Id;
    academicCalendarId: Id;
    code: string;
    name: string;
    startDate: string;
    endDate: string;
    meetingPattern?: unknown | null;
  }) {
    setSubmittingTerm(true);
    try {
      await redesignApi.createTerm({ ...request, courseId });
      await loadWorkspace();
    } finally {
      setSubmittingTerm(false);
    }
  }

  async function handleAssignTopic(topicId: Id, learningModuleId: Id | null) {
    await redesignApi.assignTopicLearningModule(topicId, learningModuleId);
    await loadWorkspace();
  }

  async function handleSavePrerequisites(topicId: Id, prerequisiteTopicIds: Id[]) {
    await redesignApi.replaceTopicPrerequisites(topicId, prerequisiteTopicIds);
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

  if (loading) {
    return <p className="text-sm text-slate-600">Loading course workspace...</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }

  if (!course) {
    return <p className="text-sm text-rose-700">Course not found.</p>;
  }

  const activeTerms = terms.filter((term) => term.status === "active");
  const plannedTerms = terms.filter((term) => term.status === "planned");
  const closedTerms = terms.filter((term) => term.status === "closed");

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm font-medium text-sky-700">
          Back to courses
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">{course.shortId}</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">
              {course.number} · {course.title}
            </h1>
            <p className="mt-2 max-w-3xl text-base text-slate-600">
              {course.description ?? "No course description yet."}
            </p>
          </div>
          {course.numberIsPlaceholder ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
              Placeholder number
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {institutions.map((institution) => (
            <span key={institution.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {institution.shortName ?? institution.name}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(21rem,0.95fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Terms</h2>
              <p className="mt-1 text-sm text-slate-600">
                New terms must name an institution and shared academic calendar up front.
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
                className="rounded-2xl border border-slate-200 px-4 py-3 hover:border-slate-300"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{term.name}</p>
                    <p className="text-sm text-slate-600">
                      {term.code} · {term.startDate} to {term.endDate}
                    </p>
                  </div>
                  <LifecycleBadge status={term.status} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {term.status === "closed"
                    ? "Historical term: delivered snapshot is read-only."
                    : term.status === "active"
                      ? "Active term: delivered edits create immutable revisions."
                      : "Planned term: activate when delivery begins."}
                </p>
              </Link>
            ))}
            {terms.length === 0 ? (
              <GapNotice title="No terms yet.">Create the first term from this course workspace.</GapNotice>
            ) : null}
          </div>
        </div>

        <CreateTermPanel
          institutions={institutions}
          calendars={calendars}
          submitting={submittingTerm}
          onSubmit={handleCreateTerm}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Topic-first browser</h2>
          <p className="mt-1 text-sm text-slate-600">
            Topics are the planning atoms here. Unassigned topics stay visible until they have a learning module home,
            and prerequisite edits stay at the course level.
          </p>
        </div>
        <TopicBrowser
          buckets={topicBuckets}
          learningModules={learningModules}
          topicTitleById={topicTitleById}
          onAssignTopic={handleAssignTopic}
          onSavePrerequisites={handleSavePrerequisites}
        />
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
