"use client";

import { useEffect, useRef, useState } from "react";
import type { Notebook } from "@/lib/types";

interface SidebarProps {
  notebooks: Notebook[];
  selectedNotebookId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function Sidebar({
  notebooks,
  selectedNotebookId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  searchQuery,
  onSearchChange,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  function startEditing(nb: Notebook) {
    setEditingId(nb.id);
    setDraftName(nb.name);
  }

  function commitEditing() {
    if (editingId) onRename(editingId, draftName);
    setEditingId(null);
  }

  return (
    <div className="flex w-56 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800">
      <div className="p-3">
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search notes…"
          className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
        />
      </div>

      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Notebooks
        </span>
        <button
          onClick={onCreate}
          aria-label="New notebook"
          className="text-lg leading-none text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {notebooks.map((nb) => (
          <div
            key={nb.id}
            className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer ${
              selectedNotebookId === nb.id
                ? "bg-zinc-100 dark:bg-zinc-800"
                : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
            onClick={() => onSelect(nb.id)}
            onDoubleClick={() => startEditing(nb)}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: nb.color }}
              />
              {editingId === nb.id ? (
                <input
                  ref={inputRef}
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={commitEditing}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEditing();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="min-w-0 flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-1 py-0.5 outline-none"
                />
              ) : (
                <span className="truncate">{nb.name}</span>
              )}
            </span>
            {editingId !== nb.id && (
              <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(nb);
                  }}
                  className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  aria-label={`Rename ${nb.name}`}
                >
                  ✎
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(nb.id);
                  }}
                  className="text-zinc-400 hover:text-red-600"
                  aria-label={`Delete ${nb.name}`}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
