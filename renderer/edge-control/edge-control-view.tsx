import { useMemo } from "react";

import { OverlayControl } from "../lib/overlay-control";

type EdgeId = "left" | "right" | "top" | "bottom";

function currentEdge(): EdgeId {
  const edge = new URLSearchParams(window.location.search).get("edge");
  return edge === "right" || edge === "top" || edge === "bottom" ? edge : "left";
}

export function EdgeControlView() {
  const edge = useMemo(currentEdge, []);
  return <OverlayControl variant="edge" edge={edge} />;
}
