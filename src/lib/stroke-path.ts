// Converts the polygon points from perfect-freehand's getStroke() into a
// smoothed SVG path string, so ink renders as a scalable vector shape.
export function getSvgPathFromStroke(points: number[][]): string {
  if (points.length === 0) return "";

  const d = points.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", points[0][0], points[0][1], "Q"] as (string | number)[]
  );

  return d.join(" ") + " Z";
}
