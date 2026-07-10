"""Build the final watertight mesh using the two-layer bridging technique.

Layer 1 (z: 0 -> base_height_mm): field + all bridged islands + all bridges,
    unioned into a single connected 2D footprint, then extruded. This is the
    structural layer - it's what actually holds the islands in place.
Layer 2 (z: base_height_mm -> base_height_mm + top_height_mm): field extruded
    on its own, and each bridged island extruded on its own (NOT unioned with
    field, NOT including bridges) - they only stay attached because they
    share footprint with layer 1 beneath them. This is what leaves the open
    gap above each bridge for paint to pass through.

Islands with no valid bridge (see bridging.py) are dropped from the mesh
entirely rather than left as unattached floating geometry - the corresponding
area is simply left open, same as if the island weren't there.
"""

import logging

import trimesh
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union

from app.core.islands import ClassifiedRegion

logger = logging.getLogger(__name__)


MIN_HOLE_AREA_MM2 = 1e-3  # drops numerical-noise slivers left by unary_union


def _drop_tiny_holes(polygon: Polygon) -> Polygon:
    """Union of near-tangent boundaries can leave near-zero-area interior
    rings that confuse the extrusion triangulator into producing a
    non-manifold mesh; strip anything below a negligible area threshold."""
    kept = [ring for ring in polygon.interiors if Polygon(ring).area >= MIN_HOLE_AREA_MM2]
    if len(kept) == len(polygon.interiors):
        return polygon
    return Polygon(polygon.exterior, holes=kept)


def _flatten(geom) -> list[Polygon]:
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [_drop_tiny_holes(geom)]
    if isinstance(geom, MultiPolygon):
        return [_drop_tiny_holes(g) for g in geom.geoms if not g.is_empty]
    return []


def _extrude(polygon: Polygon, height: float, z_offset: float = 0.0) -> trimesh.Trimesh:
    mesh = trimesh.creation.extrude_polygon(polygon, height=height)
    if z_offset:
        mesh.apply_translation([0, 0, z_offset])
    return mesh


def build_mesh(
    regions: list[ClassifiedRegion],
    bridges: dict[int, list],
    base_height_mm: float,
    top_height_mm: float,
) -> trimesh.Trimesh:
    field = next((r for r in regions if r.kind == "field"), None)
    if field is None:
        raise ValueError("No field region found - nothing to extrude.")

    bridged_islands = [(idx, r) for idx, r in enumerate(regions) if r.kind == "island" and bridges.get(idx)]
    skipped = [idx for idx, r in enumerate(regions) if r.kind == "island" and not bridges.get(idx)]
    if skipped:
        logger.warning("Skipping %d island(s) with no valid bridge: %s", len(skipped), skipped)

    bridge_polys = [poly for idx, _ in bridged_islands for poly in bridges[idx]]

    layer1_footprint = unary_union([field.polygon] + [r.polygon for _, r in bridged_islands] + bridge_polys)
    layer1_meshes = [_extrude(poly, base_height_mm) for poly in _flatten(layer1_footprint)]

    layer2_meshes = [_extrude(field.polygon, top_height_mm, z_offset=base_height_mm)]
    layer2_meshes += [_extrude(r.polygon, top_height_mm, z_offset=base_height_mm) for _, r in bridged_islands]

    mesh = trimesh.boolean.union(layer1_meshes + layer2_meshes, engine="manifold")

    if not mesh.is_watertight:
        logger.warning(
            "Generated stencil mesh is not watertight (bounds=%s). This usually means the "
            "layer-1 union of field+islands+bridges wasn't a single clean polygon.",
            mesh.bounds.tolist(),
        )

    return mesh
