"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { redesignApi } from "@/lib/redesign-api-client";
import type { ActivityDto, ActivityVersionDto, ActivityVersionLearningModuleScopeDto, Id, TopicDto, TopicVersionDto } from "@/lib/redesign-contract";
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
  const [scopesByVersionId, setScopesByVersionId] = useState(new Map<Id, ActivityVersionLearningModuleScopeDto[]>());
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
      const nextScopes = new Map<Id, ActivityVersionLearningModuleScopeDto[]>();
      await Promise.all([...nextVersions.values()].filter((version): version is ActivityVersionDto => version !== null).map(async (version) => {
        const [topicActions, scopes] = await Promise.all([redesignApi.listActivityTopicActions(version.id), redesignApi.listActivityLmScope(version.id)]);
        nextActions.set(version.id, topicActions);
        nextScopes.set(version.id, scopes);
        if (scopes.length > 0) nextScopedVersionIds.add(version.id);
      }));
      setActivities(loadedActivities);
      setVersions(nextVersions);
      setActions(nextActions);
      setScopedVersionIds(nextScopedVersionIds);
      setScopesByVersionId(nextScopes);
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
  const selectedScopes = selected ? scopesByVersionId.get(selected.id) ?? [] : [];
  const [newScopeLearningModuleId, setNewScopeLearningModuleId] = useState("");
  const [newScopeEmphasis, setNewScopeEmphasis] = useState("");
  const [newScopeNotes, setNewScopeNotes] = useState("");
  const availableScopeModules = props.learningModules.filter((module) => !selectedScopes.some((scope) => scope.learningModuleId === module.id));

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

  async function saveScopes(nextScopes: Array<{ learningModuleId: Id; emphasis?: string | null; notes?: string | null }>) {
    if (!selected) return;
    try {
      const saved = await redesignApi.replaceActivityLmScope(selected.id, nextScopes);
      setScopesByVersionId((prior) => new Map(prior).set(selected.id, saved));
      setScopedVersionIds((prior) => {
        const next = new Set(prior);
        if (saved.length) next.add(selected.id); else next.delete(selected.id);
        return next;
      });
      setAnnouncement(saved.length ? "Learning-module scope saved." : "Learning-module scope removed.");
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : "Unable to save learning-module scope.");
    }
  }

  async function addScope() {
    if (!newScopeLearningModuleId) return;
    await saveScopes([...selectedScopes.map((scope) => ({ learningModuleId: scope.learningModuleId, emphasis: scope.emphasis, notes: scope.notes })), { learningModuleId: newScopeLearningModuleId, emphasis: newScopeEmphasis || null, notes: newScopeNotes || null }]);
    setNewScopeLearningModuleId("");
    setNewScopeEmphasis("");
    setNewScopeNotes("");
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
      <section className="mt-5 border-t border-sky-200 pt-4" aria-labelledby="learning-module-scope-heading">
        <h4 id="learning-module-scope-heading" className="font-semibold text-slate-900">Learning-module scope</h4>
        <p className="mt-1 text-sm text-slate-600">Scopes make an activity cross-cutting across learning modules.</p>
        {selectedScopes.length ? <ul className="mt-2 space-y-2">{selectedScopes.map((scope) => { const learningModule = props.learningModules.find((candidate) => candidate.id === scope.learningModuleId); const title = props.currentVersionsByLearningModuleId.get(scope.learningModuleId)?.title ?? learningModule?.stableCode ?? scope.learningModuleId; return <li key={scope.id} className="flex items-start justify-between gap-2 rounded border border-sky-200 bg-white p-2 text-sm"><span><span className="font-medium text-slate-800">{title}</span>{scope.emphasis ? <span className="block text-slate-600">Emphasis: {scope.emphasis}</span> : null}{scope.notes ? <span className="block text-slate-600">Notes: {scope.notes}</span> : null}</span><button type="button" aria-label={`Remove ${title} learning-module scope`} onClick={() => void saveScopes(selectedScopes.filter((entry) => entry.id !== scope.id).map((entry) => ({ learningModuleId: entry.learningModuleId, emphasis: entry.emphasis, notes: entry.notes })))} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Remove</button></li>; })}</ul> : <p className="mt-2 text-sm text-slate-600">No learning-module scopes yet.</p>}
        <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-sm text-slate-700">Learning module<select aria-label="Add learning-module scope" value={newScopeLearningModuleId} onChange={(event) => setNewScopeLearningModuleId(event.target.value)} className="mt-1 block w-full rounded border border-slate-300 bg-white p-2"><option value="">Choose a module</option>{availableScopeModules.map((module) => <option key={module.id} value={module.id}>{props.currentVersionsByLearningModuleId.get(module.id)?.title ?? module.stableCode}</option>)}</select></label><label className="text-sm text-slate-700">Emphasis<input aria-label="Scope emphasis" value={newScopeEmphasis} onChange={(event) => setNewScopeEmphasis(event.target.value)} className="mt-1 block w-full rounded border border-slate-300 p-2" /></label><label className="text-sm text-slate-700 sm:col-span-2">Notes<textarea aria-label="Scope notes" value={newScopeNotes} onChange={(event) => setNewScopeNotes(event.target.value)} className="mt-1 block w-full rounded border border-slate-300 p-2" rows={2} /></label></div>
        <button type="button" disabled={!newScopeLearningModuleId} onClick={() => void addScope()} className="mt-2 rounded bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300">Add scope</button>
      </section>
    </aside> : null}
    <div className="mt-5 border-t border-slate-200 pt-4"><h3 className="font-semibold text-slate-900">Topic flow</h3><p className="text-sm text-slate-600">Derived from placed activity versions, not legacy Topic module ownership.</p><div className="mt-2 space-y-2">{props.topics.map((topic) => { const versionId = topic.currentVersionId; const occurrences = versionId ? flow.get(versionId) ?? [] : []; return <div key={topic.id} className="flex gap-2 text-sm"><span className="w-48 shrink-0 font-medium text-slate-800">{versionId ? topicTitles.get(versionId) : topic.stableCode}</span><span className={occurrences.length ? "text-slate-700" : "text-rose-700"}>{occurrences.length ? occurrences.map((item) => `${item.activityTitle} (${item.action[0]!.toUpperCase()})`).join(" → ") : "No activity placement"}</span></div>; })}</div></div>
  </section>;
}
