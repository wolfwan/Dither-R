"""Parse an uploaded SVG into a list of shapely polygons, scaled to real-world mm.

Each filled shape in the SVG is flattened into one or more closed loops
(subpaths). Loops belonging to the same shape are combined into a single
shapely geometry honoring that shape's fill-rule:

- evenodd: symmetric difference of all loops, in document order - a direct
  geometric implementation of the even-odd fill rule.
- nonzero: loops are unioned if wound counter-clockwise (positive signed
  area) and subtracted if wound clockwise (negative signed area). This
  matches nonzero winding for the common case of simple, non-self-crossing
  nested contours (real-world glyph/logo art).

The combined geometry for each shape may be a MultiPolygon (disjoint filled
regions); it is flattened so this function always returns a flat
list[Polygon], each possibly with interior rings (holes) per shapely's
normal representation. Coordinates are scaled so the combined bounding box's
longest dimension equals target_scale_mm.
"""

import io

import svgelements as se
from shapely.affinity import scale as shapely_scale, translate
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union

FLATTEN_TOLERANCE_PX = 0.75


def _flatten_segment(seg) -> list[tuple[float, float]]:
    length = seg.length()
    if length == 0:
        return []
    steps = max(1, int(length / FLATTEN_TOLERANCE_PX))
    points = []
    for i in range(1, steps + 1):
        pt = seg.point(i / steps)
        points.append((pt.x, pt.y) if hasattr(pt, "x") else tuple(pt))
    return points


def _segments_to_loops(path: "se.Path") -> list[list[tuple[float, float]]]:
    """Split a Path's flattened segments into closed point loops on Move/Close."""
    loops: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    for seg in path.segments():
        if isinstance(seg, se.Move):
            if len(current) >= 3:
                loops.append(current)
            start = seg.end
            current = [(start.x, start.y)]
        elif isinstance(seg, se.Close):
            if len(current) >= 3:
                loops.append(current)
            current = []
        else:
            current.extend(_flatten_segment(seg))
    if len(current) >= 3:
        loops.append(current)
    return loops


def _signed_area(points: list[tuple[float, float]]) -> float:
    area = 0.0
    n = len(points)
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return area / 2.0


def _combine_loops(loops: list[list[tuple[float, float]]], fill_rule: str):
    result = Polygon()
    if fill_rule == "evenodd":
        for pts in loops:
            poly = Polygon(pts).buffer(0)
            result = result.symmetric_difference(poly)
    else:  # nonzero (default per SVG spec)
        for pts in loops:
            poly = Polygon(pts).buffer(0)
            if _signed_area(pts) >= 0:
                result = result.union(poly)
            else:
                result = result.difference(poly)
    return result


def _flatten_to_polygons(geom) -> list[Polygon]:
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return [g for g in geom.geoms if not g.is_empty]
    return []


def parse(svg_bytes: bytes, target_scale_mm: float) -> list[Polygon]:
    svg = se.SVG.parse(io.BytesIO(svg_bytes))

    polygons: list[Polygon] = []
    for element in svg.elements():
        if not isinstance(element, se.Path):
            continue
        if element.values.get("fill") in (None, "none"):
            continue
        fill_rule = (element.values.get("fill-rule") or "nonzero").strip().lower()
        loops = _segments_to_loops(element)
        if not loops:
            continue
        geom = _combine_loops(loops, fill_rule).buffer(0)
        polygons.extend(_flatten_to_polygons(geom))

    if not polygons:
        return []

    minx, miny, maxx, maxy = unary_union(polygons).bounds
    longest = max(maxx - minx, maxy - miny)
    scale = target_scale_mm / longest if longest > 0 else 1.0

    def _rescale(poly: Polygon) -> Polygon:
        translated = translate(poly, xoff=-minx, yoff=-miny)
        return shapely_scale(translated, xfact=scale, yfact=scale, origin=(0, 0))

    return [_rescale(p).buffer(0) for p in polygons]
