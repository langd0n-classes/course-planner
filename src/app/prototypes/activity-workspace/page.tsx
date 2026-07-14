"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { buildFixture, getDuplicateTopicActions } from "@/lib/b2r-prototype-fixture";
import type {
  Activity,
  ActivityType,
  Id,
  IpaAction,
  TermException,
  Topic,
  TopicAction,
} from "@/lib/b2r-prototype-fixture";
import ActivityTypeEditor from "@/components/b2r-prototype/ActivityTypeEditor";
import { CalendarWorkspace } from "@/components/b2r-prototype/CalendarWorkspace";
import CourseHeader from "@/components/b2r-prototype/CourseHeader";
import DetailPane from "@/components/b2r-prototype/DetailPane";
import LMBoard from "@/components/b2r-prototype/LMBoard";
import PrototypeBanner from "@/components/b2r-prototype/PrototypeBanner";
import type { MilestoneDraft } from "@/components/b2r-prototype/MilestoneEditor";
import RunViewport from "@/components/b2r-prototype/RunViewport";
import TopicQuickEditor from "@/components/b2r-prototype/TopicQuickEditor";
import TopicBank from "@/components/b2r-prototype/TopicBank";
import type { PrototypeMode } from "@/components/b2r-prototype/ModeToggle";

// Initialise from the deterministic fixture
const INITIAL = buildFixture();

type WorkspaceTool = "topics" | "activity-types" | "calendar";

function nextTopicId(topics: Topic[]): string {
  const max = topics.reduce((currentMax, topic) => {
    const match = /^t(\d+)$/.exec(topic.id);
    if (!match) return currentMax;
    return Math.max(currentMax, Number(match[1]));
  }, 0);

  return `t${String(max + 1).padStart(3, "0")}`;
}

