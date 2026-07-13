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

type CreateCourseState =
  | { open: false }
  | { open: true; title: string; number: string; description: string; submitting: boolean; error: string | null };

export default function CourseIndexPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [createState, setCreateState] = useState<CreateCourseState>({ open: false });
  const [refreshKey, setRefreshKey] = useState(0);

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
  }, [refreshKey]);

  async function handleCreateCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createState.open) return;
    setCreateState({ ...createState, submitting: true, error: null });
    try {
      await redesignApi.createCourse({
        title: createState.title || "New Course",
        titleIsPlaceholder: !createState.title,
        number: createState.number || "1XX",
        numberIsPlaceholder: !createState.number,
        description: createState.description || null,
      });
      setCreateState({ open: false });
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setCreateState({
        ...createState,
        submitting: false,
        error: err instanceof Error ? err.message : "Failed to create course.",
      });
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 rounded-3xl bg-slate-100" />
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="h-48 rounded-3xl bg-slate-100" />
          <div className="h-48 rounded-3xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm font-medium text-rose-800">Failed to load workspace</p>
        <p className="mt-1 text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-700">Course workspace</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Course-first planning
            </h1>
            <p className="mt-2 max-w-3xl text-base text-slate-600">
              Start from a course to design curriculum, then move into term setup, topic placement, revision history, and delivered-term review.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setCreateState({ open: true, title: "", number: "", description: "", submitting: false, error: null })
            }
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            New course
          </button>
        </div>
      </section>

      {/* Create course form */}
      {createState.open ? (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900">New course</h2>
          <p className="mt-1 text-sm text-slate-600">
            Title and number can be placeholders — mark them as such and update them later.
          </p>
          <form onSubmit={handleCreateCourse} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Course title</span>
              <input
                value={createState.title}
                onChange={(e) => setCreateState({ ...createState, title: e.target.value })}
                placeholder="Data Science Foundations (or leave blank for placeholder)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Course number</span>
              <input
                value={createState.number}
                onChange={(e) => setCreateState({ ...createState, number: e.target.value })}
                placeholder="DS 100 (or leave blank for 1XX placeholder)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>
            <label className="col-span-full text-sm text-slate-700">
              <span className="mb-1 block font-medium">Description (optional)</span>
              <textarea
                value={createState.description}
                onChange={(e) => setCreateState({ ...createState, description: e.target.value })}
                rows={2}
                placeholder="Brief description for context"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>
            {createState.error ? (
              <p className="col-span-full text-sm text-rose-700">{createState.error}</p>
            ) : null}
            <div className="col-span-full flex gap-3">
              <button
                type="submit"
                disabled={createState.submitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
              >
                {createState.submitting ? "Creating..." : "Create course"}
              </button>
              <button
                type="button"
                onClick={() => setCreateState({ open: false })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {/* Course list */}
      {courses.length === 0 ? (
        <GapNotice title="No courses yet.">Create your first course to begin planning.</GapNotice>
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
                      {course.numberIsPlaceholder ? (
                        <span className="text-slate-400">{course.number}</span>
                      ) : (
                        course.number
                      )}
                      {" · "}
                      {course.titleIsPlaceholder ? (
                        <span className="text-slate-400 italic">{course.title}</span>
                      ) : (
                        course.title
                      )}
                    </h2>
                    {course.description ? (
                      <p className="mt-1.5 max-w-2xl text-sm text-slate-600">{course.description}</p>
                    ) : null}
                  </div>
                  {course.numberIsPlaceholder || course.titleIsPlaceholder ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                      Placeholder fields
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {institutions.map((institution) => (
                    <span
                      key={institution.id}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {institution.shortName ?? institution.name}
                    </span>
                  ))}
                </div>

                <dl className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Modules</dt>
                    <dd className="mt-0.5 text-xl font-semibold text-slate-900">{learningModuleCount}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Topics</dt>
                    <dd className="mt-0.5 text-xl font-semibold text-slate-900">{topicCount}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Terms</dt>
                    <dd className="mt-0.5 text-xl font-semibold text-slate-900">{terms.length}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2 text-sm">
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
                    Course workspace
                  </Link>
                </div>

                {[...activeTerms, ...plannedTerms, ...closedTerms].length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {[...activeTerms, ...plannedTerms, ...closedTerms].slice(0, 3).map((term) => (
                      <Link
                        key={term.id}
                        href={`/terms/${term.id}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 hover:border-slate-300"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{term.name}</p>
                          <p className="text-xs text-slate-500">{term.code}</p>
                        </div>
                        <LifecycleBadge status={term.status} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">No terms created yet.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
