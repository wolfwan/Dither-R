import io
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core import bridging, export, extrude
from app.core import islands as islands_mod
from app.core import svg_parser
from app.models.schemas import GenerateResponse, IslandInfo, StencilParams

router = APIRouter()


def _run_pipeline(svg_bytes: bytes, params: StencilParams):
    polygons = svg_parser.parse(svg_bytes, target_scale_mm=params.scale_mm)
    classified = islands_mod.classify(polygons, field_margin_mm=params.field_margin_mm)
    bridges = bridging.compute_bridges(
        classified,
        bridge_width_mm=params.bridge_width_mm,
        min_bridges_per_island=params.min_bridges_per_island,
        large_island_area_mm2=params.large_island_area_mm2,
    )
    return classified, bridges


@router.post("/generate")
async def generate_stencil(
    file: UploadFile = File(...),
    params: Annotated[StencilParams, Form()] = StencilParams(),
) -> StreamingResponse:
    """Upload an SVG, get back an STL.

    Pipeline: parse -> classify islands -> compute bridges -> extrude two layers
    -> boolean union -> export STL.
    """
    if not file.filename.lower().endswith(".svg"):
        raise HTTPException(status_code=400, detail="File must be an .svg")

    svg_bytes = await file.read()
    classified, bridges = _run_pipeline(svg_bytes, params)
    mesh = extrude.build_mesh(
        classified,
        bridges,
        base_height_mm=params.base_height_mm,
        top_height_mm=params.top_height_mm,
    )
    stl_bytes = export.to_stl_bytes(mesh)

    return StreamingResponse(
        io.BytesIO(stl_bytes),
        media_type="application/sla",
        headers={"Content-Disposition": f'attachment; filename="{file.filename.rsplit(".", 1)[0]}_stencil.stl"'},
    )


@router.post("/analyze", response_model=GenerateResponse)
async def analyze_stencil(
    file: UploadFile = File(...),
    params: Annotated[StencilParams, Form()] = StencilParams(),
) -> GenerateResponse:
    """Cheap preview: parse + classify + bridge only (no mesh extrusion/union),
    so the frontend can show island/bridge counts before committing to the
    slower full STL generation."""
    if not file.filename.lower().endswith(".svg"):
        raise HTTPException(status_code=400, detail="File must be an .svg")

    svg_bytes = await file.read()
    classified, bridges = _run_pipeline(svg_bytes, params)

    islands_info = [
        IslandInfo(id=idx, area_mm2=region.polygon.area, bridge_count=len(bridges.get(idx, [])))
        for idx, region in enumerate(classified)
        if region.kind == "island"
    ]
    unbridged = sum(1 for info in islands_info if info.bridge_count == 0)

    return GenerateResponse(
        island_count=len(islands_info),
        islands=islands_info,
        unbridged_island_count=unbridged,
    )
