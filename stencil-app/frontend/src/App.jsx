import { useState } from "react";
import UploadForm from "./UploadForm.jsx";
import StlViewer from "./StlViewer.jsx";
import { analyzeStencil, generateStencil } from "./api.js";

export default function App() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [stl, setStl] = useState(null); // { arrayBuffer, filename }

  const handleAnalyze = async (file, params) => {
    setBusy(true);
    setError(null);
    try {
      const result = await analyzeStencil(file, params);
      setAnalysis(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async (file, params) => {
    setBusy(true);
    setError(null);
    try {
      const result = await generateStencil(file, params);
      setStl(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!stl) return;
    const blob = new Blob([stl.arrayBuffer], { type: "application/sla" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = stl.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header>
        <h1>Stencil Generator</h1>
        <p>Upload an SVG, tune the bridging parameters, and export a 3D-printable spray stencil.</p>
      </header>

      <main>
        <UploadForm onAnalyze={handleAnalyze} onGenerate={handleGenerate} busy={busy} />

        {error && <div className="error">{error}</div>}
        {busy && <div className="status">Working…</div>}

        {analysis && (
          <div className="analysis">
            <h2>Preview</h2>
            <p>
              {analysis.island_count} island{analysis.island_count === 1 ? "" : "s"} detected
              {analysis.unbridged_island_count > 0 && (
                <strong> — {analysis.unbridged_island_count} could not be bridged and will be dropped</strong>
              )}
            </p>
            <ul>
              {analysis.islands.map((island) => (
                <li key={island.id}>
                  Island {island.id}: {island.area_mm2.toFixed(1)} mm², {island.bridge_count} bridge
                  {island.bridge_count === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          </div>
        )}

        {stl && (
          <div className="result">
            <h2>Result</h2>
            <StlViewer stlArrayBuffer={stl.arrayBuffer} />
            <button onClick={handleDownload}>Download {stl.filename}</button>
          </div>
        )}
      </main>
    </div>
  );
}
