"use client";

import { useState } from "react";
import DrawCanvas from "./DrawCanvas";
import type { Note, Stroke } from "@/lib/types";

interface NoteEditorProps {
  note: Note;
  onUpdate: (note: Note) => void;
}

export default function NoteEditor({ note, onUpdate }: NoteEditorProps) {
  const [tab, setTab] = useState<"text" | "draw">("text");

  function touch(patch: Partial<Note>) {
    onUpdate({ ...note, ...patch, updatedAt: Date.now() });
  }

  function handleStrokesChange(strokes: Stroke[]) {
    touch({ strokes });
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <input
          value={note.title}
          onChange={(e) => touch({ title: e.target.value })}
          placeholder="Untitled note"
          className="flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-zinc-400"
        />
        <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 text-sm">
          <button
            onClick={() => setTab("text")}
            className={`rounded-md px-3 py-1 ${
              tab === "text" ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-zinc-500"
            }`}
          >
            Text
          </button>
          <button
            onClick={() => setTab("draw")}
            className={`rounded-md px-3 py-1 ${
              tab === "draw" ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-zinc-500"
            }`}
          >
            Draw
          </button>
        </div>
      </div>

      {tab === "text" ? (
        <textarea
          value={note.text}
          onChange={(e) => touch({ text: e.target.value })}
          placeholder="Start writing…"
          className="flex-1 min-h-0 resize-none bg-transparent p-4 outline-none placeholder:text-zinc-400"
        />
      ) : (
        <DrawCanvas strokes={note.strokes} onChange={handleStrokesChange} />
      )}
    </div>
  );
}
