"use client";

import { memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { getSvgPathFromStroke } from "@/lib/stroke-path";
import type { DrawingBackground, Stroke, TextBox } from "@/lib/types";

const COLORS = ["#18181b", "#dc2626", "#2563eb", "#16a34a", "#d97706"];
const SIZES = [2, 4, 8, 16];
const STROKE_OPTIONS = { thinning: 0.6, smoothing: 0.5, streamline: 0.5 };
const DEFAULT_BOX_WIDTH = 192;
const MIN_BOX_WIDTH = 96;

type Mode = "text" | "pen" | "eraser";

const BACKGROUND_OPTIONS: { id: DrawingBackground; label: string }[] = [
  { id: "dotted", label: "Dotted" },
  { id: "grid", label: "Grid" },
  { id: "ruled", label: "Ruled" },
  { id: "blank", label: "Blank" },
];

// Each committed stroke is memoized on its own reference, so appending a new
// stroke never recomputes the geometry of the existing ones.
const StrokePath = memo(function StrokePath({ stroke }: { stroke: Stroke }) {
  return (
    <path
      d={getSvgPathFromStroke(getStroke(stroke.points, { size: stroke.size, ...STROKE_OPTIONS }))}
      fill={stroke.color}
    />
  );
});

const CommittedStrokes = memo(function CommittedStrokes({ strokes }: { strokes: Stroke[] }) {
  return (
    <>
      {strokes.map((stroke) => (
        <StrokePath key={stroke.id} stroke={stroke} />
      ))}
    </>
  );
});

// The drawing surface owns the high-frequency `activePoints` state on its own,
// so an in-progress stroke re-renders only this SVG — not the committed strokes
// (memoized above) and not the text layer in the parent. That is what keeps
// inking smooth on the iPad instead of choking on a full-page re-render per
// pointer sample.
interface InkSurfaceProps {
  strokes: Stroke[];
  active: boolean;
  eraser: boolean;
  color: string;
  size: number;
  onBeginErase: () => void;
  onErase: (strokes: Stroke[]) => void;
  onCommit: (stroke: Stroke) => void;
}

function InkSurface({
  strokes,
  active,
  eraser,
  color,
  size,
  onBeginErase,
  onErase,
  onCommit,
}: InkSurfaceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activePoints, setActivePoints] = useState<[number, number, number][]>([]);
  const activePointerId = useRef<number | null>(null);
  const activePointerType = useRef<string | null>(null);

  function toPoint(clientX: number, clientY: number, pressure: number): [number, number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    return [clientX - rect.left, clientY - rect.top, pressure > 0 ? pressure : 0.5];
  }

  function getPoint(e: React.PointerEvent): [number, number, number] {
    return toPoint(e.clientX, e.clientY, e.pressure);
  }

  function eraseNear(point: [number, number, number]) {
    const [x, y] = point;
    const remaining = strokes.filter(
      (stroke) => !stroke.points.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < stroke.size + 12)
    );
    if (remaining.length !== strokes.length) onErase(remaining);
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

    if (eraser) {
      onBeginErase();
      eraseNear(getPoint(e));
      return;
    }
    setActivePoints([getPoint(e)]);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerId !== activePointerId.current) return;

    if (eraser) {
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

    if (eraser) return;

    if (activePoints.length > 1) {
      onCommit({ id: crypto.randomUUID(), points: activePoints, color, size });
    }
    setActivePoints([]);
  }

  const activeOutline =
    activePoints.length > 1
      ? getSvgPathFromStroke(getStroke(activePoints, { size, ...STROKE_OPTIONS }))
      : "";

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 h-full w-full touch-none"
      style={{ pointerEvents: active ? "auto" : "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <CommittedStrokes strokes={strokes} />
      {activeOutline && <path d={activeOutline} fill={color} />}
    </svg>
  );
}

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
  const [mode, setMode] = useState<Mode>("text");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Unified undo: each snapshot captures both layers, so Undo reverts draws,
  // erases, Clear, and text-box create/move/resize. (Per-character text edits
  // are left to the browser's native textarea undo.)
  const history = useRef<{ strokes: Stroke[]; textBoxes: TextBox[] }[]>([]);
  const drag = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resize = useRef<{ id: string; startX: number; originW: number } | null>(null);

  function pushHistory() {
    history.current.push({ strokes, textBoxes });
    if (history.current.length > 50) history.current.shift();
  }

  function undo() {
    const prev = history.current.pop();
    if (!prev) return;
    onStrokesChange(prev.strokes);
    onTextBoxesChange(prev.textBoxes);
  }

  function clearAll() {
    if (strokes.length === 0) return;
    pushHistory();
    onStrokesChange([]);
  }

  // ---- Text boxes -------------------------------------------------------

  // Keep every text box sized to its content after any change to the boxes.
  // Runs only when textBoxes changes — never during an in-progress ink stroke.
  useLayoutEffect(() => {
    const textareas = containerRef.current?.querySelectorAll("textarea");
    textareas?.forEach((el) => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    });
  }, [textBoxes]);

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
    pushHistory();
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
    pushHistory();
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

  function startResize(e: React.PointerEvent, box: TextBox) {
    e.stopPropagation();
    pushHistory();
    resize.current = { id: box.id, startX: e.clientX, originW: box.width ?? DEFAULT_BOX_WIDTH };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function moveResize(e: React.PointerEvent) {
    const r = resize.current;
    if (!r) return;
    const width = Math.max(MIN_BOX_WIDTH, r.originW + (e.clientX - r.startX));
    onTextBoxesChange(textBoxes.map((b) => (b.id === r.id ? { ...b, width } : b)));
  }

  function endResize() {
    resize.current = null;
  }

  // ---- Stroke callbacks (from InkSurface) -------------------------------

  const handleCommit = useCallback(
    (stroke: Stroke) => {
      pushHistory();
      onStrokesChange([...strokes, stroke]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [strokes, textBoxes]
  );

  const handleBeginErase = useCallback(
    () => pushHistory(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [strokes, textBoxes]
  );

  // ---- Rendering --------------------------------------------------------

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
        <InkSurface
          strokes={strokes}
          active={mode !== "text"}
          eraser={mode === "eraser"}
          color={color}
          size={size}
          onBeginErase={handleBeginErase}
          onErase={onStrokesChange}
          onCommit={handleCommit}
        />

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
                data-box-id={box.id}
                value={box.text}
                onChange={(e) => updateBox(box.id, e.target.value)}
                onBlur={() => removeBoxIfEmpty(box.id)}
                onPointerDown={(e) => e.stopPropagation()}
                readOnly={mode !== "text"}
                autoFocus={editingId === box.id}
                placeholder="Text…"
                style={{ width: box.width ?? DEFAULT_BOX_WIDTH }}
                className={`block resize-none overflow-hidden bg-transparent p-1 text-sm outline-none placeholder:text-zinc-400 ${
                  mode === "text"
                    ? "rounded ring-1 ring-zinc-300 focus:ring-zinc-500 dark:ring-zinc-700"
                    : "cursor-default"
                }`}
              />
              {mode === "text" && (
                <button
                  aria-label="Resize text box"
                  onPointerDown={(e) => startResize(e, box)}
                  onPointerMove={moveResize}
                  onPointerUp={endResize}
                  onPointerCancel={endResize}
                  className="absolute -bottom-1 -right-1 h-4 w-4 cursor-ew-resize touch-none rounded-sm bg-zinc-300 dark:bg-zinc-600"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
