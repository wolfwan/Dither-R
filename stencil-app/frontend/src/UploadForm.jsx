import { useState } from "react";

const DEFAULT_PARAMS = {
  base_height_mm: 1.0,
  top_height_mm: 1.0,
  bridge_width_mm: 1.5,
  min_bridges_per_island: 1,
  large_island_area_mm2: 200,
  scale_mm: 100,
  field_margin_mm: 5,
};

const FIELDS = [
  { key: "scale_mm", label: "Design size (mm, longest side)", step: 1, min: 1 },
  { key: "base_height_mm", label: "Base layer height (mm)", step: 0.1, min: 0.1 },
  { key: "top_height_mm", label: "Top layer height (mm)", step: 0.1, min: 0.1 },
  { key: "bridge_width_mm", label: "Bridge width (mm)", step: 0.1, min: 0.1 },
  { key: "min_bridges_per_island", label: "Min bridges per island", step: 1, min: 1 },
  { key: "large_island_area_mm2", label: "Large island threshold (mm²)", step: 10, min: 10 },
  { key: "field_margin_mm", label: "Field margin (mm)", step: 1, min: 0 },
];

export default function UploadForm({ onAnalyze, onGenerate, busy }) {
  const [file, setFile] = useState(null);
  const [params, setParams] = useState(DEFAULT_PARAMS);

  const updateParam = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: Number(value) }));
  };

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0] || null;
    setFile(picked);
  };

  return (
    <form
      className="upload-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (file) onGenerate(file, params);
      }}
    >
      <label className="file-picker">
        <span>SVG file</span>
        <input type="file" accept=".svg,image/svg+xml" onChange={handleFileChange} />
      </label>

      <div className="param-grid">
        {FIELDS.map(({ key, label, step, min }) => (
          <label key={key} className="param-field">
            <span>{label}</span>
            <input
              type="number"
              step={step}
              min={min}
              value={params[key]}
              onChange={(e) => updateParam(key, e.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="actions">
        <button type="button" disabled={!file || busy} onClick={() => onAnalyze(file, params)}>
          Preview islands
        </button>
        <button type="submit" disabled={!file || busy}>
          Generate STL
        </button>
      </div>
    </form>
  );
}
