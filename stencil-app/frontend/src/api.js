const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function paramsToFormData(file, params) {
  const formData = new FormData();
  formData.append("file", file);
  for (const [key, value] of Object.entries(params)) {
    formData.append(key, String(value));
  }
  return formData;
}

async function parseError(response) {
  try {
    const body = await response.json();
    return body.detail || response.statusText;
  } catch {
    return response.statusText;
  }
}

/** Runs parse -> classify -> bridge only; returns island/bridge diagnostics. */
export async function analyzeStencil(file, params) {
  const response = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    body: paramsToFormData(file, params),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

/** Runs the full pipeline and returns the generated STL as an ArrayBuffer. */
export async function generateStencil(file, params) {
  const response = await fetch(`${API_URL}/generate`, {
    method: "POST",
    body: paramsToFormData(file, params),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : "stencil.stl";
  const arrayBuffer = await response.arrayBuffer();
  return { arrayBuffer, filename };
}
