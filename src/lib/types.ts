export interface Notebook {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface Stroke {
  id: string;
  points: [number, number, number][]; // x, y, pressure
  color: string;
  size: number;
}

export interface Note {
  id: string;
  notebookId: string;
  title: string;
  text: string;
  strokes: Stroke[];
  createdAt: number;
  updatedAt: number;
}
