"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type { ActivityDto, ActivityVersionDto, Id, TopicDto, TopicVersionDto } from "@/lib/redesign-contract";
import { buildActivityBoardColumns, buildTopicFlow, moveActivityBoardCard, type ActivityBoardColumn } from "@/lib/redesign-workspace";

type Props = {
  courseId: Id;
  learningModules: Parameters<typeof buildActivityBoardColumns>[0]["learningModules"];
  currentVersionsByLearningModuleId: Parameters<typeof buildActivityBoardColumns>[0]["currentVersionsByLearningModuleId"];
  topics: TopicDto[];
  currentVersionsByTopicId: Map<Id, TopicVersionDto | null>;
  onMove?: (activityVersionId: Id, destination: ActivityBoardColumn["key"]) => Promise<void>;
};

export default function ActivityBoard(props: Props) {
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [versions, setVersions] = useState(new Map<Id, ActivityVersionDto | null>());
  const [actions, setActions] = useState(new Map<Id, Awaited<ReturnType<typeof redesignApi.listActivityTopicActions>>>());
  const [scopedVersionIds, setScopedVersionIds] = useState(new Set<Id>());
  const [selectedVersionId, setSelectedVersionId] = useState<Id | null>(null);
  const [draggedVersionId, setDraggedVersionId] = useState<Id | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const detailHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const focusDetailOnSelectRef = useRef(false);

  async function load() {
    try {
      const loadedActivities = await redesignApi.listCourseActivities(props.courseId);
      const details = await Promise.all(loadedActivities.map((activity) => redesignApi.getActivity(activity.id)));
      const nextVersions = new Map(details.map((detail) => [detail.activity.id, detail.currentVersion]));
      const nextActions = new Map<Id, Awaited<ReturnType<typeof redesignApi.listActivityTopicActions>>>();
      const nextScopedVersionIds = new Set<Id>();
      await Promise.all([...nextVersions.values()].filter((version): version is ActivityVersionDto => version !== null).map(async (version) => {
        const [topicActions, scopes] = await Promise.all([redesignApi.listActivityTopicActions(version.id), redesignApi.listActivityLmScope(version.id)]);
        nextActions.set(version.id, topicActions);
        if (scopes.length > 0) nextScopedVersionIds.add(version.id);
      }));
      setActivities(loadedActivities);
      setVersions(nextVersions);
      setActions(nextActions);
      setScopedVersionIds(nextScopedVersionIds);
    } catch {
      // The surrounding workspace remains useful while an activity endpoint is unavailable.
    }
  }
  const loadFromEffect = useEffectEvent(load);
  useEffect(() => { void loadFromEffect(); }, [props.courseId]);

  const columns = useMemo(() => {
    const built = buildActivityBoardColumns({
    learningModules: props.learningModules,
    currentVersionsByLearningModuleId: props.currentVersionsByLearningModuleId,
    activities,
    currentVersionsByActivityId: versions,
    });
    const unassigned = built.find((column) => column.key === "unassigned")!;
    const crossCutting = built.find((column) => column.key === "cross-cutting")!;
    const scopedUnassigned = unassigned.activityVersionIds.filter((id) => scopedVersionIds.has(id));
    return built.map((column) => column.key === "unassigned" ? { ...column, activityVersionIds: column.activityVersionIds.filter((id) => !scopedVersionIds.has(id)) } : column.key === "cross-cutting" ? { ...column, activityVersionIds: [...crossCutting.activityVersionIds, ...scopedUnassigned] } : column);
  }, [activities, props.currentVersionsByLearningModuleId, props.learningModules, scopedVersionIds, versions]);
  // The optimistic overlay is keyed to the columns snapshot it was applied on:
  // once an authoritative reload rebuilds the columns, stale moves are ignored
  // rather than replayed over fresh server state (which could misorder cards).
  const [pendingMoves, setPendingMoves] = useState<{
    base: ActivityBoardColumn[];
    entries: Array<{ activityVersionId: Id; destination: ActivityBoardColumn["key"] }>;
  } | null>(null);
  const displayColumns = useMemo(() => {
    if (!pendingMoves || pendingMoves.base !== columns) return columns;
    return pendingMoves.entries.reduce(
      (current, movement) => moveActivityBoardCard({ columns: current, activityVersionId: movement.activityVersionId, destinationKey: movement.destination }),
      columns,
    );
  }, [columns, pendingMoves]);
  const selected = [...versions.values()].find((version) => version?.id === selectedVersionId) ?? null;
  useEffect(() => {
    if (focusDetailOnSelectRef.current && selected) {
      detailHeadingRef.current?.focus();
      focusDetailOnSelectRef.current = false;
    }
  }, [selected]);
  const topicTitles = new Map(props.topics.map((topic) => [topic.currentVersionId, props.currentVersionsByTopicId.get(topic.id)?.title ?? topic.stableCode]));
  const flow = buildTopicFlow({ columns: displayColumns, activities, versionsByActivityId: versions, actionsByActivityVersionId: actions });

  async function move(activityVersionId: Id, destination: ActivityBoardColumn["key"]) {
    const next = moveActivityBoardCard({ columns: displayColumns, activityVersionId, destinationKey: destination });
    const destinationLabel = next.find((column) => column.key === destination)?.label ?? "destination";
    try {
      await props.onMove?.(activityVersionId, destination);
      setPendingMoves((current) =>
        current && current.base === columns
          ? { base: columns, entries: [...current.entries, { activityVersionId, destination }] }
          : { base: columns, entries: [{ activityVersionId, destination }] },
      );
      setAnnouncement(`Moved activity to ${destinationLabel}.`);
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : "Unable to move activity.");
    }
  }

  async function saveTopicAction(topicVersionId: Id, action: "introduced" | "practiced" | "assessed") {
    if (!selected) return;
    const current = actions.get(selected.id) ?? [];
    const exists = current.some((entry) => entry.topicVersionId === topicVersionId && entry.action === action);
    const replacement = exists
      ? current.filter((entry) => !(entry.topicVersionId === topicVersionId && entry.action === action))
      : [...current, { topicVersionId, action, notes: null }];
    const saved = await redesignApi.replaceActivityTopicActions(selected.id, replacement.map((entry) => ({ topicVersionId: entry.topicVersionId, action: entry.action, notes: entry.notes })));
    setActions((prior) => new Map(prior).set(selected.id, saved));
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="activity-board-heading">
    <div className="flex items-center justify-between gap-3"><div><h2 id="activity-board-heading" className="text-lg font-semibold text-slate-900">Activity board</h2><p className="mt-1 text-sm text-slate-600">Place meetings and coursework in modules; projects and exams can remain cross-cutting.</p></div></div>
    <p aria-live="polite" className="sr-only">{announcement}</p>
    <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
      {displayColumns.map((column) => <div key={column.key} className="w-64 shrink-0 rounded-xl bg-slate-50 p-3" onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedVersionId) void move(draggedVersionId, column.key); }}>
        <p className="text-sm font-semibold text-slate-800">{column.label}</p>
        <div className="mt-2 space-y-2">{column.activityVersionIds.map((versionId) => {
          const version = [...versions.values()].find((candidate) => candidate?.id === versionId);
          if (!version) return null;
          return <article key={versionId} draggable onDragStart={() => setDraggedVersionId(versionId)} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm focus-within:ring-2 focus-within:ring-sky-500">
            <button type="button" onClick={() => setSelectedVersionId(versionId)} className="w-full text-left"><span className="block text-sm font-medium text-slate-900">{version.title}</span><span className="block text-xs text-slate-500">{version.detail.behaviorFamily}</span></button>
            <label className="mt-2 block text-xs text-slate-600">Move to<select aria-label={`Move ${version.title} to`} className="ml-1 rounded border border-slate-300" value={column.key} onChange={(event) => void move(versionId, event.target.value as ActivityBoardColumn["key"])}>{displayColumns.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
          </article>;
        })}</div>
      </div>)}
    </div>
    {selected ? <aside className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4" aria-label="Activity detail">
      <h3 ref={detailHeadingRef} tabIndex={-1} className="font-semibold text-slate-900">{selected.title}</h3><p className="text-sm text-slate-600">Topic actions — select I, P, or A. Repetition is warned, never blocked.</p>
      <div className="mt-3 space-y-2">{props.topics.map((topic) => { const topicVersionId = topic.currentVersionId; if (!topicVersionId) return null; const occurrences = actions.get(selected.id)?.filter((entry) => entry.topicVersionId === topicVersionId) ?? []; return <div key={topic.id} className="flex flex-wrap items-center gap-2 text-sm"><span className="min-w-40 text-slate-800">{topicTitles.get(topicVersionId)}</span>{(["introduced", "practiced", "assessed"] as const).map((action) => <button key={action} type="button" aria-pressed={occurrences.some((entry) => entry.action === action)} onClick={() => void saveTopicAction(topicVersionId, action)} className="rounded border border-slate-300 px-2 py-1 text-xs aria-pressed:bg-slate-900 aria-pressed:text-white">{action[0]!.toUpperCase()}</button>)}{occurrences.flatMap((entry) => entry.siblings).map((sibling) => <button key={`${sibling.activityVersionId}-${sibling.action}`} type="button" onClick={() => { focusDetailOnSelectRef.current = true; setSelectedVersionId(sibling.activityVersionId); }} className="text-xs text-amber-700 underline">Also {sibling.action}: {sibling.activityStableCode}</button>)}</div>; })}</div>
    </aside> : null}
    <div className="mt-5 border-t border-slate-200 pt-4"><h3 className="font-semibold text-slate-900">Topic flow</h3><p className="text-sm text-slate-600">Derived from placed activity versions, not legacy Topic module ownership.</p><div className="mt-2 space-y-2">{props.topics.map((topic) => { const versionId = topic.currentVersionId; const occurrences = versionId ? flow.get(versionId) ?? [] : []; return <div key={topic.id} className="flex gap-2 text-sm"><span className="w-48 shrink-0 font-medium text-slate-800">{versionId ? topicTitles.get(versionId) : topic.stableCode}</span><span className={occurrences.length ? "text-slate-700" : "text-rose-700"}>{occurrences.length ? occurrences.map((item) => `${item.activityTitle} (${item.action[0]!.toUpperCase()})`).join(" → ") : "No activity placement"}</span></div>; })}</div></div>
  </section>;
}
