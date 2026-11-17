"use client";
import { useEffect, useState } from "react";
import type {
  CourseEffortSizeDto,
  ListTermActivitiesResponse,
} from "@/lib/redesign-contract";
import { redesignApi } from "@/lib/redesign-api-client";
import { effectiveEffort } from "@/lib/effort";
import EffortSummary from "./EffortSummary";
import TermEffortEditor from "./TermEffortEditor";
export default function TermActivityEffortList({
  courseId,
  activities,
  revisions,
  status,
  onApplied,
}: {
  courseId: string;
  activities: ListTermActivitiesResponse["termActivities"];
  revisions: NonNullable<
    ListTermActivitiesResponse["revisionsByTermActivityId"]
  >;
  status: "planned" | "active" | "closed";
  onApplied: () => Promise<void>;
}) {
  const [sizes, setSizes] = useState<CourseEffortSizeDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    redesignApi
      .listCourseEffortSizes(courseId)
      .then((rows) => {
        if (active) setSizes(rows);
      })
      .catch((caught: Error) => {
        if (active) setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, [courseId]);
  return (
    <section
      aria-label="Term student effort"
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h2 className="text-lg font-semibold text-slate-900">Student effort</h2>
      {error ? (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {activities.map((activity) => {
        const pins = revisions[activity.id];
        const revision = pins?.delivered ?? pins?.planned;
        if (!revision || revision.detail.behaviorFamily === "meeting")
          return null;
        const range =
          revision.effectiveEffort ??
          effectiveEffort(revision.baseEffort, revision.detail);
        return (
          <article
            key={activity.id}
            className="mt-4 border-t border-slate-200 pt-4"
          >
            <h3 className="font-medium text-slate-900">{revision.title}</h3>
            <EffortSummary range={range} sizes={sizes} />
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-sky-800">
                Estimate and Term override
              </summary>
              <TermEffortEditor
                key={revision.id}
                revision={revision}
                editable={status !== "closed"}
                advancePointer={status === "active" ? "delivered" : "planned"}
                onApplied={onApplied}
              />
            </details>
          </article>
        );
      })}
    </section>
  );
}
