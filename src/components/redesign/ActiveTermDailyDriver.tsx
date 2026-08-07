"use client";

import { useMemo, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  Id,
  TermActivityDto,
  TermActivityRevisionDto,
  TermActivityRevisionPreviewRequest,
} from "@/lib/redesign-contract";
import { buildTermDailyDriver } from "@/lib/redesign-workspace";

type Props = {
  termActivities: TermActivityDto[];
  revisionsByTermActivityId: Record<
    Id,
    {
      planned: TermActivityRevisionDto | null;
      delivered: TermActivityRevisionDto | null;
    }
  >;
  today: string;
  learningModuleLabels: Map<Id, string>;
  topicLabels: Map<Id, string>;
  editable: boolean;
  onApplied: () => Promise<void>;
};

type Preview = {
  activity: TermActivityDto;
  request: TermActivityRevisionPreviewRequest;
  token: string;
  expected: Id | null;
  issues: string[];
  label: string;
};

function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toUtcIso(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function requestFromRevision(
  revision: TermActivityRevisionDto,
  changeReason: string,
): TermActivityRevisionPreviewRequest {
  return {
    title: revision.title,
    summary: revision.summary,
    changeReason,
    detail: revision.detail,
    topicActions: revision.topicActions.map(
      ({ topicVersionId, action, notes, provenance }) => ({
        topicVersionId,
        action,
        notes,
        provenance,
      }),
    ),
    milestones: revision.milestones.map(
      ({
        sourceTemplateId,
        role,
        label,
        linkedTermActivityId,
        occursAt,
        timeZone,
        anchorPolicy,
        notes,
        provenance,
      }) => ({
        sourceTemplateId,
        role,
        label,
        linkedTermActivityId,
        occursAt,
        timeZone,
        anchorPolicy,
        notes,
        provenance,
      }),
    ),
  };
}

export default function ActiveTermDailyDriver(props: Props) {
  const driver = useMemo(
    () =>
      buildTermDailyDriver({
        termActivities: props.termActivities,
        revisionsByTermActivityId: props.revisionsByTermActivityId,
        today: props.today,
      }),
    [props.termActivities, props.revisionsByTermActivityId, props.today],
  );
  const meeting = driver.nextMeeting;
  const nextMilestone = driver.nextMilestone;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const meetingTargetId = meeting?.activity.id ?? null;
  const milestoneTargetId = nextMilestone ? `${nextMilestone.activity.id}:${nextMilestone.milestoneIndex}` : null;
  const [moveStartsAt, setMoveStartsAt] = useState({ targetId: meetingTargetId, value: toLocalDateTimeInput(meeting?.revision.detail.behaviorFamily === "meeting" ? meeting.revision.detail.startsAt : null) });
  const [moveEndsAt, setMoveEndsAt] = useState({ targetId: meetingTargetId, value: toLocalDateTimeInput(meeting?.revision.detail.behaviorFamily === "meeting" ? meeting.revision.detail.endsAt : null) });
  const [milestoneOccursAt, setMilestoneOccursAt] = useState({ targetId: milestoneTargetId, value: toLocalDateTimeInput(nextMilestone?.occursAt) });
  if (moveStartsAt.targetId !== meetingTargetId) setMoveStartsAt({ targetId: meetingTargetId, value: toLocalDateTimeInput(meeting?.revision.detail.behaviorFamily === "meeting" ? meeting.revision.detail.startsAt : null) });
  if (moveEndsAt.targetId !== meetingTargetId) setMoveEndsAt({ targetId: meetingTargetId, value: toLocalDateTimeInput(meeting?.revision.detail.behaviorFamily === "meeting" ? meeting.revision.detail.endsAt : null) });
  if (milestoneOccursAt.targetId !== milestoneTargetId) setMilestoneOccursAt({ targetId: milestoneTargetId, value: "" });
  const [topicAction, setTopicAction] = useState<
    "introduced" | "practiced" | "assessed"
  >("practiced");
  const [selectedTopicActionVersionId, setSelectedTopicActionVersionId] = useState(meeting?.revision.topicActions[0]?.topicVersionId ?? "");
  const [selectedTopicAction, setSelectedTopicAction] = useState<"introduced" | "practiced" | "assessed">(meeting?.revision.topicActions[0]?.action ?? "practiced");
  const [topicVersionId, setTopicVersionId] = useState("");
  const selectedTopicActionEntry = meeting?.revision.topicActions.find((action) => action.topicVersionId === selectedTopicActionVersionId && action.action === selectedTopicAction);

  async function previewCorrection(
    activity: TermActivityDto,
    request: TermActivityRevisionPreviewRequest,
    label: string,
  ) {
    try {
      setError(null);
      const response = await redesignApi.previewTermActivityRevision(
        activity.id,
        request,
      );
      setPreview({
        activity,
        request,
        token: response.previewToken,
        expected: response.expectedCurrentRevisionId,
        issues: response.impact.issues.map((issue) => issue.message),
        label,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to preview correction.",
      );
    }
  }

  async function applyPreview() {
    if (!preview) return;
    try {
      setError(null);
      const response = await redesignApi.applyTermActivityRevision(
        preview.activity.id,
        {
          ...preview.request,
          previewToken: preview.token,
          expectedCurrentRevisionId: preview.expected,
          advancePointer: "delivered",
        },
      );
      setPreview(null);
      setAnnouncement(`${preview.label} applied: ${response.revision.title}.`);
      await props.onApplied();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to apply correction.",
      );
    }
  }

  function previewCancellation() {
    if (!meeting || meeting.revision.detail.behaviorFamily !== "meeting")
      return;
    const request = requestFromRevision(
      meeting.revision,
      "Canceled during delivery.",
    );
    request.detail = { ...meeting.revision.detail, status: "canceled" };
    void previewCorrection(meeting.activity, request, "Delivery correction");
  }

  function previewMove() {
    if (
      !meeting ||
      meeting.revision.detail.behaviorFamily !== "meeting" ||
      !moveStartsAt.value
    )
      return;
    const request = requestFromRevision(
      meeting.revision,
      "Meeting moved during delivery.",
    );
    const startsAt = toUtcIso(moveStartsAt.value);
    const endsAt = toUtcIso(moveEndsAt.value || toLocalDateTimeInput(meeting.revision.detail.endsAt));
    if (!startsAt || !endsAt) {
      setError("Enter valid meeting start and end times.");
      return;
    }
    request.detail = {
      ...meeting.revision.detail,
      startsAt,
      endsAt,
    };
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setError("The moved meeting must end after it starts.");
      return;
    }
    void previewCorrection(meeting.activity, request, "Meeting move");
  }

  function previewMilestoneChange() {
    if (!nextMilestone || !milestoneOccursAt.value) return;
    const request = requestFromRevision(
      nextMilestone.revision,
      "Milestone anchor changed during delivery.",
    );
    const occursAt = toUtcIso(milestoneOccursAt.value);
    if (!occursAt) {
      setError("Enter a valid milestone time.");
      return;
    }
    request.milestones = request.milestones?.map((milestone, milestoneIndex) =>
      milestoneIndex === nextMilestone.milestoneIndex
        ? { ...milestone, occursAt }
        : milestone,
    );
    void previewCorrection(
      nextMilestone.activity,
      request,
      "Milestone correction",
    );
  }

  function previewTopicChange(remove = false) {
    if (!meeting) return;
    const request = requestFromRevision(
      meeting.revision,
      "Delivered Topic action changed.",
    );
    const existing = request.topicActions?.find(
      (action) => action.topicVersionId === selectedTopicActionEntry?.topicVersionId && action.action === selectedTopicActionEntry?.action,
    );
    if (existing && remove)
      request.topicActions = request.topicActions?.filter(
        (action) => !(action.topicVersionId === selectedTopicActionEntry?.topicVersionId && action.action === selectedTopicActionEntry?.action),
      );
    else if (existing)
      request.topicActions = request.topicActions?.map((action) =>
          action.topicVersionId === selectedTopicActionEntry?.topicVersionId && action.action === selectedTopicActionEntry?.action
          ? { ...action, action: topicAction }
          : action,
      );
    void previewCorrection(
      meeting.activity,
      request,
      "Topic-action correction",
    );
  }

  function previewTopicAddition() {
    if (!meeting || !topicVersionId) return;
    const request = requestFromRevision(
      meeting.revision,
      "Delivered Topic action added.",
    );
    request.topicActions = [
      ...(request.topicActions ?? []),
      { topicVersionId, action: topicAction, notes: null, provenance: null },
    ];
    void previewCorrection(
      meeting.activity,
      request,
      "Topic-action correction",
    );
  }

  return (
    <section
      className="rounded-3xl border border-sky-200 bg-white p-6 shadow-sm"
      aria-labelledby="daily-driver-heading"
    >
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-sky-700">
            Today’s teaching run
          </p>
          <h2
            id="daily-driver-heading"
            className="text-2xl font-semibold text-slate-950"
          >
            Active Term daily driver
          </h2>
        </div>
        {!props.editable ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            Read-only Term
          </span>
        ) : null}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-sky-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-800">
            Next meeting
          </p>
          {meeting ? (
            <>
              <p className="mt-2 font-semibold text-slate-950">
                {meeting.revision.title}
              </p>
              <p className="text-sm text-slate-600">
                {meeting.revision.detail.behaviorFamily === "meeting"
                  ? meeting.revision.detail.startsAt
                  : ""}{" "}
                · meeting {meeting.meetingOrdinal} of {driver.totalMeetings}
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {meeting.revision.summary || "No preparation notes recorded."}
              </p>
              {props.editable ? (
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={previewCancellation}
                    className="text-sm font-medium text-sky-800 underline"
                  >
                    Preview cancellation
                  </button>
                  <label className="block text-xs text-slate-600">
                    Current Topic action
                    <select
                      aria-label="Current Topic action"
                      value={selectedTopicActionEntry?.id ?? ""}
                      onChange={(event) => {
                        const selected = meeting.revision.topicActions.find((action) => action.id === event.target.value);
                        if (selected) {
                          setSelectedTopicActionVersionId(selected.topicVersionId);
                          setSelectedTopicAction(selected.action);
                        }
                      }}
                      className="ml-2 rounded border border-slate-300 p-1"
                    >
                      {meeting.revision.topicActions.map((action) => (
                        <option key={action.id} value={action.id}>
                          {props.topicLabels.get(action.topicVersionId) ?? action.topicVersionId} ({action.action})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-slate-600">
                    Move start
                    <input
                      aria-label="Move meeting start"
                      type="datetime-local"
                      value={moveStartsAt.value}
                      onChange={(event) => setMoveStartsAt({ targetId: meetingTargetId, value: event.target.value })}
                      className="ml-2 rounded border border-slate-300 p-1"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    Move end
                    <input
                      aria-label="Move meeting end"
                      type="datetime-local"
                      value={moveEndsAt.value}
                      onChange={(event) => setMoveEndsAt({ targetId: meetingTargetId, value: event.target.value })}
                      className="ml-2 rounded border border-slate-300 p-1"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={previewMove}
                    className="text-sm font-medium text-sky-800 underline"
                  >
                    Preview move
                  </button>
                  <label className="block text-xs text-slate-600">
                    Delivered Topic action
                    <select
                      aria-label="Delivered Topic action"
                      value={topicAction}
                      onChange={(event) =>
                        setTopicAction(event.target.value as typeof topicAction)
                      }
                      className="ml-2 rounded border border-slate-300 p-1"
                    >
                      <option value="introduced">Introduced</option>
                      <option value="practiced">Practiced</option>
                      <option value="assessed">Assessed</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => previewTopicChange()}
                    disabled={!meeting.revision.topicActions.length}
                    className="text-sm font-medium text-sky-800 underline"
                  >
                    Preview Topic action
                  </button>
                  <button
                    type="button"
                    onClick={() => previewTopicChange(true)}
                    disabled={!meeting.revision.topicActions.length}
                    className="text-sm font-medium text-sky-800 underline"
                  >
                    Preview remove Topic action
                  </button>
                  <label className="block text-xs text-slate-600">
                    Add Topic action
                    <select
                      aria-label="Add Topic action"
                      value={topicVersionId}
                      onChange={(event) =>
                        setTopicVersionId(event.target.value)
                      }
                      className="ml-2 rounded border border-slate-300 p-1"
                    >
                      <option value="">Choose a Topic</option>
                      {[...props.topicLabels.entries()].map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={previewTopicAddition}
                    className="text-sm font-medium text-sky-800 underline"
                  >
                    Preview add Topic action
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              No future meeting is scheduled.
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Next due or release
          </p>
          {nextMilestone ? (
            <>
              <p className="mt-2 font-semibold text-slate-950">
                {nextMilestone.label}
              </p>
              <p className="text-sm text-slate-600">{nextMilestone.occursAt}</p>
              {props.editable ? (
                <>
                  <label className="mt-3 block text-xs text-slate-600">
                    Milestone time
                    <input
                      aria-label="Milestone time"
                      type="datetime-local"
                      value={milestoneOccursAt.value}
                      onChange={(event) => setMilestoneOccursAt({ targetId: milestoneTargetId, value: event.target.value })}
                      className="ml-2 rounded border border-slate-300 p-1"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={previewMilestoneChange}
                    className="mt-2 text-sm font-medium text-sky-800 underline"
                  >
                    Preview milestone change
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              No upcoming milestone is anchored.
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Current learning module
          </p>
          <p className="mt-2 font-semibold text-slate-950">
            {driver.currentLearningModuleId
              ? (props.learningModuleLabels.get(
                  driver.currentLearningModuleId,
                ) ?? "Adopted learning module")
              : "Cross-cutting or unassigned"}
          </p>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
            Active topics
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {driver.activeTopicVersionIds.length
              ? driver.activeTopicVersionIds
                  .map((id) => props.topicLabels.get(id) ?? id)
                  .join(", ")
              : "No Topic actions recorded."}
          </p>
        </div>
      </div>
      {driver.changedActivityIds.length ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {driver.changedActivityIds.length === 1
            ? "One activity has"
            : `${driver.changedActivityIds.length} activities have`}{" "}
          changed from plan; delivery history is shown in the revision record.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      {preview ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="font-semibold text-slate-900">
            Review delivery correction
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            {preview.label} will create a new delivered revision; the plan
            remains unchanged.
          </p>
          {preview.issues.map((issue) => (
            <p key={issue} className="mt-1 text-sm text-amber-900">
              {issue}
            </p>
          ))}
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => void applyPreview()}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              Apply correction
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Keep editing
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
