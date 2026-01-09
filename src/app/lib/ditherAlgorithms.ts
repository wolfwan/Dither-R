import { AlgorithmName, Color, DitherSettings } from "../types";

// --- Helpers ---

const getPixelIndex = (x: number, y: number, width: number) => (y * width + x) * 4;

const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

// Simple Euclidean distance for closest color
const getClosestColor = (r: number, g: number, b: number, palette: Color[]): Color => {
  let minDist = Infinity;
  let closest = palette[0];

  for (const color of palette) {
    const dr = r - color.r;
    const dg = g - color.g;
    const db = b - color.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < minDist) {
      minDist = dist;
      closest = color;
    }
  }
  return closest;
};

// --- Kernels ---

type Kernel = {
  offset: [number, number]; // x, y offset
  weight: number;
}[];

const createKernel = (divisor: number, matrix: number[][], originX: number): Kernel => {
  const kernel: Kernel = [];
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      const weight = matrix[y][x];
      if (weight !== 0) {
        // originX is the index of the current pixel in the top row (y=0)
        // matrix includes the current row (y=0) and subsequent rows
        // We only care about pixels *after* the current one in raster order
        // The matrix input usually includes the current pixel row starting from the current pixel or before
        // Standard definition:
        // FS:
        //   X  7
        // 3 5  1
        // matrix: [[0, 0, 7], [3, 5, 1]] (if we pad)
        // simpler: pass specific offsets
      }
    }
  }
  return kernel; // Re-implementing manually for clarity below
};

const KERNELS: Record<string, { divisor: number; items: { x: number; y: number; w: number }[] }> = {
  "Floyd-Steinberg": {
    divisor: 16,
    items: [
      { x: 1, y: 0, w: 7 },
      { x: -1, y: 1, w: 3 },
      { x: 0, y: 1, w: 5 },
      { x: 1, y: 1, w: 1 },
    ],
  },
  "Atkinson": {
    divisor: 8,
    items: [
      { x: 1, y: 0, w: 1 },
      { x: 2, y: 0, w: 1 },
      { x: -1, y: 1, w: 1 },
      { x: 0, y: 1, w: 1 },
      { x: 1, y: 1, w: 1 },
      { x: 0, y: 2, w: 1 },
    ],
  },
  "Jarvis-Judice-Ninke": {
    divisor: 48,
    items: [
      { x: 1, y: 0, w: 7 },
      { x: 2, y: 0, w: 5 },
      { x: -2, y: 1, w: 3 },
      { x: -1, y: 1, w: 5 },
      { x: 0, y: 1, w: 7 },
      { x: 1, y: 1, w: 5 },
      { x: 2, y: 1, w: 3 },
      { x: -2, y: 2, w: 1 },
      { x: -1, y: 2, w: 3 },
      { x: 0, y: 2, w: 5 },
      { x: 1, y: 2, w: 3 },
      { x: 2, y: 2, w: 1 },
    ],
  },
  "Stucki": {
    divisor: 42,
    items: [
      { x: 1, y: 0, w: 8 },
      { x: 2, y: 0, w: 4 },
      { x: -2, y: 1, w: 2 },
      { x: -1, y: 1, w: 4 },
      { x: 0, y: 1, w: 8 },
      { x: 1, y: 1, w: 4 },
      { x: 2, y: 1, w: 2 },
      { x: -2, y: 2, w: 1 },
      { x: -1, y: 2, w: 2 },
      { x: 0, y: 2, w: 4 },
      { x: 1, y: 2, w: 2 },
      { x: 2, y: 2, w: 1 },
    ],
  },
  "Burkes": {
    divisor: 32,
    items: [
      { x: 1, y: 0, w: 8 },
      { x: 2, y: 0, w: 4 },
      { x: -2, y: 1, w: 2 },
      { x: -1, y: 1, w: 4 },
      { x: 0, y: 1, w: 8 },
      { x: 1, y: 1, w: 4 },
      { x: 2, y: 1, w: 2 },
    ],
  },
  "Sierra": {
    divisor: 32,
    items: [
      { x: 1, y: 0, w: 5 },
      { x: 2, y: 0, w: 3 },
      { x: -2, y: 1, w: 2 },
      { x: -1, y: 1, w: 4 },
      { x: 0, y: 1, w: 5 },
      { x: 1, y: 1, w: 4 },
      { x: 2, y: 1, w: 2 },
      { x: -1, y: 2, w: 2 },
      { x: 0, y: 2, w: 3 },
      { x: 1, y: 2, w: 2 },
    ],
  },
  "Two-Row Sierra": {
    divisor: 16,
    items: [
      { x: 1, y: 0, w: 4 },
      { x: 2, y: 0, w: 3 },
      { x: -2, y: 1, w: 1 },
      { x: -1, y: 1, w: 2 },
      { x: 0, y: 1, w: 3 },
      { x: 1, y: 1, w: 2 },
      { x: 2, y: 1, w: 1 },
    ],
  },
  "Sierra Lite": {
    divisor: 4,
    items: [
      { x: 1, y: 0, w: 2 },
      { x: -1, y: 1, w: 1 },
      { x: 0, y: 1, w: 1 },
    ],
  },
};

