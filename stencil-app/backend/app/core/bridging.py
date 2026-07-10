"""Compute bridge geometry connecting each island to its surrounding field.

For each island (an even, non-zero depth region), a bridge is a thin rectangle
running from a point on the island's boundary, straight through its immediate
parent hole, to the nearest point on the *parent hole's own exterior* - the
boundary between the hole's open air and the solid material around it (field
or an ancestor island). That boundary is exactly the edge the island needs to
reconnect to; note it is not the grandparent's outer boundary in general (a
field region's own `.exterior` is the far outside edge of the whole canvas,
not the edge of any one hole cut into it - using it directly would route
bridges across the entire design instead of across the one hole they're
meant to span). Multiple bridges per island are anchored at evenly spaced
points around the island's boundary so they don't cluster on one side. A
bridge is discarded (and the island left un-bridged) if it crosses any
*unrelated* hole - one other than the hole it's meant to span - since that
would produce a bridge that doesn't actually reach open air above it.
"""

import math

from shapely.geometry import LineString, Point, Polygon
from shapely.geometry.base import BaseGeometry
from shapely.ops import nearest_points

from app.core.islands import ClassifiedRegion

# A bridge endpoint that lands exactly on the target boundary only *touches*
# solid material rather than overlapping it, so a boolean union can leave it
# tangent instead of fused. Extend each end past the boundary by this much so
# the bridge polygon has genuine overlap with both the island and the target.
OVERLAP_MM = 0.25


def _bridge_count(area_mm2: float, min_bridges_per_island: int, large_island_area_mm2: float) -> int:
    count = max(1, min_bridges_per_island)
    if area_mm2 > large_island_area_mm2:
        count = max(count, min_bridges_per_island + 1, 2)
    return count


def _extend(p1: Point, p2: Point, overlap_mm: float) -> tuple[Point, Point]:
    dx, dy = p2.x - p1.x, p2.y - p1.y
    length = math.hypot(dx, dy)
    if length == 0:
        return p1, p2
    ux, uy = dx / length, dy / length
    return (
        Point(p1.x - ux * overlap_mm, p1.y - uy * overlap_mm),
        Point(p2.x + ux * overlap_mm, p2.y + uy * overlap_mm),
    )


def _bridge_polygon(p1: Point, p2: Point, width_mm: float) -> Polygon:
    p1, p2 = _extend(p1, p2, OVERLAP_MM)
    return LineString([p1, p2]).buffer(width_mm / 2, cap_style="flat")


def _anchor_points(boundary: BaseGeometry, count: int) -> list[Point]:
    length = boundary.length
    return [boundary.interpolate((k / count) * length) for k in range(count)]


def compute_bridges(
    regions: list[ClassifiedRegion],
    bridge_width_mm: float,
    min_bridges_per_island: int,
    large_island_area_mm2: float,
) -> dict[int, list[Polygon]]:
    hole_regions = [(idx, r) for idx, r in enumerate(regions) if r.kind == "hole"]

    bridges: dict[int, list[Polygon]] = {}
    for idx, region in enumerate(regions):
        if region.kind != "island":
            continue
        parent_idx = region.parent_index
        if parent_idx is None:
            continue
        parent_hole = regions[parent_idx]
        if parent_hole.parent_index is None:
            continue

        island_ext = region.polygon.exterior
        target_ext = parent_hole.polygon.exterior
        count = _bridge_count(region.polygon.area, min_bridges_per_island, large_island_area_mm2)

        # First bridge uses the true globally-nearest point pair; any
        # additional bridges are anchored at evenly spaced points around the
        # island boundary so they spread around it rather than clustering.
        p_island, p_target = nearest_points(island_ext, target_ext)
        anchor_pairs = [(p_island, p_target)]
        for anchor in _anchor_points(island_ext, count)[1:]:
            t = target_ext.interpolate(target_ext.project(anchor))
            anchor_pairs.append((anchor, t))

        island_bridges = []
        for p_i, p_t in anchor_pairs:
            bridge = _bridge_polygon(p_i, p_t, bridge_width_mm)
            crosses_unrelated_hole = any(
                hidx != parent_idx and bridge.intersects(hole.polygon) for hidx, hole in hole_regions
            )
            if not crosses_unrelated_hole:
                island_bridges.append(bridge)

        if island_bridges:
            bridges[idx] = island_bridges

    return bridges