function WorkspaceDrawer({
  title,
  description,
  widthClassName,
  onClose,
  children,
}: {
  title: string;
  description: string;
  widthClassName: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/45">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
        className={`flex h-full w-full flex-col border-l border-[--color-line] bg-[--color-paper] shadow-[0_24px_80px_rgba(15,23,42,0.32)] ${widthClassName}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[--color-line] px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[--color-ink-faint]">
              Workspace tool
            </p>
            <h2 id={titleId} className="mt-1 text-base font-semibold text-[--color-ink]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[--color-ink-muted]">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="inline-flex h-9 items-center justify-center rounded-md border border-[--color-line] bg-[--color-surface] px-3 text-sm font-medium text-[--color-ink-soft] transition hover:bg-[--color-paper-inset] hover:text-[--color-ink]"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export default function ActivityWorkspacePage() {
  // --- Local mutation state (prototype: resets on reload) ---
  const [topics, setTopics] = useState<Topic[]>(() => [...INITIAL.topics]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>(() => [...INITIAL.activityTypes]);
  const [activities, setActivities] = useState<Activity[]>(INITIAL.activities);
  const [topicActions, setTopicActions] = useState<TopicAction[]>(INITIAL.topicActions);
  const [termExceptions, setTermExceptions] = useState<TermException[]>(() => [...INITIAL.termExceptions]);

  const [mode, setMode] = useState<PrototypeMode>("design");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState<Id | null>(null);
  const [activeTool, setActiveTool] = useState<WorkspaceTool | null>(null);

  // Track next topicAction and local entity ids
  const taSeq = useRef(INITIAL.topicActions.length + 1);
  const activityTypeSeq = useRef(1);
  const milestoneSeq = useRef(1);

  // --- Derived ---
  const duplicatesMap = useMemo(() => getDuplicateTopicActions(topicActions), [topicActions]);
  const duplicateTopicActionIds = useMemo(
    () => new Set([...duplicatesMap.values()].flat().map((ta) => ta.id)),
    [duplicatesMap],
  );

  const selectedActivity = activities.find((a) => a.id === selectedActivityId) ?? null;
  const meetingActivities = useMemo(
    () => activities.filter((activity) => activity.kind === "meeting"),
    [activities],
  );
  const selectedTopicActions = selectedActivity
    ? topicActions.filter((ta) => ta.activityId === selectedActivity.id)
    : [];
  const activityTitleById = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity.title])),
    [activities],
  );
  const currentFixture = useMemo(
    () => ({
      ...INITIAL,
      topics,
      activityTypes,
      activities,
      topicActions,
      termExceptions,
    }),
    [activities, activityTypes, termExceptions, topicActions, topics],
  );

  // Ref map for navigating to a card
  const cardRefs = useRef<Map<Id, HTMLElement>>(new Map());

  const registerCardRef = useCallback((activityId: Id, element: HTMLElement | null) => {
    if (element) {
      cardRefs.current.set(activityId, element);
      return;
    }

    cardRefs.current.delete(activityId);
  }, []);

  // --- Mutations ---
  function moveActivity(activityId: Id, toLmId: Id | null) {
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, primaryLmId: toLmId } : a)),
    );
  }

  function changeTitle(activityId: Id, title: string) {
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, title } : a)),
    );
  }

  function changeLm(activityId: Id, lmId: Id | null) {
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, primaryLmId: lmId } : a)),
    );
  }

  function createTopic(next: { title: string; code: string; category: string }) {
    setTopics((prev) => [...prev, { id: nextTopicId(prev), ...next }]);
  }

  function updateTopic(topicId: string, updates: Partial<Pick<Topic, "title" | "code" | "category">>) {
    setTopics((prev) =>
      prev.map((topic) => (topic.id === topicId ? { ...topic, ...updates } : topic)),
    );
  }

  function createActivityType(next: { label: string; family: ActivityType["family"] }) {
    const id = `at-local-${String(activityTypeSeq.current).padStart(3, "0")}`;
    activityTypeSeq.current += 1;
    setActivityTypes((prev) => [...prev, { id, label: next.label, family: next.family }]);
  }

  function renameActivityType(next: { id: string; label: string }) {
    setActivityTypes((prev) =>
      prev.map((activityType) =>
        activityType.id === next.id ? { ...activityType, label: next.label } : activityType,
      ),
    );
  }

  function addTermException(exception: TermException) {
    setTermExceptions((prev) => [...prev, exception]);
  }

  function addTopicAction(topicId: Id, action: IpaAction) {
    if (!selectedActivityId) return;
    const id = `ta${String(taSeq.current++).padStart(4, "0")}`;
    setTopicActions((prev) => [
      ...prev,
      { id, activityId: selectedActivityId, topicId, action },
    ]);
  }

  function removeTopicAction(taId: string) {
    setTopicActions((prev) => prev.filter((ta) => ta.id !== taId));
  }

  function addMilestone(activityId: Id, draft: MilestoneDraft) {
    const milestoneId = `ms-local-${String(milestoneSeq.current).padStart(3, "0")}`;
    milestoneSeq.current += 1;

    setActivities((prev) =>
      prev.map((activity) => {
        if (activity.id !== activityId) {
          return activity;
        }

        return {
          ...activity,
          milestones: [
            ...activity.milestones,
            {
              id: milestoneId,
              role: draft.role,
              label: draft.label,
              linkedActivityId: draft.linkedActivityId,
              date: draft.date,
              time: draft.time ?? null,
            },
          ],
        };
      }),
    );
  }

  function removeMilestone(activityId: Id, milestoneId: Id) {
    setActivities((prev) =>
      prev.map((activity) => {
        if (activity.id !== activityId) {
          return activity;
        }

        return {
          ...activity,
          milestones: activity.milestones.filter((milestone) => milestone.id !== milestoneId),
        };
      }),
    );
  }

  function navigateToActivity(activityId: Id) {
    setSelectedActivityId(activityId);
    // Scroll into view if ref is available
    const el = cardRefs.current.get(activityId);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[--color-ink]">
      <PrototypeBanner />

      <CourseHeader
        courseTitle={INITIAL.courseTitle}
        courseCode={INITIAL.courseCode}
        termLabel={INITIAL.termLabel}
        mode={mode}
        onModeChange={setMode}
        onSearch={setSearchQuery}
        onOpenTopics={() => setActiveTool((current) => (current === "topics" ? null : "topics"))}
        onOpenActivityTypes={() =>
          setActiveTool((current) => (current === "activity-types" ? null : "activity-types"))
        }
        onOpenCalendar={() => setActiveTool((current) => (current === "calendar" ? null : "calendar"))}
        searchQuery={searchQuery}
      />

      {mode === "design" ? (
        <div className="flex flex-1 min-h-0">
          {/* Topic bank — left sidebar */}
          <TopicBank
            topics={topics}
            onAddAction={addTopicAction}
            searchQuery={searchQuery}
            selectedActivityTitle={selectedActivity?.title ?? null}
          />

          {/* Board — center, scrollable horizontally */}
          <LMBoard
            learningModules={INITIAL.learningModules}
            activities={activities}
            activityTypes={activityTypes}
            topicActions={topicActions}
            topics={topics}
            selectedActivityId={selectedActivityId}
            duplicateTopicActionIds={duplicateTopicActionIds}
            searchQuery={searchQuery}
            onRegisterCardRef={registerCardRef}
            onSelectActivity={(id) =>
              setSelectedActivityId((prev) => (prev === id ? null : id))
            }
            onMoveActivity={moveActivity}
          />

          {/* Detail pane — right sidebar, shown when a card is selected */}
          {selectedActivity && (
            <DetailPane
              activity={selectedActivity}
              activityType={activityTypes.find((t) => t.id === selectedActivity.typeId)}
              learningModules={INITIAL.learningModules}
              meetingActivities={meetingActivities}
              topicActions={selectedTopicActions}
              allTopicActions={topicActions}
              topics={topics}
              activityTitleById={activityTitleById}
              onClose={() => setSelectedActivityId(null)}
              onTitleChange={changeTitle}
              onLmChange={changeLm}
              onAddMilestone={addMilestone}
              onRemoveMilestone={removeMilestone}
              onRemoveTopicAction={removeTopicAction}
              onNavigateToActivity={navigateToActivity}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-[--color-paper]" data-testid="run-viewport">
          <RunViewport fixture={currentFixture} />
        </div>
      )}

      {activeTool === "topics" && (
        <WorkspaceDrawer
          title="Topics"
          description="Create and edit the topic bank used by the workspace."
          widthClassName="max-w-4xl"
          onClose={() => setActiveTool(null)}
        >
          <TopicQuickEditor topics={topics} onCreate={createTopic} onUpdate={updateTopic} />
        </WorkspaceDrawer>
      )}

      {activeTool === "activity-types" && (
        <WorkspaceDrawer
          title="Activity types"
          description="Rename course activity labels without changing their stable families."
          widthClassName="max-w-4xl"
          onClose={() => setActiveTool(null)}
        >
          <ActivityTypeEditor
            activityTypes={activityTypes}
            onCreate={createActivityType}
            onRename={renameActivityType}
          />
        </WorkspaceDrawer>
      )}

      {activeTool === "calendar" && (
        <WorkspaceDrawer
          title="Calendar"
          description="Review the inherited UC Berkeley term calendar and add term-only exceptions."
          widthClassName="max-w-5xl"
          onClose={() => setActiveTool(null)}
        >
          <CalendarWorkspace
            institutionLabel="UC Berkeley"
            termLabel={INITIAL.termLabel}
            calendarSlots={INITIAL.calendar}
            termExceptions={termExceptions}
            onAddException={addTermException}
          />
        </WorkspaceDrawer>
      )}
    </div>
  );
}
