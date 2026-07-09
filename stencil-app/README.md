# Stencil Generator

Turns 2D vector art (SVG) into 3D-printable spray stencils (STL), with automatic
bridge insertion so "floating" islands (the center of an O, the counter of an A, etc.)
stay attached to the rest of the stencil without blocking spray flow.

## How the bridging technique works

The stencil is built in two extruded layers instead of one:

- **Bottom layer (0 -> BASE_HEIGHT):** field + islands + bridges are all fused into
  a single connected solid. This is what gives the part structural integrity.
- **Top layer (BASE_HEIGHT -> BASE_HEIGHT + TOP_HEIGHT):** field and islands are
  extruded *separately*, with no bridge material. Each island's top layer sits on
  top of its own footprint from the bottom layer, so it stays attached, but there's
  an open gap directly above every bridge.

Net effect: paint can drift under each bridge and still hit the surface, instead of
leaving a hard bridge-shaped shadow line the way a single-layer bridge would.

## Project layout

```
backend/
  app/
    core/        <- geometry pipeline (SVG parsing, island detection, bridging, extrusion/STL)
    api/         <- FastAPI routes
    models/      <- pydantic request/response schemas
  tests/
  sample_svgs/   <- test fixtures (letters with counters are good stress tests: A, B, O, R, @)
frontend/
  src/           <- upload UI + three.js STL preview
```

## Getting started

See `backend/README.md` and `frontend/README.md` for setup instructions specific
to each half of the app.

## Suggested build order (for Claude Code)

1. `core/svg_parser.py` — flatten SVG paths to polygons, respecting fill-rule.
2. `core/islands.py` — build containment tree, detect islands vs. field vs. holes.
3. `core/bridging.py` — nearest-point bridge placement between island and field.
4. `core/extrude.py` — two-layer extrusion + boolean union → mesh.
5. `core/export.py` — mesh → STL bytes.
6. `api/routes.py` — upload endpoint wiring the above together.
7. `frontend` — upload form, param controls, three.js preview, download button.

Steps 1-4 are the novel part and are worth prototyping and testing against the
SVGs in `backend/sample_svgs/` *before* wiring up the API or frontend.
