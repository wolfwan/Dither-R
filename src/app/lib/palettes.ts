import { Color, Palette } from "../types";

const hexToColor = (hex: string): Color => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

export const PRESET_PALETTES: Palette[] = [
  {
    name: "1-bit Black & White",
    colors: [hexToColor("#000000"), hexToColor("#FFFFFF")],
  },
  {
    name: "Classic Game Boy",
    colors: [
      hexToColor("#0f380f"),
      hexToColor("#306230"),
      hexToColor("#8bac0f"),
      hexToColor("#9bbc0f"),
    ],
  },
  {
    name: "CGA (Palette 1 High)",
    colors: [
      hexToColor("#000000"),
      hexToColor("#55ffff"),
      hexToColor("#ff55ff"),
      hexToColor("#ffffff"),
    ],
  },
  {
    name: "Newspaper (Grayscale)",
    colors: [
      hexToColor("#000000"),
      hexToColor("#555555"),
      hexToColor("#aaaaaa"),
      hexToColor("#ffffff"),
    ],
  },
  {
    name: "Sepia",
    colors: [
      hexToColor("#2e1c08"),
      hexToColor("#5e3c12"),
      hexToColor("#9c6b29"),
      hexToColor("#d6a85c"),
    ],
  },
];

export const DEFAULT_PALETTE = PRESET_PALETTES[0].colors;
