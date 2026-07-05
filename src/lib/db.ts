import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Notebook, Note } from "./types";

interface NotesDB extends DBSchema {
  notebooks: {
    key: string;
    value: Notebook;
    indexes: { updatedAt: number };
  };
  notes: {
    key: string;
    value: Note;
    indexes: { notebookId: string; updatedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<NotesDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<NotesDB>("notes-app-db", 1, {
      upgrade(db) {
        const notebooks = db.createObjectStore("notebooks", { keyPath: "id" });
        notebooks.createIndex("updatedAt", "updatedAt");

        const notes = db.createObjectStore("notes", { keyPath: "id" });
        notes.createIndex("notebookId", "notebookId");
        notes.createIndex("updatedAt", "updatedAt");
      },
    });
  }
  return dbPromise;
}

export async function getNotebooks(): Promise<Notebook[]> {
  const db = await getDB();
  const all = await db.getAll("notebooks");
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putNotebook(notebook: Notebook): Promise<void> {
  const db = await getDB();
  await db.put("notebooks", notebook);
}

export async function deleteNotebook(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["notebooks", "notes"], "readwrite");
  await tx.objectStore("notebooks").delete(id);
  const noteKeys = await tx
    .objectStore("notes")
    .index("notebookId")
    .getAllKeys(id);
  await Promise.all(noteKeys.map((key) => tx.objectStore("notes").delete(key)));
  await tx.done;
}

export async function getNotesByNotebook(notebookId: string): Promise<Note[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("notes", "notebookId", notebookId);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getAllNotes(): Promise<Note[]> {
  const db = await getDB();
  const all = await db.getAll("notes");
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putNote(note: Note): Promise<void> {
  const db = await getDB();
  await db.put("notes", note);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("notes", id);
}
