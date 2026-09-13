#!/usr/bin/env python3
"""Generate Halo's flat app icon (PNG + ICNS). No gradients, no bloom."""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError as exc:  # pragma: no cover
    print(
        "generate-app-icon: Pillow is required. Install with:\n"
        "  python3 -m pip install -r scripts/requirements-icon.txt",
        file=sys.stderr,
    )
    raise SystemExit(1) from exc


# Overlay plate rgba(22,22,24) → #161618; brightness accent from role-visuals
PLATE = (22, 22, 24, 255)
AMBER = (251, 191, 36, 255)

SIZE = 1024
# ~10% safe margin for macOS squircle mask
MARGIN_RATIO = 0.10
# Outer ring radius as fraction of half-canvas after margin
RING_OUTER_RATIO = 0.92
# Tube thickness ~20% of canvas diameter → ~40% of outer radius span
TUBE_RATIO = 0.20  # of full canvas size


def draw_icon(size: int = SIZE) -> Image.Image:
    img = Image.new("RGBA", (size, size), PLATE)
    draw = ImageDraw.Draw(img)

    cx = cy = size / 2
    margin = size * MARGIN_RATIO
    max_r = (size / 2) - margin
    outer_r = max_r * RING_OUTER_RATIO
    tube = size * TUBE_RATIO
    inner_r = outer_r - tube

    # Solid amber annulus (outer disk minus inner hole) — a perfect,
    # fully symmetric ring/halo. No protrusions.
    bbox_outer = [cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r]
    draw.ellipse(bbox_outer, fill=AMBER)
    bbox_inner = [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r]
    draw.ellipse(bbox_inner, fill=PLATE)

    return img


def iconset_files() -> list[tuple[str, int]]:
    return [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]


def write_icns(master: Image.Image, dest: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="halo-iconset-") as tmp:
        iconset = Path(tmp) / "app-icon.iconset"
        iconset.mkdir()
        for name, px in iconset_files():
            resized = master.resize((px, px), Image.Resampling.LANCZOS)
            resized.save(iconset / name, format="PNG")

        out = dest.with_suffix(".icns")
        result = subprocess.run(
            ["iconutil", "-c", "icns", str(iconset), "-o", str(out)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"iconutil failed:\n{result.stdout}\n{result.stderr}"
            )


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    png_path = root / "app-icon.png"
    icns_path = root / "app-icon.icns"

    master = draw_icon(SIZE)
    master.save(png_path, format="PNG", optimize=True)
    write_icns(master, icns_path)

    print(f"Wrote {png_path}")
    print(f"Wrote {icns_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001 — CLI surface
        print(f"generate-app-icon: {exc}", file=sys.stderr)
        raise SystemExit(1)
