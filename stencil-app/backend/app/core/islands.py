"""Classify parsed regions into field / hole / island using a containment tree.

Definitions:
- field: the main connected stencil body (background solid). The SVG's filled
  shapes represent the spray cutout (the letterform ink), so field is
  everything *outside* those shapes - a canvas rectangle (the design's
  bounding box plus a margin) with the filled shapes cut out of it.
- hole: a cutout region (e.g. the ring of the letter "O") - a top-level
  parsed polygon's own exterior boundary.
- island: a solid region fully enclosed by a hole, i.e. it would physically
  fall out if not for bridges (e.g. the disc inside the "O", the counter of
  "A"/"B"). Islands arise from a hole polygon's interior rings (cavities cut
  into the ink by the SVG fill-rule) as well as from other top-level parsed
  polygons that happen to sit inside one of those cavities (deeper nesting,
  e.g. "@").

Implementation:
- Every parsed polygon is decomposed into its constituent simple loops: its
  exterior ring plus each interior ring. A loop's origin (exterior vs.
  interior ring) has no bearing on its classification - only containment
  depth does, alternating field/hole/island/hole-within-island/... by
  parity. This handles arbitrary nesting depth, not just two levels.
- Each region's immediate parent is the containing loop with the greatest
  depth (the tightest fit). A region's final polygon is its own loop with
  its *direct* children's loops punched out as interior rings - which is
  exactly what downstream code needs: field/islands can be unioned per
  layer, and a later union with a region's children fills those holes back
  in with the correct (possibly further-holed) child geometry.
"""

from dataclasses import dataclass

from shapely.geometry import Polygon
from shapely.ops import unary_union

DEFAULT_FIELD_MARGIN_MM = 5.0


@dataclass
class ClassifiedRegion:
    polygon: Polygon
    depth: int  # 0 = field, 1 = hole, 2 = island, ...
    parent_index: int | None  # index into the returned list, or None for depth 0

    @property
    def kind(self) -> str:
        if self.depth == 0:
            return "field"
        return "island" if self.depth % 2 == 0 else "hole"


def _canvas_rect(polygons: list[Polygon], margin_mm: float) -> Polygon:
    minx, miny, maxx, maxy = unary_union(polygons).bounds
    return Polygon(
        [
            (minx - margin_mm, miny - margin_mm),
            (maxx + margin_mm, miny - margin_mm),
            (maxx + margin_mm, maxy + margin_mm),
            (minx - margin_mm, maxy + margin_mm),
        ]
    )


def classify(
    polygons: list[Polygon], field_margin_mm: float = DEFAULT_FIELD_MARGIN_MM
) -> list[ClassifiedRegion]:
    if not polygons:
        return []

    loops: list[Polygon] = [_canvas_rect(polygons, field_margin_mm)]
    for poly in polygons:
        loops.append(Polygon(poly.exterior))
        for ring in poly.interiors:
            loops.append(Polygon(ring))

    n = len(loops)
    areas = [loop.area for loop in loops]

    ancestors: list[list[int]] = [[] for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j and loops[j].contains(loops[i]):
                ancestors[i].append(j)

    depth = [len(a) for a in ancestors]

    parent_index: list[int | None] = [None] * n
    for i in range(n):
        if ancestors[i]:
            # Immediate parent = containing loop that is itself most deeply
            # nested (ties broken by smallest area, i.e. tightest fit).
            parent_index[i] = min(ancestors[i], key=lambda j: (-depth[j], areas[j]))

    children: list[list[int]] = [[] for _ in range(n)]
    for i in range(n):
        if parent_index[i] is not None:
            children[parent_index[i]].append(i)

    regions: list[ClassifiedRegion] = []
    for i in range(n):
        holes = [loops[c].exterior.coords for c in children[i]]
        polygon = Polygon(loops[i].exterior.coords, holes=holes)
        regions.append(ClassifiedRegion(polygon=polygon, depth=depth[i], parent_index=parent_index[i]))

    return regions
