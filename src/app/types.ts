export type Color = { r: number; g: number; b: number };

export type Palette = {
  name: string;
  colors: Color[];
};

export type AlgorithmName =
  | "Floyd-Steinberg"
  | "Atkinson"
  | "Jarvis-Judice-Ninke"
  | "Stucki"
  | "Burkes"
  | "Sierra"
  | "Two-Row Sierra"
  | "Sierra Lite"
  | "Ordered 2x2"
  | "Ordered 4x4"
  | "Ordered 8x8"
  | "Random"
  | "Blue Noise" // Approximated or standard noise if texture missing
  | "Threshold"
  | "Modulation"
  | "Circuitry"
  | "Fizz";

export interface DitherSettings {
  algorithm: AlgorithmName;
  resolutionScale: number; // 0.1 to 1.0 (simulates DPI)
  colorSpace: "RGB" | "Grayscale" | "1-bit" | "Custom";
  palette: Color[];
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  sharpness: number; // 0 to 100
  blur: number; // 0 to 20
  noise: number; // 0 to 100
  // Levels
  levelsShadows: number; // 0-255
  levelsMidtones: number; // 0.1-10.0 (Gamma)
  levelsHighlights: number; // 0-255
}
