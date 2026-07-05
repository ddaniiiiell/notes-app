"use client";

import type { Notebook } from "@/lib/types";

interface SidebarProps {
  notebooks: Notebook[];
  selectedNotebookId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function Sidebar({
  notebooks,
  selectedNotebookId,
  onSelect,
  onCreate,
  onDelete,
  searchQuery,
  onSearchChange,
}: SidebarProps) {
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
          >
            <span className="flex items-center gap-2 truncate">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: nb.color }}
              />
              <span className="truncate">{nb.name}</span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(nb.id);
              }}
              className="hidden shrink-0 text-zinc-400 hover:text-red-600 group-hover:block"
              aria-label={`Delete ${nb.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
