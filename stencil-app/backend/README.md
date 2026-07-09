# Backend

FastAPI service that takes an uploaded SVG + stencil parameters and returns an STL.

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

API docs (Swagger UI) will be at http://localhost:8000/docs

## Run tests

```bash
pytest
```

## Module responsibilities

| Module | Responsibility |
|---|---|
| `app/core/svg_parser.py` | Load SVG, flatten curves, return list of `shapely.Polygon` with holes applied via fill-rule |
| `app/core/islands.py` | Build containment tree from polygons; classify each region as `field`, `hole`, or `island` |
| `app/core/bridging.py` | For each island, compute bridge geometry (strip polygons) connecting it to the nearest field boundary |
| `app/core/extrude.py` | Two-layer extrusion (see root README) + boolean union into a single watertight mesh |
| `app/core/export.py` | Serialize mesh to STL bytes |
| `app/api/routes.py` | `POST /generate` endpoint: upload -> pipeline -> STL download |
| `app/models/schemas.py` | Request params (base_height, top_height, bridge_width, min_bridges_per_island, scale_mm) and response schema |

## Design notes / open questions to resolve during implementation

- **Units**: SVG has no inherent physical units. Decide on a `scale_mm` param that
  maps the SVG viewBox's longest dimension to a real-world size.
- **Multiple bridges per island**: for large islands, one bridge may not be enough
  for rigidity. Consider a rule like "1 bridge per N mm of island perimeter,
  minimum 2 for islands above area threshold X".
- **Self-intersecting / malformed SVGs**: validate and buffer(0) polygons early to
  clean up degenerate geometry before it hits the boolean ops.
- **Nested islands** (island inside an island inside an island): the containment
  tree needs to handle depth > 2, not just field/hole/island.
