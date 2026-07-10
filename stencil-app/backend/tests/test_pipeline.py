"""Tests for the core geometry pipeline.

Stress-test fixtures (see ../sample_svgs/):
- letter_O.svg   -> single island, single hole, simplest case
- letter_A.svg   -> triangular island (the counter), tests non-circular bridging
- letter_B.svg   -> two islands (upper and lower counters) in one glyph
- letter_at.svg  -> nested islands (island within a hole within an island), tests
                    containment-tree depth > 2
- logo_text.svg  -> two independent glyphs (separate <path> elements) in one file
"""

from pathlib import Path

import pytest

from app.core import bridging, extrude, islands, svg_parser

SAMPLE_DIR = Path(__file__).resolve().parent.parent / "sample_svgs"

DEFAULT_PARAMS = dict(bridge_width_mm=1.5, min_bridges_per_island=1, large_island_area_mm2=200)


def _load(name: str, scale_mm: float = 100):
    svg_bytes = (SAMPLE_DIR / name).read_bytes()
    polygons = svg_parser.parse(svg_bytes, target_scale_mm=scale_mm)
    regions = islands.classify(polygons)
    bridges = bridging.compute_bridges(regions, **DEFAULT_PARAMS)
    return regions, bridges


def test_letter_O_produces_one_island_one_bridge_minimum():
    regions, bridges = _load("letter_O.svg")
    islands_only = [r for r in regions if r.kind == "island"]
    assert len(islands_only) == 1
    island_idx = next(i for i, r in enumerate(regions) if r.kind == "island")
    assert len(bridges[island_idx]) >= 1


def test_letter_A_triangular_island():
    regions, bridges = _load("letter_A.svg")
    islands_only = [r for r in regions if r.kind == "island"]
    assert len(islands_only) == 1
    island_idx = next(i for i, r in enumerate(regions) if r.kind == "island")
    assert len(bridges[island_idx]) >= 1


def test_letter_B_two_islands():
    regions, bridges = _load("letter_B.svg")
    islands_only = [r for r in regions if r.kind == "island"]
    assert len(islands_only) == 2
    for i, r in enumerate(regions):
        if r.kind == "island":
            assert len(bridges[i]) >= 1


def test_nested_islands_depth_handled():
    regions, bridges = _load("letter_at.svg")
    depths = sorted(r.depth for r in regions if r.kind == "island")
    # A bullseye of 4 concentric loops nests an island-within-a-hole-within-an-island:
    # depth 2 (first island) and depth 4 (island nested inside the depth-3 hole).
    assert depths == [2, 4]
    for i, r in enumerate(regions):
        if r.kind == "island":
            assert len(bridges[i]) >= 1


def test_logo_text_independent_regions():
    regions, _ = _load("logo_text.svg")
    holes = [r for r in regions if r.kind == "hole"]
    islands_only = [r for r in regions if r.kind == "island"]
    assert len(holes) == 2
    assert len(islands_only) == 2


@pytest.mark.parametrize(
    "name", ["letter_O.svg", "letter_A.svg", "letter_B.svg", "letter_at.svg", "logo_text.svg"]
)
def test_final_mesh_is_watertight(name):
    regions, bridges = _load(name)
    mesh = extrude.build_mesh(regions, bridges, base_height_mm=1.0, top_height_mm=1.0)
    assert mesh.is_watertight
    assert mesh.is_volume


def test_layer_heights_match_params():
    regions, bridges = _load("letter_O.svg")
    base_height_mm, top_height_mm = 1.2, 0.8
    mesh = extrude.build_mesh(regions, bridges, base_height_mm=base_height_mm, top_height_mm=top_height_mm)
    zmin, zmax = mesh.bounds[0][2], mesh.bounds[1][2]
    assert zmin == pytest.approx(0.0, abs=1e-6)
    assert zmax == pytest.approx(base_height_mm + top_height_mm, abs=1e-6)
