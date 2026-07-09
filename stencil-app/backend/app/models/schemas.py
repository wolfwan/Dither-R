from pydantic import BaseModel, Field


class StencilParams(BaseModel):
    """User-tunable parameters for stencil generation.

    Sent alongside the uploaded SVG as form data (see api/routes.py).
    """

    base_height_mm: float = Field(
        default=1.0, gt=0, description="Height of the bottom fused layer (field + islands + bridges)."
    )
    top_height_mm: float = Field(
        default=1.0, gt=0, description="Height of the top layer (field + islands only, no bridges)."
    )
    bridge_width_mm: float = Field(
        default=1.5, gt=0, description="Width of each bridge strip."
    )
    min_bridges_per_island: int = Field(
        default=1, ge=1, description="Minimum number of bridges connecting each island to the field."
    )
    large_island_area_mm2: float = Field(
        default=200.0,
        gt=0,
        description="Islands with area above this threshold get an extra bridge for rigidity.",
    )
    scale_mm: float = Field(
        default=100.0,
        gt=0,
        description="Target size (mm) of the longest dimension of the design's bounding box.",
    )
    field_margin_mm: float = Field(
        default=5.0,
        gt=0,
        description="Solid border added around the design's bounding box to form the stencil field.",
    )

    @property
    def total_height_mm(self) -> float:
        return self.base_height_mm + self.top_height_mm


class IslandInfo(BaseModel):
    """Diagnostic info returned to the frontend so it can show what was detected,
    e.g. for a preview overlay before the user commits to generating the STL."""

    id: int
    area_mm2: float
    bridge_count: int


class GenerateResponse(BaseModel):
    island_count: int
    islands: list[IslandInfo]
    unbridged_island_count: int
    # STL itself is returned as the raw response body (application/sla), not JSON -
    # this schema is for the "/analyze" preview endpoint (see api/routes.py) that
    # runs parse -> classify -> bridge without the (slower) mesh extrusion + union.
