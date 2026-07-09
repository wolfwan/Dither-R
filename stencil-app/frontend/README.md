# Frontend

Minimal upload UI: pick an SVG, tune params, preview the STL with three.js,
download.

## Suggested setup (for Claude Code)

This scaffold intentionally doesn't include a package.json / build config yet -
have Claude Code scaffold a Vite + React project here (`npm create vite@latest .
-- --template react`) and then build:

- `src/UploadForm.jsx` — file picker + param sliders (base/top height, bridge
  width, min bridges, scale) posting to `POST /generate` on the backend.
- `src/StlViewer.jsx` — three.js (or `@react-three/fiber` + `STLLoader`) preview
  of the returned STL before/after download, so users can sanity-check bridges
  visually before slicing.
- `src/api.js` — thin fetch wrapper around the backend `/generate` endpoint,
  handling the binary STL response.

## Env

Point the frontend at the backend URL via an env var, e.g. `VITE_API_URL`,
defaulting to `http://localhost:8000` for local dev.
