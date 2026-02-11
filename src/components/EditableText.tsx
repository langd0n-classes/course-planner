"use client";

import { useState, useRef, useEffect } from "react";

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}

export default function EditableText({
  value,
  onSave,
  placeholder = "Click to edit...",
  multiline = false,
  className = "",
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  function handleSave() {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !multiline)) {
      e.preventDefault();
      handleSave();
    }
  }

  if (editing) {
    const sharedProps = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: handleSave,
      onKeyDown: handleKeyDown,
      className: `w-full border rounded px-2 py-1 text-sm ${className}`,
      placeholder,
    };

    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          rows={3}
          {...sharedProps}
        />
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        {...sharedProps}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-gray-50 rounded px-2 py-1 min-h-[28px] ${className}`}
      title="Click to edit"
    >
      {value ? (
        <span className="text-sm">{value}</span>
      ) : (
        <span className="text-sm text-gray-400 italic">{placeholder}</span>
      )}
    </div>
  );
}
