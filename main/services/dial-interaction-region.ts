import type { Point, Rectangle } from "../platform/electron.js";

import type { CornerId, EdgeId } from "../types.js";

export function pointInDialRegion(
  point: Point,
  displayBounds: Rectangle,
  corner: CornerId,
  dialSize: number,
): boolean {
  const x = corner.includes("right")
    ? displayBounds.x + displayBounds.width - dialSize
    : displayBounds.x;
  const y = corner.includes("bottom")
    ? displayBounds.y + displayBounds.height - dialSize
    : displayBounds.y;

  return (
    point.x >= x &&
    point.x < x + dialSize &&
    point.y >= y &&
    point.y < y + dialSize
  );
}

export function pointInEdgeControlRegion(
  point: Point,
  displayBounds: Rectangle,
  edge: EdgeId,
  length: number,
  thickness: number,
): boolean {
  const { x: bx, y: by, width, height } = displayBounds;
  switch (edge) {
    case "left":
      return (
        point.x >= bx &&
        point.x < bx + thickness &&
        point.y >= by + (height - length) / 2 &&
        point.y < by + (height - length) / 2 + length
      );
    case "right":
      return (
        point.x >= bx + width - thickness &&
        point.x < bx + width &&
        point.y >= by + (height - length) / 2 &&
        point.y < by + (height - length) / 2 + length
      );
    case "top":
      return (
        point.y >= by &&
        point.y < by + thickness &&
        point.x >= bx + (width - length) / 2 &&
        point.x < bx + (width - length) / 2 + length
      );
    case "bottom":
      return (
        point.y >= by + height - thickness &&
        point.y < by + height &&
        point.x >= bx + (width - length) / 2 &&
        point.x < bx + (width - length) / 2 + length
      );
  }
}
