"use client";

import { useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { getSvgPathFromStroke } from "@/lib/stroke-path";
import type { Stroke } from "@/lib/types";

const COLORS = ["#18181b", "#dc2626", "#2563eb", "#16a34a", "#d97706"];
const SIZES = [2, 4, 8, 16];

interface DrawCanvasProps {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
}

export default function DrawCanvas({ strokes, onChange }: DrawCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [activePoints, setActivePoints] = useState<[number, number, number][]>([]);
  const drawing = useRef(false);

  function getPoint(e: React.PointerEvent<SVGSVGElement>): [number, number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    return [e.clientX - rect.left, e.clientY - rect.top, pressure];
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.pointerType !== "pen" && e.pointerType !== "touch") return;
    svgRef.current?.setPointerCapture(e.pointerId);

    if (tool === "eraser") {
      drawing.current = true;
      eraseNear(getPoint(e));
      return;
    }

    drawing.current = true;
    setActivePoints([getPoint(e)]);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawing.current) return;

    if (tool === "eraser") {
      eraseNear(getPoint(e));
      return;
    }

    setActivePoints((prev) => [...prev, getPoint(e)]);
  }

  function handlePointerUp() {
    if (!drawing.current) return;
    drawing.current = false;

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
        style={{ backgroundImage: "radial-gradient(circle, #d4d4d8 1px, transparent 1px)", backgroundSize: "20px 20px" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
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
