"use client";

import type { Note } from "@/lib/types";

interface NoteListProps {
  notes: Note[];
  selectedNoteId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  title: string;
}

export default function NoteList({
  notes,
  selectedNoteId,
  onSelect,
  onCreate,
  onDelete,
  title,
}: NoteListProps) {
  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="truncate text-sm font-semibold">{title}</span>
        <button
          onClick={onCreate}
          aria-label="New note"
          className="text-lg leading-none text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {notes.length === 0 && (
          <p className="px-2 py-4 text-sm text-zinc-400">No notes yet.</p>
        )}
        {notes.map((note) => (
          <div
            key={note.id}
            onClick={() => onSelect(note.id)}
            className={`group mb-1 cursor-pointer rounded-md px-2 py-2 ${
              selectedNoteId === note.id
                ? "bg-zinc-100 dark:bg-zinc-800"
                : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-medium">
                {note.title || "Untitled note"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(note.id);
                }}
                className="hidden shrink-0 text-zinc-400 hover:text-red-600 group-hover:block"
                aria-label="Delete note"
              >
                ×
              </button>
            </div>
            <p className="mt-0.5 truncate text-xs text-zinc-400">
              {note.text || "No additional text"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