// --- Bayer Matrices ---

const bayer2 = [
  [0, 2],
  [3, 1],
];

const bayer4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const bayer8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

// --- Preprocessing ---

const clamp = (v: number) => Math.max(0, Math.min(255, v));

export const processImage = (
  original: ImageData,
  settings: DitherSettings
): ImageData => {
  const width = original.width;
  const height = original.height;
  const output = new ImageData(
    new Uint8ClampedArray(original.data),
    width,
    height
  );
  const data = output.data;

  // 1. Adjustments (Brightness, Contrast, Levels, Noise)
  // We handle pixel-level ops here.

  const brightnessOffset = settings.brightness * 2.55; // -255 to 255
  const contrastFactor =
    (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast));
  const noiseAmount = settings.noise;

  // Levels params
  const lMin = settings.levelsShadows ?? 0;
  const lMax = settings.levelsHighlights ?? 255;
  const lMid = settings.levelsMidtones ?? 1.0; // Gamma

  // Pre-calculate levels lookup table or handle per-pixel?
  // Per-pixel with pow() might be slow. Optimization: Lookup Table (LUT).
  // Creating a 0-255 LUT for the levels/gamma transformation.
  const levelsLUT = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
      let v = i;
      
      // Input Mapping (Black/White point)
      // v = (v - lMin) / (lMax - lMin)
      let normalized = (v - lMin) / (lMax - lMin);
      normalized = Math.max(0, Math.min(1, normalized)); // Clamp 0-1

      // Gamma Correction
      // v = pow(v, 1/gamma)
      if (lMid !== 1.0) {
          normalized = Math.pow(normalized, 1 / lMid);
      }

      // Scale back
      levelsLUT[i] = Math.round(normalized * 255);
  }

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Levels (Apply first as it sets the tonal range)
    r = levelsLUT[r];
    g = levelsLUT[g];
    b = levelsLUT[b];

    // Contrast
    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;

    // Brightness
    r += brightnessOffset;
    g += brightnessOffset;
    b += brightnessOffset;

    // Noise
    if (noiseAmount > 0) {
      const noise = (Math.random() - 0.5) * noiseAmount * 2;
      r += noise;
      g += noise;
      b += noise;
    }

    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }

  // 2. Dithering
  // Clone data for error diffusion so we don't mess up if we re-run (though we created 'output' already)
  // Actually 'output' is our working buffer.

  const { algorithm, palette } = settings;

  if (algorithm === "Threshold") {
     for (let i = 0; i < data.length; i += 4) {
        const closest = getClosestColor(data[i], data[i+1], data[i+2], palette);
        data[i] = closest.r;
        data[i+1] = closest.g;
        data[i+2] = closest.b;
        data[i+3] = 255;
     }
     return output;
  }

  if (algorithm.startsWith("Ordered")) {
    let map: number[][] = bayer2;
    let div = 4;
    if (algorithm.includes("4x4")) { map = bayer4; div = 16; }
    if (algorithm.includes("8x8")) { map = bayer8; div = 64; }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = getPixelIndex(x, y, width);
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];

        const threshold = ((map[y % map.length][x % map[0].length] + 0.5) / div) * 255;
        
        // Ordered dithering usually compares luminance to threshold, 
        // OR adds threshold to color and then quantizes.
        // Standard approach: color + (threshold - 128) -> Quantize
        // Simpler for arbitrary palettes:
        // We want to bias the color selection based on the threshold.
        // A common trick for ordered dither with arbitrary palette:
        // col = col + (threshold - 128) * spread
        
        const spread = 64; // Adjustable strength
        const bias = (threshold - 128) / 128 * spread; // -spread/2 to spread/2 roughly

        const r2 = clamp(r + bias);
        const g2 = clamp(g + bias);
        const b2 = clamp(b + bias);

        const closest = getClosestColor(r2, g2, b2, palette);
        data[i] = closest.r;
        data[i+1] = closest.g;
        data[i+2] = closest.b;
        data[i+3] = 255;
      }
    }
    return output;
  }
  
  if (algorithm === "Random" || algorithm === "Blue Noise") {
      // Simple random dithering
      for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          
          const noise = (Math.random() - 0.5) * 64; 
          const closest = getClosestColor(clamp(r + noise), clamp(g + noise), clamp(b + noise), palette);
          
          data[i] = closest.r;
          data[i+1] = closest.g;
          data[i+2] = closest.b;
          data[i+3] = 255;
      }
      return output;
  }

  if (algorithm === "Checker") {
    // checker: Vertical lines made of dots that warp based on image luminance
    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % width;
      const y = Math.floor((i / 4) / width);

      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];

      const lum = luminance(r, g, b); // 0-255

      // 1. Define the vertical lines
      // We start with a base X frequency (vertical stripes)
      // We add a 'warp' factor based on luminance to bend the lines
      const lineFreq = 0.6;
      const warpStrength = (lum / 255) * 8.0; 
      const xPhase = x * lineFreq + warpStrength;

      // 2. Define the dots along the lines
      // High frequency Y sine wave creates the "dots" pattern along the vertical line
      const dotFreq = 0.6;
      const yPhase = y * dotFreq;

      // 3. Combine to create dotted lines
      // sin(x) * sin(y) creates a grid of dots. Shifting x based on lum warps the grid.
      // We threshold the sine wave product to make the dots sharper
      const signal = Math.sin(xPhase) * Math.sin(yPhase);
      
      const bias = signal * 140;

      const closest = getClosestColor(
        clamp(r + bias),
        clamp(g + bias),
        clamp(b + bias),
        palette
      );

      data[i] = closest.r;
      data[i+1] = closest.g;
      data[i+2] = closest.b;
      data[i+3] = 255;
    }
    return output;
  }

  if (algorithm === "Circuitry") {
    // Circuitry: PCB-style traces
    // User request: lines only go vertical or 45 degrees, and MUST connect.
    // We use a phase-accumulation approach to ensure continuous lines.
    
    const width = original.width;
    const height = original.height;
    
    // Buffer to track the vertical phase shift for each column
    const phaseY = new Float32Array(width).fill(0);
    const freq = 0.8; // Controls line density
    
    // Temporary buffer for smoothing phase to prevent tearing
    const nextPhaseY = new Float32Array(width);

    for (let y = 0; y < height; y++) {
        const rowOffset = y * width * 4;
        
        // 1. Calculate target slope for this row based on luminance
        // We want strict Vertical (0) or Diagonal (1) based on regions
        const rowSlopes = new Float32Array(width);
        
        for (let x = 0; x < width; x++) {
            const i = rowOffset + x * 4;
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            const lum = luminance(r, g, b);
            
            // Quantize to bands to create distinct regions of direction
            // 4 bands: Vert | Diag | Vert | Diag
            const band = Math.floor(lum / 255 * 5); 
            const isDiag = band % 2 === 1;
            
            rowSlopes[x] = isDiag ? 1 : 0;
        }

        // 2. Update phaseY buffer
        // We diffuse the phase horizontally to ensure lines curve instead of breaking
        // This is crucial for the "connecting" requirement
        
        for (let x = 0; x < width; x++) {
             // Add the vertical accumulation (slope * freq)
             // If slope is 1, phase increases by freq per row -> diagonal line
             // If slope is 0, phase constant per row -> vertical line
             let currentP = phaseY[x] + rowSlopes[x] * freq;
             nextPhaseY[x] = currentP;
        }

        // Apply horizontal smoothing to the accumulated phase
        // This makes the transition between Vert and Diag regions smooth (curved lines)
        // rather than sharp discontinuous breaks.
        for (let x = 1; x < width - 1; x++) {
            phaseY[x] = nextPhaseY[x-1] * 0.2 + nextPhaseY[x] * 0.6 + nextPhaseY[x+1] * 0.2;
        }
        // Handle edges
        phaseY[0] = nextPhaseY[0];
        phaseY[width-1] = nextPhaseY[width-1];

        // 3. Render the row
        for (let x = 0; x < width; x++) {
            const i = rowOffset + x * 4;
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            
            // The phase at this pixel is the base horizontal phase (x * freq)
            // plus the accumulated vertical phase shift (phaseY)
            const phase = x * freq + phaseY[x];
            
            const traceSignal = Math.abs(Math.sin(phase));
            
            // Threshold for line thickness. 
            // Diagonal lines effectively look thinner in X-cross-section if we don't adjust,
            // but standard constant threshold usually looks fine and consistent with pixel art.
            const isTrace = traceSignal < 0.25; 
            
            let bias = -120; // Background
            if (isTrace) {
                bias = 120; // Trace
            }

            const closest = getClosestColor(
                clamp(r + bias),
                clamp(g + bias),
                clamp(b + bias),
                palette
            );

            data[i] = closest.r;
            data[i+1] = closest.g;
            data[i+2] = closest.b;
            data[i+3] = 255;
        }
    }
    return output;
  }
  
  if (algorithm === "Fizz") {
     // Fizz: Duplicate of OLD Circuitry (before the straight lines change)
     // Returns to the more contour-following, multi-angle style with noise
    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % width;
      const y = Math.floor((i / 4) / width);

      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];

      const lum = luminance(r, g, b); // 0-255

      // Quantize luminance to separate image into regions (isophotes)
      const bands = 12; 
      const lumLevel = Math.floor((lum / 255) * bands);
      
      let phase = 0;
      const freq = 0.8; 
      
      // We alternate directions to delineate contours
      // Original logic with 3 directions
      const type = lumLevel % 3;
      
      if (type === 0) {
          // Vertical Lines (90 deg)
          phase = x * freq;
      } else if (type === 1) {
          // Diagonal (45 deg)
          phase = (x + y) * (freq * 0.707);
      } else {
          // Diagonal (135 deg)
          phase = (x - y) * (freq * 0.707);
      }
      
      // Shift phase per band so lines don't align at boundaries
      phase += lumLevel * 100;

      // Create sharp traces
      const traceSignal = Math.abs(Math.sin(phase));
      const isTrace = traceSignal < 0.25; // Thinner, crisper traces
      
      let bias = 0;
      if (isTrace) {
          bias = 120;
          // Circuitry noise: break lines occasionally
          if (Math.sin(x * 0.23) * Math.sin(y * 0.17) > 0.8) bias = -50;
      } else {
          bias = -120;
      }

      const closest = getClosestColor(
        clamp(r + bias),
        clamp(g + bias),
        clamp(b + bias),
        palette
      );

      data[i] = closest.r;
      data[i+1] = closest.g;
      data[i+2] = closest.b;
      data[i+3] = 255;
    }
    return output;
  }

  // Error Diffusion (Floyd-Steinberg, etc.)
  const kernel = KERNELS[algorithm];
  if (!kernel) return output; // Should not happen

  // We need to work with numbers that can exceed 0-255 temporarily for error propagation
  // The Uint8ClampedArray will clamp automatically on write, which destroys error info.
  // So we need a Float32 buffer or similar.
  const buffer = new Float32Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    buffer[j] = data[i];
    buffer[j + 1] = data[i + 1];
    buffer[j + 2] = data[i + 2];
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const oldR = buffer[idx];
      const oldG = buffer[idx + 1];
      const oldB = buffer[idx + 2];

      const closest = getClosestColor(oldR, oldG, oldB, palette);

      // Quantize
      buffer[idx] = closest.r;
      buffer[idx + 1] = closest.g;
      buffer[idx + 2] = closest.b;

      // Calculate Error
      const errR = oldR - closest.r;
      const errG = oldG - closest.g;
      const errB = oldB - closest.b;

      // Distribute Error
      for (const item of kernel.items) {
        const nx = x + item.x;
        const ny = y + item.y;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = (ny * width + nx) * 3;
          const factor = item.w / kernel.divisor;

          buffer[nIdx] += errR * factor;
          buffer[nIdx + 1] += errG * factor;
          buffer[nIdx + 2] += errB * factor;
        }
      }
    }
  }

  // Copy back to output
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    data[i] = clamp(buffer[j]);
    data[i + 1] = clamp(buffer[j + 1]);
    data[i + 2] = clamp(buffer[j + 2]);
    data[i + 3] = 255;
  }

  return output;
};
