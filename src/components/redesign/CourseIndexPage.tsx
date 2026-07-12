"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import type { CourseDto, InstitutionDto, TermDto } from "@/lib/redesign-contract";
import { redesignApi } from "@/lib/redesign-api-client";
import GapNotice from "./GapNotice";
import LifecycleBadge from "./LifecycleBadge";

type CourseSummary = {
  course: CourseDto;
  institutions: InstitutionDto[];
  terms: TermDto[];
  learningModuleCount: number;
  topicCount: number;
};

export default function CourseIndexPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);

  const load = useEffectEvent(async () => {
    setLoading(true);
    setError(null);
    try {
      const listedCourses = await redesignApi.listCourses();
      const summaries = await Promise.all(
        listedCourses.map(async (course) => {
          const [institutions, terms, learningModules, topics] = await Promise.all([
            redesignApi.listCourseInstitutions(course.id),
            redesignApi.listTerms(course.id),
            redesignApi.listLearningModules(course.id),
            redesignApi.listTopics(course.id),
          ]);
          return {
            course,
            institutions,
            terms,
            learningModuleCount: learningModules.length,
            topicCount: topics.length,
          };
        }),
      );
      setCourses(summaries);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load courses.");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading workspace...</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-700">Phase B Lane C workspace</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
          Course-first planning with revision history and delivered-term context.
        </h1>
        <p className="mt-3 max-w-3xl text-base text-slate-600">
          Start from a course, then move into term setup, topic placement, revision history, and delivered-term review.
          This slice stays on the frozen contract and uses typed mocks until Lane A lands real handlers.
        </p>
      </section>

      {courses.length === 0 ? (
        <GapNotice title="No courses yet.">Create a course once Lane A exposes the canonical handlers.</GapNotice>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {courses.map(({ course, institutions, terms, learningModuleCount, topicCount }) => {
            const activeTerms = terms.filter((term) => term.status === "active");
            const plannedTerms = terms.filter((term) => term.status === "planned");
            const closedTerms = terms.filter((term) => term.status === "closed");

            return (
              <article key={course.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-slate-500">{course.shortId}</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                      {course.number} · {course.title}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-slate-600">
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
                    <span
                      key={institution.id}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {institution.shortName ?? institution.name}
                    </span>
                  ))}
                </div>

                <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Learning modules</dt>
                    <dd className="mt-1 text-2xl font-semibold text-slate-900">{learningModuleCount}</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Topics</dt>
                    <dd className="mt-1 text-2xl font-semibold text-slate-900">{topicCount}</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Terms</dt>
                    <dd className="mt-1 text-2xl font-semibold text-slate-900">{terms.length}</dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap gap-2 text-sm">
                  {activeTerms[0] ? (
                    <Link
                      href={`/terms/${activeTerms[0].id}`}
                      className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
                    >
                      Open active term
                    </Link>
                  ) : null}
                  <Link
                    href={`/courses/${course.id}`}
                    className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700"
                  >
                    Open course workspace
                  </Link>
                </div>

                <div className="mt-5 space-y-3">
                  {[...activeTerms, ...plannedTerms, ...closedTerms].slice(0, 3).map((term) => (
                    <Link
                      key={term.id}
                      href={`/terms/${term.id}`}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 hover:border-slate-300"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{term.name}</p>
                        <p className="text-sm text-slate-600">{term.code}</p>
                      </div>
                      <LifecycleBadge status={term.status} />
                    </Link>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
