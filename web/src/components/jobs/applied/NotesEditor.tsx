"use client";

import { useEffect, useRef, useState } from "react";
import { StickyNote, Check, X, Pencil } from "lucide-react";

export default function NotesEditor({
  jobId,
  initialNotes,
  onSave,
}: {
  jobId: string;
  initialNotes: string;
  onSave: (jobId: string, notes: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(jobId, value.trim());
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Track contacts, interview feedback, salary discussions, next steps..."
          className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setValue(initialNotes);
              setIsEditing(false);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            {isSaving ? "Saving..." : "Save note"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex w-full items-start gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-3 py-2.5 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
    >
      <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 group-hover:text-indigo-500" />
      {initialNotes ? (
        <span className="line-clamp-2 text-sm text-gray-600">{initialNotes}</span>
      ) : (
        <span className="text-sm text-gray-400 group-hover:text-indigo-500">
          Add a note — contacts, feedback, next steps...
        </span>
      )}
      <Pencil className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
