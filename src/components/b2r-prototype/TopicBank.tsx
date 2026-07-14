"use client";

import { useMemo, useState } from "react";
import type { IpaAction, Topic } from "@/lib/b2r-prototype-fixture";

interface Props {
  topics: Topic[];
  onAddAction: (topicId: string, action: IpaAction) => void;
  searchQuery?: string;
  selectedActivityTitle: string | null;
}

const IPA: IpaAction[] = ["I", "P", "A"];
const IPA_LABEL: Record<IpaAction, string> = { I: "Introduce", P: "Practice", A: "Assess" };

export default function TopicBank({
  topics,
  onAddAction,
  searchQuery = "",
  selectedActivityTitle,
}: Props) {
  const [localFilter, setLocalFilter] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const effectiveFilter = searchQuery || localFilter;
  const hasTarget = Boolean(selectedActivityTitle);

  const filtered = useMemo(() => {
    if (!effectiveFilter.trim()) return topics;
    const q = effectiveFilter.toLowerCase();
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [topics, effectiveFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Topic[]>();
    for (const t of filtered) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return map;
  }, [filtered]);

  function toggleCat(cat: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <aside
      aria-label="Topic bank"
      className="flex flex-col bg-[--color-surface] border-r border-[--color-line] w-64 shrink-0 overflow-y-auto"
    >
      <div className="px-3 py-2 border-b border-[--color-line] flex items-center gap-2">
        <label htmlFor="topic-bank-filter" className="sr-only">Filter topics</label>
        <input
          id="topic-bank-filter"
          type="search"
          value={localFilter}
          onChange={(e) => setLocalFilter(e.target.value)}
          placeholder={`Filter ${topics.length} topics…`}
          className="flex-1 px-2 py-1 text-xs bg-[--color-paper-inset] border border-[--color-line] rounded text-[--color-ink] placeholder:text-[--color-ink-faint]"
        />
      </div>

      <div className="px-3 py-2 border-b border-[--color-line] text-xs">
        {hasTarget ? (
          <div
            data-testid="topic-bank-target"
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[--color-accent] bg-[--color-accent-tint] px-2 py-1 text-[--color-accent]"
            aria-label={`Adding to ${selectedActivityTitle}`}
          >
            <span className="font-medium">Adding to</span>{" "}
            <span className="truncate font-medium text-[--color-ink]">{selectedActivityTitle}</span>
          </div>
        ) : (
          <p
            data-testid="topic-bank-no-target"
            className="rounded-md border border-dashed border-[--color-line] bg-[--color-paper-inset] px-2 py-1.5 text-[--color-ink-muted]"
          >
            Select a meeting or coursework item before attaching Topics.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto text-xs">
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-[--color-ink-muted] italic">
            No topics match.{" "}
            <button
              type="button"
              onClick={() => setLocalFilter("")}
              className="text-[--color-accent] underline"
            >
              Clear filter
            </button>
          </p>
        )}
        {[...grouped.entries()].map(([cat, catTopics]) => {
          const expanded = expandedCats.has(cat) || effectiveFilter.length > 0;
          return (
            <div key={cat}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center justify-between px-3 py-1.5 bg-[--color-paper-inset] border-b border-[--color-line] font-medium text-[--color-ink-soft] hover:bg-[--color-surface-sunken] text-left"
              >
                <span>{cat}</span>
                <span className="text-[--color-ink-faint] font-normal">
                  {catTopics.length} {expanded ? "▲" : "▼"}
                </span>
              </button>
              {expanded && (
                <ul>
                  {catTopics.map((topic) => (
                    <li key={topic.id} className="border-b border-[--color-line] last:border-b-0">
                      <div className="px-3 py-1.5 flex flex-col gap-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[--color-ink] leading-tight">{topic.title}</span>
                          <span className="text-[10px] text-[--color-ink-faint] font-mono shrink-0">
                            {topic.code}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {IPA.map((action) => (
                            <button
                              key={action}
                              type="button"
                              title={IPA_LABEL[action]}
                              aria-label={`${IPA_LABEL[action]} ${topic.title}`}
                              disabled={!hasTarget}
                              onClick={() => onAddAction(topic.id, action)}
                              className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-[--color-line] bg-[--color-paper] text-[--color-ink-soft] transition-colors hover:bg-[--color-accent-tint] hover:border-[--color-accent] hover:text-[--color-accent] disabled:cursor-not-allowed disabled:border-[--color-line] disabled:bg-[--color-paper-inset] disabled:text-[--color-ink-faint] disabled:hover:bg-[--color-paper-inset] disabled:hover:text-[--color-ink-faint]"
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
