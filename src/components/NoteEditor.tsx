"use client";

import NotePage from "./NotePage";
import type { DrawingBackground, Note, Stroke, TextBox } from "@/lib/types";

interface NoteEditorProps {
  note: Note;
  onUpdate: (note: Note) => void;
}

export default function NoteEditor({ note, onUpdate }: NoteEditorProps) {
  function touch(patch: Partial<Note>) {
    onUpdate({ ...note, ...patch, updatedAt: Date.now() });
  }

  // Legacy notes stored their text in `note.text` with no text boxes; surface
  // that as a single box in the top-left so nothing is lost.
  const textBoxes: TextBox[] =
    note.textBoxes ?? (note.text ? [{ id: `${note.id}-legacy`, x: 24, y: 24, text: note.text }] : []);

  function handleStrokesChange(strokes: Stroke[]) {
    touch({ strokes });
  }

  function handleTextBoxesChange(next: TextBox[]) {
    // Keep the flattened `text` in sync so search and list previews keep working.
    touch({ textBoxes: next, text: next.map((b) => b.text).join("\n") });
  }

  function handleBackgroundChange(background: DrawingBackground) {
    touch({ background });
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <input
          value={note.title}
          onChange={(e) => touch({ title: e.target.value })}
          placeholder="Untitled note"
          className="flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-zinc-400"
        />
      </div>

      <NotePage
        strokes={note.strokes}
        textBoxes={textBoxes}
        background={note.background ?? "dotted"}
        onStrokesChange={handleStrokesChange}
        onTextBoxesChange={handleTextBoxesChange}
        onBackgroundChange={handleBackgroundChange}
      />
    </div>
  );
}
