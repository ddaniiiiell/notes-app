export interface Notebook {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export type DrawingBackground = "dotted" | "grid" | "ruled" | "blank";

export interface Stroke {
  id: string;
  points: [number, number, number][]; // x, y, pressure
  color: string;
  size: number;
}

export interface TextBox {
  id: string;
  x: number;
  y: number;
  text: string;
  width?: number;
}

export interface Note {
  id: string;
  notebookId: string;
  title: string;
  text: string; // flattened text-box contents, kept in sync for search/previews
  strokes: Stroke[];
  textBoxes?: TextBox[];
  background?: DrawingBackground;
  createdAt: number;
  updatedAt: number;
}
