"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import NoteList from "@/components/NoteList";
import NoteEditor from "@/components/NoteEditor";
import {
  deleteNote as dbDeleteNote,
  deleteNotebook as dbDeleteNotebook,
  getAllNotes,
  getNotebooks,
  getNotesByNotebook,
  putNote,
  putNotebook,
} from "@/lib/db";
import type { Note, Notebook } from "@/lib/types";

const NOTEBOOK_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#9333ea"];

export default function Home() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [allNotesCache, setAllNotesCache] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    (async () => {
      let nbs = await getNotebooks();
      if (nbs.length === 0) {
        const now = Date.now();
        const defaultNotebook: Notebook = {
          id: crypto.randomUUID(),
          name: "My Notes",
          color: NOTEBOOK_COLORS[0],
          createdAt: now,
          updatedAt: now,
        };
        await putNotebook(defaultNotebook);
        nbs = [defaultNotebook];
      }
      setNotebooks(nbs);
      setSelectedNotebookId(nbs[0].id);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!selectedNotebookId) return;
    getNotesByNotebook(selectedNotebookId).then(setNotes);
  }, [selectedNotebookId]);

  useEffect(() => {
    if (searchQuery.trim()) {
      getAllNotes().then(setAllNotesCache);
    }
  }, [searchQuery]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return allNotesCache.filter(
      (n) => n.title.toLowerCase().includes(q) || n.text.toLowerCase().includes(q)
    );
  }, [searchQuery, allNotesCache]);

  const visibleNotes = searchResults ?? notes;
  const selectedNote = visibleNotes.find((n) => n.id === selectedNoteId) ?? null;

  async function handleCreateNotebook() {
    const now = Date.now();
    const notebook: Notebook = {
      id: crypto.randomUUID(),
      name: "New Notebook",
      color: NOTEBOOK_COLORS[notebooks.length % NOTEBOOK_COLORS.length],
      createdAt: now,
      updatedAt: now,
    };
    await putNotebook(notebook);
    setNotebooks((prev) => [notebook, ...prev]);
    setSelectedNotebookId(notebook.id);
    setSearchQuery("");
  }

  async function handleDeleteNotebook(id: string) {
    await dbDeleteNotebook(id);
    const remaining = notebooks.filter((nb) => nb.id !== id);
    setNotebooks(remaining);
    if (selectedNotebookId === id) {
      setSelectedNotebookId(remaining[0]?.id ?? null);
      setSelectedNoteId(null);
    }
  }

  async function handleCreateNote() {
    if (!selectedNotebookId) return;
    const now = Date.now();
    const note: Note = {
      id: crypto.randomUUID(),
      notebookId: selectedNotebookId,
      title: "",
      text: "",
      strokes: [],
      createdAt: now,
      updatedAt: now,
    };
    await putNote(note);
    setNotes((prev) => [note, ...prev]);
    setSelectedNoteId(note.id);
    setSearchQuery("");
  }

  async function handleDeleteNote(id: string) {
    await dbDeleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setAllNotesCache((prev) => prev.filter((n) => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
  }

  function handleUpdateNote(updated: Note) {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setAllNotesCache((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));

    const timers = saveTimers.current;
    const existing = timers.get(updated.id);
    if (existing) clearTimeout(existing);
    timers.set(
      updated.id,
      setTimeout(() => {
        putNote(updated);
        timers.delete(updated.id);
      }, 400)
    );
  }

  const selectedNotebook = notebooks.find((nb) => nb.id === selectedNotebookId);
  const listTitle = searchResults
    ? `Results for "${searchQuery}"`
    : selectedNotebook?.name ?? "Notes";

  if (!loaded) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        notebooks={notebooks}
        selectedNotebookId={selectedNotebookId}
        onSelect={(id) => {
          setSelectedNotebookId(id);
          setSelectedNoteId(null);
          setSearchQuery("");
        }}
        onCreate={handleCreateNotebook}
        onDelete={handleDeleteNotebook}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <NoteList
        notes={visibleNotes}
        selectedNoteId={selectedNoteId}
        onSelect={setSelectedNoteId}
        onCreate={handleCreateNote}
        onDelete={handleDeleteNote}
        title={listTitle}
      />
      {selectedNote ? (
        <NoteEditor note={selectedNote} onUpdate={handleUpdateNote} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
          Select or create a note to get started.
        </div>
      )}
    </div>
  );
}
