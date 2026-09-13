import type { Point, Rectangle } from "../platform/electron.js";

export function pointInDockRegion(point: Point, bounds: Rectangle): boolean {
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
}
