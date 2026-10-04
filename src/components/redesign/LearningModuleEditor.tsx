"use client";

import { useEffect, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type {
  ActivityVersionDto,
  Id,
  LearningModuleVersionDto,
  UpsertLearningModuleVersionRequest,
} from "@/lib/redesign-contract";

type Props = {
  courseId: Id;
  stableCode: string;
  version: LearningModuleVersionDto;
  onSave: (input: UpsertLearningModuleVersionRequest) => Promise<void>;
  onCancel: () => void;
};

export default function LearningModuleEditor({
  courseId,
  stableCode,
  version,
  onSave,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(version.title);
  const [description, setDescription] = useState(version.description ?? "");
  const [studentDescription, setStudentDescription] = useState(
    version.studentDescription ?? "",
  );
  const [objectives, setObjectives] = useState(
    version.learningObjectives.join("\n"),
  );
  const [notes, setNotes] = useState(version.notes ?? "");
  const [sequence, setSequence] = useState(
    version.defaultSequence?.toString() ?? "",
  );
  const [changeSummary, setChangeSummary] = useState("");
  const [members, setMembers] = useState(() =>
    [...(version.activities ?? [])].sort((a, b) => a.sequence - b.sequence),
  );
  const [activityVersions, setActivityVersions] = useState<
    ActivityVersionDto[]
  >([]);
  const [candidateIds, setCandidateIds] = useState<Id[]>([]);
  const [addId, setAddId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const activities = await redesignApi.listCourseActivities(courseId);
        const details = await Promise.all(
          activities
            .filter((activity) => !activity.archivedAt)
            .map((activity) => redesignApi.getActivity(activity.id)),
        );
        const current = details.flatMap((detail) =>
          detail.currentVersion ? [detail.currentVersion] : [],
        );
        const pinned = await Promise.all(
          (version.activities ?? [])
            .filter(
              (member) =>
                !current.some((item) => item.id === member.activityVersionId),
            )
            .map((member) =>
              redesignApi.getActivityVersion(member.activityVersionId),
            ),
        );
        if (active) {
          setActivityVersions([...current, ...pinned]);
          setCandidateIds(current.map((item) => item.id));
        }
      } catch (caught) {
        if (active)
          setLoadError(
            caught instanceof Error
              ? caught.message
              : "Unable to load activities.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [courseId, version]);

  function move(index: number, delta: number) {
    setMembers((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
      return next;
    });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading || loadError) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        expectedCurrentVersionId: version.id,
        title: title.trim(),
        description: description || null,
        studentDescription: studentDescription || null,
        learningObjectives: objectives
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        notes: notes || null,
        defaultSequence: sequence === "" ? null : Number(sequence),
        changeSummary: changeSummary || null,
        activities: members.map((member, index) => ({
          ...member,
          sequence: index,
        })),
        publish: false,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save learning module.",
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2";
  return (
    <form
      onSubmit={save}
      aria-label="Learning module editor"
      className="mt-4 rounded-2xl border border-sky-200 bg-white p-5"
    >
      <h3 className="text-lg font-semibold">
        Edit learning module · {stableCode}
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Revision {version.revision} ·{" "}
        {version.publishedAt ? "Published" : "Draft"}. Saving creates a new
        draft version. Existing Term pins stay unchanged.
      </p>
      {version.changeSummary ? (
        <p className="mt-1 text-sm text-slate-600">
          Last change: {version.changeSummary}
        </p>
      ) : null}
      <fieldset disabled={saving} className="mt-4 space-y-4">
        <label className="block text-sm">
          Module title
          <input
            autoFocus
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          Student description
          <textarea
            value={studentDescription}
            onChange={(event) => setStudentDescription(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          Learning objectives (one per line)
          <textarea
            rows={4}
            value={objectives}
            onChange={(event) => setObjectives(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          Planning notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          Default sequence
          <input
            type="number"
            step="1"
            value={sequence}
            onChange={(event) => setSequence(event.target.value)}
            className={inputClass}
          />
        </label>
        <fieldset disabled={loading || !!loadError} className="space-y-3">
          <legend className="font-medium">Activities in order</legend>
          {loading ? <p>Loading activities…</p> : null}
          {members.length === 0 ? (
            <p className="text-sm text-slate-600">
              No activities in this module.
            </p>
          ) : null}
          <ol className="space-y-2">
            {members.map((member, index) => {
              const activity = activityVersions.find(
                (item) => item.id === member.activityVersionId,
              );
              const label = activity?.title ?? "Loading activity";
              return (
                <li
                  key={member.activityVersionId}
                  className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
                >
                  <span className="min-w-0 flex-1 break-words">
                    {label}
                    {activity ? ` · rev. ${activity.revision}` : ""}
                  </span>
                  <button
                    type="button"
                    aria-label={`Move ${label} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded border px-2 py-1 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${label} down`}
                    disabled={index === members.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded border px-2 py-1 disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    onClick={() =>
                      setMembers((current) =>
                        current.filter(
                          (item) =>
                            item.activityVersionId !== member.activityVersionId,
                        ),
                      )
                    }
                    className="rounded border px-2 py-1"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ol>
          <label className="block text-sm">
            Add activity
            <select
              value={addId}
              onChange={(event) => setAddId(event.target.value)}
              className={inputClass}
            >
              <option value="">Choose an activity version</option>
              {activityVersions
                .filter(
                  (candidate) =>
                    candidateIds.includes(candidate.id) &&
                    !members.some(
                      (member) =>
                        activityVersions.find(
                          (item) => item.id === member.activityVersionId,
                        )?.activityId === candidate.activityId,
                    ),
                )
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title} · rev. {candidate.revision}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!addId}
            onClick={() => {
              setMembers((current) => [
                ...current,
                {
                  activityVersionId: addId,
                  sequence: current.length,
                  notes: null,
                },
              ]);
              setAddId("");
            }}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Add activity
          </button>
        </fieldset>
        <label className="block text-sm">
          Change summary
          <textarea
            value={changeSummary}
            onChange={(event) => setChangeSummary(event.target.value)}
            className={inputClass}
          />
        </label>
        {loadError || error ? (
          <p role="alert" className="text-sm text-rose-700">
            {loadError ?? error}
          </p>
        ) : null}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !!loadError || !title.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save new version"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-4 py-2"
          >
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
