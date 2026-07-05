"use client";

import { useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { getSvgPathFromStroke } from "@/lib/stroke-path";
import type { DrawingBackground, Stroke, TextBox } from "@/lib/types";

const COLORS = ["#18181b", "#dc2626", "#2563eb", "#16a34a", "#d97706"];
const SIZES = [2, 4, 8, 16];
const STROKE_OPTIONS = { thinning: 0.6, smoothing: 0.5, streamline: 0.5 };

type Mode = "text" | "pen" | "eraser";

const BACKGROUND_OPTIONS: { id: DrawingBackground; label: string }[] = [
  { id: "dotted", label: "Dotted" },
  { id: "grid", label: "Grid" },
  { id: "ruled", label: "Ruled" },
  { id: "blank", label: "Blank" },
];

interface NotePageProps {
  strokes: Stroke[];
  textBoxes: TextBox[];
  background: DrawingBackground;
  onStrokesChange: (strokes: Stroke[]) => void;
  onTextBoxesChange: (textBoxes: TextBox[]) => void;
  onBackgroundChange: (background: DrawingBackground) => void;
}

export default function NotePage({
  strokes,
  textBoxes,
  background,
  onStrokesChange,
  onTextBoxesChange,
  onBackgroundChange,
}: NotePageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<Mode>("text");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [activePoints, setActivePoints] = useState<[number, number, number][]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Single active pointer for drawing (palm rejection — see handlePointerDown).
  const activePointerId = useRef<number | null>(null);
  const activePointerType = useRef<string | null>(null);
  // Undo stack of previous stroke states, so Undo reverts draws, erases, and Clear.
  const history = useRef<Stroke[][]>([]);
  // In-flight text-box drag.
  const drag = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);

  function pushHistory() {
    history.current.push(strokes);
    if (history.current.length > 50) history.current.shift();
  }

  // ---- Drawing ----------------------------------------------------------

  function toPoint(clientX: number, clientY: number, pressure: number): [number, number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    return [clientX - rect.left, clientY - rect.top, pressure > 0 ? pressure : 0.5];
  }

  function getPoint(e: React.PointerEvent): [number, number, number] {
    return toPoint(e.clientX, e.clientY, e.pressure);
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    // Reject palm/extra fingers mid-stroke; let a pen preempt a finger stroke.
    if (activePointerId.current !== null) {
      const activeIsPen = activePointerType.current === "pen";
      if (!(e.pointerType === "pen" && !activeIsPen)) return;
    }

    svgRef.current?.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    activePointerType.current = e.pointerType;

    if (mode === "eraser") {
      pushHistory(); // one snapshot per erase gesture
      eraseNear(getPoint(e));
      return;
    }
    setActivePoints([getPoint(e)]);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerId !== activePointerId.current) return;

    if (mode === "eraser") {
      eraseNear(getPoint(e));
      return;
    }

    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const points = coalesced.length
      ? coalesced.map((c) => toPoint(c.clientX, c.clientY, c.pressure))
      : [getPoint(e)];
    setActivePoints((prev) => [...prev, ...points]);
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerId !== activePointerId.current) return;
    activePointerId.current = null;
    activePointerType.current = null;

    if (mode === "eraser") return;

    if (activePoints.length > 1) {
      pushHistory();
      onStrokesChange([
        ...strokes,
        { id: crypto.randomUUID(), points: activePoints, color, size },
      ]);
    }
    setActivePoints([]);
  }

  function eraseNear(point: [number, number, number]) {
    const [x, y] = point;
    const remaining = strokes.filter(
      (stroke) => !stroke.points.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < stroke.size + 12)
    );
    if (remaining.length !== strokes.length) onStrokesChange(remaining);
  }

  function undo() {
    const prev = history.current.pop();
    if (prev) onStrokesChange(prev);
  }

  function clearAll() {
    if (strokes.length === 0) return;
    pushHistory();
    onStrokesChange([]);
  }

  // ---- Text boxes -------------------------------------------------------

  function handleTextLayerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (mode !== "text") return;
    if (e.target !== e.currentTarget) return; // tapped an existing box, not empty space
    const rect = containerRef.current!.getBoundingClientRect();
    const box: TextBox = {
      id: crypto.randomUUID(),
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      text: "",
    };
    onTextBoxesChange([...textBoxes, box]);
    setEditingId(box.id);
  }

  function updateBox(id: string, text: string) {
    onTextBoxesChange(textBoxes.map((b) => (b.id === id ? { ...b, text } : b)));
  }

  function removeBoxIfEmpty(id: string) {
    const box = textBoxes.find((b) => b.id === id);
    if (box && box.text.trim() === "") onTextBoxesChange(textBoxes.filter((b) => b.id !== id));
  }

  function startDrag(e: React.PointerEvent, box: TextBox) {
    e.stopPropagation();
    drag.current = { id: box.id, startX: e.clientX, startY: e.clientY, originX: box.x, originY: box.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function moveDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const nextX = d.originX + (e.clientX - d.startX);
    const nextY = d.originY + (e.clientY - d.startY);
    onTextBoxesChange(textBoxes.map((b) => (b.id === d.id ? { ...b, x: nextX, y: nextY } : b)));
  }

  function endDrag() {
    drag.current = null;
  }

  // ---- Rendering --------------------------------------------------------

  const activeOutline =
    activePoints.length > 1
      ? getSvgPathFromStroke(getStroke(activePoints, { size, ...STROKE_OPTIONS }))
      : "";

  function getBackgroundStyle(): React.CSSProperties {
    switch (background) {
      case "grid":
        return {
          backgroundImage:
            "linear-gradient(rgba(113, 113, 122, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(113, 113, 122, 0.2) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        };
      case "ruled":
        return {
          backgroundImage: "linear-gradient(rgba(113, 113, 122, 0.2) 1px, transparent 1px)",
          backgroundSize: "100% 24px",
        };
      case "blank":
        return {};
      case "dotted":
      default:
        return {
          backgroundImage: "radial-gradient(circle, rgba(113, 113, 122, 0.35) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        };
    }
  }

  const autoSize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const modeButton = (value: Mode, label: string) => (
    <button
      onClick={() => setMode(value)}
      className={`rounded-md px-3 py-1 text-sm ${
        mode === value
          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
          : "text-zinc-600 dark:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
          {modeButton("text", "Text")}
          {modeButton("pen", "Pen")}
          {modeButton("eraser", "Eraser")}
        </div>

        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Color ${c}`}
              onClick={() => {
                setMode("pen");
                setColor(c);
              }}
              className={`h-6 w-6 rounded-full border-2 ${
                mode === "pen" && color === c
                  ? "border-zinc-900 dark:border-zinc-100"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setMode("pen");
                setSize(s);
              }}
              className={`flex h-7 w-7 items-center justify-center rounded ${
                mode === "pen" && size === s
                  ? "bg-zinc-200 dark:bg-zinc-700"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="rounded-full bg-current" style={{ width: s, height: s }} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded bg-zinc-100 p-1 dark:bg-zinc-800">
          {BACKGROUND_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => onBackgroundChange(option.id)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                background === option.id
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          onClick={undo}
          className="rounded px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Undo
        </button>
        <button
          onClick={clearAll}
          className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        >
          Clear
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-hidden bg-white dark:bg-zinc-950"
        style={getBackgroundStyle()}
      >
        <svg
          ref={svgRef}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ pointerEvents: mode === "text" ? "none" : "auto" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {strokes.map((stroke) => (
            <path
              key={stroke.id}
              d={getSvgPathFromStroke(getStroke(stroke.points, { size: stroke.size, ...STROKE_OPTIONS }))}
              fill={stroke.color}
            />
          ))}
          {activeOutline && <path d={activeOutline} fill={color} />}
        </svg>

        <div
          className="absolute inset-0"
          style={{ pointerEvents: mode === "text" ? "auto" : "none" }}
          onPointerDown={handleTextLayerPointerDown}
        >
          {textBoxes.map((box) => (
            <div key={box.id} className="absolute" style={{ left: box.x, top: box.y }}>
              {mode === "text" && (
                <button
                  aria-label="Move text box"
                  onPointerDown={(e) => startDrag(e, box)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className="absolute -top-5 left-0 cursor-move touch-none rounded bg-zinc-200 px-1 text-xs leading-4 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                >
                  ⠿
                </button>
              )}
              <textarea
                ref={autoSize}
                value={box.text}
                onChange={(e) => {
                  autoSize(e.currentTarget);
                  updateBox(box.id, e.target.value);
                }}
                onBlur={() => removeBoxIfEmpty(box.id)}
                onPointerDown={(e) => e.stopPropagation()}
                readOnly={mode !== "text"}
                autoFocus={editingId === box.id}
                placeholder="Text…"
                className={`block w-48 resize-none overflow-hidden bg-transparent p-1 text-sm outline-none placeholder:text-zinc-400 ${
                  mode === "text"
                    ? "rounded ring-1 ring-zinc-300 focus:ring-zinc-500 dark:ring-zinc-700"
                    : "cursor-default"
                }`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
