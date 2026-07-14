"use client";

import { useMemo, useRef, useState } from "react";
import type { FocusEvent, FormEvent, KeyboardEvent } from "react";
import type { Topic } from "@/lib/b2r-prototype-fixture";
import { suggestTopicCode } from "@/lib/b2r-prototype-fixture";

type TopicDraft = Pick<Topic, "title" | "code" | "category">;

type TopicQuickEditorProps = {
  topics: Topic[];
  onCreate: (topic: TopicDraft) => void | Promise<void>;
  onUpdate: (topicId: string, updates: Partial<TopicDraft>) => void | Promise<void>;
};

function normalize(value: string) {
  return value.trim();
}

function uniqueCategories(topics: Topic[]) {
  return Array.from(
    new Set(topics.map((topic) => topic.category.trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

function TopicRow({
  topic,
  onUpdate,
}: {
  topic: Topic;
  onUpdate: TopicQuickEditorProps["onUpdate"];
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [titleDraft, setTitleDraft] = useState(topic.title);
  const [codeDraft, setCodeDraft] = useState(topic.code);

  function resetDrafts() {
    setTitleDraft(topic.title);
    setCodeDraft(topic.code);
  }

  function commit() {
    const nextTitle = normalize(titleDraft);
    const nextCode = normalize(codeDraft);

    if (!nextTitle || !nextCode) {
      resetDrafts();
      return;
    }

    const updates: Partial<TopicDraft> = {};
    if (nextTitle !== topic.title) updates.title = nextTitle;
    if (nextCode !== topic.code) updates.code = nextCode;

    if (Object.keys(updates).length > 0) {
      void onUpdate(topic.id, updates);
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && rowRef.current?.contains(nextTarget)) {
      return;
    }
    commit();
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      resetDrafts();
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={`Topic ${topic.title}`}
      onBlur={handleBlur}
      className="grid gap-2 border-b border-[--color-line] px-3 py-2 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_8rem_minmax(8rem,0.9fr)] md:items-center"
    >
      <label className="grid gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint]">
          Title
        </span>
        <input
          aria-label="Title"
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
          onKeyDown={handleInputKeyDown}
          className="w-full border border-[--color-line] bg-[--color-surface] px-2 py-1.5 text-sm text-[--color-ink] placeholder:text-[--color-ink-faint]"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint]">
          Topic code
        </span>
        <input
          aria-label="Topic code"
          value={codeDraft}
          onChange={(event) => setCodeDraft(event.target.value)}
          onKeyDown={handleInputKeyDown}
          className="w-full border border-[--color-line] bg-[--color-surface] px-2 py-1.5 font-mono text-sm text-[--color-ink]"
        />
      </label>

      <div className="grid gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint]">
          Category
        </span>
        <span className="inline-flex min-h-9 items-center border border-[--color-line] bg-[--color-paper-inset] px-2 py-1.5 text-sm text-[--color-ink-soft]">
          {topic.category}
        </span>
      </div>
    </div>
  );
}

export default function TopicQuickEditor({ topics, onCreate, onUpdate }: TopicQuickEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const categoryListId = "topic-quick-editor-categories";

  const [search, setSearch] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [createCategory, setCreateCategory] = useState("");
  const [codeLocked, setCodeLocked] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => uniqueCategories(topics), [topics]);

  const filteredTopics = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return topics;
    return topics.filter((topic) => {
      const haystack = `${topic.title} ${topic.code} ${topic.category}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [search, topics]);

  const canCreate = Boolean(normalize(createTitle) && normalize(createCode) && normalize(createCategory));

  function resetCreateForm() {
    setCreateTitle("");
    setCreateCode("");
    setCreateCategory("");
    setCodeLocked(false);
    setCreateError(null);
    titleRef.current?.focus();
  }

  async function submitCreate() {
    if (creating) {
      return;
    }

    const title = normalize(createTitle);
    const code = normalize(createCode);
    const category = normalize(createCategory);

    if (!title || !code || !category) {
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      await onCreate({ title, code, category });
      resetCreateForm();
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Unable to create topic.");
    } finally {
      setCreating(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitCreate();
  }

  function handleTitleChange(nextValue: string) {
    setCreateTitle(nextValue);
    if (!codeLocked) {
      setCreateCode(suggestTopicCode(nextValue));
    }
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      codeRef.current?.focus();
    }
  }

  function handleCodeChange(nextValue: string) {
    setCodeLocked(true);
    setCreateCode(nextValue);
  }

  function handleCodeKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      categoryRef.current?.focus();
    }
  }

  function handleCategoryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && canCreate) {
      event.preventDefault();
      void submitCreate();
    }
  }

  return (
    <section className="rounded-lg border border-[--color-line] bg-[--color-surface] shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="flex items-start justify-between gap-3 border-b border-[--color-line] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[--color-ink-soft]">
            Topic quick editor
          </h2>
          <p className="mt-1 text-xs text-[--color-ink-muted]">
            Compact creation and inline edits for a dense 150-topic bank.
          </p>
        </div>
        <p className="text-xs text-[--color-ink-muted]">
          {topics.length} topic{topics.length === 1 ? "" : "s"}
        </p>
      </div>

      <form onSubmit={handleCreate} className="border-b border-[--color-line] px-4 py-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint]">
              1. Title
            </span>
            <input
              ref={titleRef}
              aria-label="New topic title"
              value={createTitle}
              onChange={(event) => handleTitleChange(event.target.value)}
              onKeyDown={handleTitleKeyDown}
              placeholder="e.g. Random variables"
              className="w-full border border-[--color-line-strong] bg-[--color-paper] px-3 py-2 text-sm text-[--color-ink]"
              required
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint]">
              2. Topic code
            </span>
            <input
              ref={codeRef}
              aria-label="New topic code"
              value={createCode}
              onChange={(event) => handleCodeChange(event.target.value)}
              onKeyDown={handleCodeKeyDown}
              placeholder="Auto-suggested"
              className="w-full border border-[--color-line-strong] bg-[--color-paper] px-3 py-2 font-mono text-sm text-[--color-ink]"
              required
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint]">
              3. Category
            </span>
            <input
              ref={categoryRef}
              aria-label="New topic category"
              value={createCategory}
              onChange={(event) => setCreateCategory(event.target.value)}
              onKeyDown={handleCategoryKeyDown}
              placeholder="e.g. Probability & Statistics"
              list={categoryListId}
              className="w-full border border-[--color-line-strong] bg-[--color-paper] px-3 py-2 text-sm text-[--color-ink]"
              required
            />
          </label>
        </div>

        <datalist id={categoryListId}>
          {categoryOptions.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[--color-ink-muted]">
            Title drives the suggestion until you edit topic code yourself.
          </p>
          <button
            type="submit"
            disabled={!canCreate || creating}
            className="inline-flex items-center justify-center border border-[--color-accent] bg-[--color-accent] px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-[--color-line-strong] disabled:bg-[--color-line-strong]"
          >
            {creating ? "Creating..." : "Create topic"}
          </button>
        </div>

        {createError ? <p className="mt-3 text-sm text-rose-700">{createError}</p> : null}
      </form>

      <div className="border-b border-[--color-line] px-4 py-3">
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint]">
            Search topics
          </span>
          <input
            type="search"
            aria-label="Search topics"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title, code, or category"
            className="w-full border border-[--color-line] bg-[--color-paper] px-3 py-2 text-sm text-[--color-ink]"
          />
        </label>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[--color-ink-muted]">
          <span>
            Showing {filteredTopics.length} of {topics.length}
          </span>
          <span className="font-mono uppercase tracking-[0.12em]">Dense list</span>
        </div>
      </div>

      <div className="max-h-[32rem] overflow-auto">
        {filteredTopics.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[--color-ink-muted]">
            No topics match the current search.
          </div>
        ) : (
          <div>
            <div className="grid border-b border-[--color-line] bg-[--color-paper-inset] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[--color-ink-faint] md:grid-cols-[minmax(0,1.4fr)_8rem_minmax(8rem,0.9fr)]">
              <div>Title</div>
              <div>Topic code</div>
              <div>Category</div>
            </div>
            {filteredTopics.map((topic) => (
              <TopicRow
                key={`${topic.id}:${topic.title}:${topic.code}:${topic.category}`}
                topic={topic}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
