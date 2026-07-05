"use client";

import { useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { getSvgPathFromStroke } from "@/lib/stroke-path";
import type { DrawingBackground, Stroke } from "@/lib/types";

const COLORS = ["#18181b", "#dc2626", "#2563eb", "#16a34a", "#d97706"];
const SIZES = [2, 4, 8, 16];

interface DrawCanvasProps {
  strokes: Stroke[];
  background: DrawingBackground;
  onChange: (strokes: Stroke[]) => void;
  onBackgroundChange: (background: DrawingBackground) => void;
}

const BACKGROUND_OPTIONS: { id: DrawingBackground; label: string }[] = [
  { id: "dotted", label: "Dotted" },
  { id: "grid", label: "Grid" },
  { id: "ruled", label: "Ruled" },
  { id: "blank", label: "Blank" },
];

export default function DrawCanvas({
  strokes,
  background,
  onChange,
  onBackgroundChange,
}: DrawCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [activePoints, setActivePoints] = useState<[number, number, number][]>([]);
  // Only one pointer draws at a time. Tracking the id lets us reject the palm
  // and stray fingers that land while the Apple Pencil is in use.
  const activePointerId = useRef<number | null>(null);
  const activePointerType = useRef<string | null>(null);

  function toPoint(clientX: number, clientY: number, pressure: number): [number, number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    return [clientX - rect.left, clientY - rect.top, pressure > 0 ? pressure : 0.5];
  }

  function getPoint(e: React.PointerEvent<SVGSVGElement>): [number, number, number] {
    return toPoint(e.clientX, e.clientY, e.pressure);
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    // A stroke is already in progress: ignore extra pointers (palm, second
    // finger). Exception — let a pen preempt an in-progress finger/palm stroke.
    if (activePointerId.current !== null) {
      const activeIsPen = activePointerType.current === "pen";
      if (!(e.pointerType === "pen" && !activeIsPen)) return;
    }

    svgRef.current?.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    activePointerType.current = e.pointerType;

    if (tool === "eraser") {
      eraseNear(getPoint(e));
      return;
    }

    setActivePoints([getPoint(e)]);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerId !== activePointerId.current) return;

    if (tool === "eraser") {
      eraseNear(getPoint(e));
      return;
    }

    // Coalesced events recover the high-frequency samples Safari batches
    // between frames, so Apple Pencil strokes stay smooth.
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

    if (tool === "eraser") return;

    if (activePoints.length > 1) {
      const newStroke: Stroke = {
        id: crypto.randomUUID(),
        points: activePoints,
        color,
        size,
      };
      onChange([...strokes, newStroke]);
    }
    setActivePoints([]);
  }

  function eraseNear(point: [number, number, number]) {
    const [x, y] = point;
    const remaining = strokes.filter((stroke) => {
      return !stroke.points.some(
        ([sx, sy]) => Math.hypot(sx - x, sy - y) < stroke.size + 12
      );
    });
    if (remaining.length !== strokes.length) onChange(remaining);
  }

  function undo() {
    onChange(strokes.slice(0, -1));
  }

  function clearAll() {
    onChange([]);
  }

  const activeOutline =
    activePoints.length > 1
      ? getSvgPathFromStroke(
          getStroke(activePoints, {
            size,
            thinning: 0.6,
            smoothing: 0.5,
            streamline: 0.5,
          })
        )
      : "";

  function getBackgroundStyle() {
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
        return { backgroundColor: "transparent" };
      case "dotted":
      default:
        return {
          backgroundImage: "radial-gradient(circle, rgba(113, 113, 122, 0.35) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        };
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Color ${c}`}
              onClick={() => {
                setTool("pen");
                setColor(c);
              }}
              className={`h-6 w-6 rounded-full border-2 ${
                tool === "pen" && color === c
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
              onClick={() => setSize(s)}
              className={`h-7 w-7 flex items-center justify-center rounded ${
                size === s
                  ? "bg-zinc-200 dark:bg-zinc-700"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <span
                className="rounded-full bg-current"
                style={{ width: s, height: s }}
              />
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
          onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}
          className={`rounded px-2 py-1 text-sm ${
            tool === "eraser"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Eraser
        </button>
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

      <svg
        ref={svgRef}
        className="flex-1 min-h-0 touch-none bg-white dark:bg-zinc-950"
        style={getBackgroundStyle()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {strokes.map((stroke) => (
          <path
            key={stroke.id}
            d={getSvgPathFromStroke(
              getStroke(stroke.points, {
                size: stroke.size,
                thinning: 0.6,
                smoothing: 0.5,
                streamline: 0.5,
              })
            )}
            fill={stroke.color}
          />
        ))}
        {activeOutline && <path d={activeOutline} fill={color} />}
      </svg>
    </div>
  );
}
