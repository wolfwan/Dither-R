import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Trash2 } from "lucide-react";
import { DitherSettings, AlgorithmName, Color, Palette } from "../types";
import { PRESET_PALETTES } from "../lib/palettes";

import { LevelsSlider } from "./LevelsSlider";

interface SettingsPanelProps {
  settings: DitherSettings;
  updateSettings: (partial: Partial<DitherSettings>) => void;
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
  imageUrl?: string;
}

const ALGORITHMS: AlgorithmName[] = [
  "Floyd-Steinberg",
  "Atkinson",
  "Two-Row Sierra",
  "Sierra Lite",
  "Ordered 2x2",
  "Ordered 4x4",
  "Ordered 8x8",
  "Random",
  "Blue Noise",
  "Threshold",
  "Checker",
  "Circuitry",
  "Fizz",
];

const colorToHex = (c: Color) =>
  "#" +
  [c.r, c.g, c.b]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");

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

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  updateSettings,
  originalWidth,
  originalHeight,
  processedWidth,
  processedHeight,
  imageUrl,
}) => {
  const handlePalettePreset = (palette: Palette) => {
    updateSettings({
      palette: palette.colors,
      colorSpace: "Custom", // Switch to custom so they can edit it
    });
  };

  const handleColorSpaceChange = (value: string) => {
    let newPalette = settings.palette;
    if (value === "1-bit") {
      newPalette = PRESET_PALETTES.find((p) => p.name === "1-bit Black & White")?.colors || [];
    } else if (value === "Grayscale") {
      // Generate grayscale palette based on current color count (default 4)
      newPalette = generateGrayscalePalette(4);
    }
    
    updateSettings({
      colorSpace: value as any,
      palette: newPalette,
    });
  };

  const generateGrayscalePalette = (count: number) => {
    const colors: Color[] = [];
    for (let i = 0; i < count; i++) {
      const val = Math.floor((i / (count - 1)) * 255);
      colors.push({ r: val, g: val, b: val });
    }
    return colors;
  };

  const handleColorCountChange = (count: number) => {
    if (settings.colorSpace === "Grayscale") {
      updateSettings({ palette: generateGrayscalePalette(count) });
    }
  };

  const addColor = (color: Color) => {
    updateSettings({
      palette: [...settings.palette, color],
      colorSpace: "Custom",
    });
  };

  const updateColor = (index: number, color: Color) => {
    const newPalette = [...settings.palette];
    newPalette[index] = color;
    updateSettings({ palette: newPalette, colorSpace: "Custom" });
  };

  const removeColor = (index: number) => {
    const newPalette = [...settings.palette];
    newPalette.splice(index, 1);
    updateSettings({ palette: newPalette, colorSpace: "Custom" });
  };

  return (
    <div className="h-full min-w-80 space-y-4 overflow-y-auto p-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Configuration</h2>
        <p className="text-sm text-muted-foreground">Customize your output</p>
      </div>

      <div className="w-full space-y-6">
        {/* Presets */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Presets</h3>
          <div className="flex flex-wrap gap-2">
            {PRESET_PALETTES.map((preset) => (
              <Button
                key={preset.name}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handlePalettePreset(preset)}
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Algorithm Selection */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Dithering Algorithm</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Algorithm</Label>
              <Select
                value={settings.algorithm}
                onValueChange={(val) =>
                  updateSettings({ algorithm: val as AlgorithmName })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select algorithm" />
                </SelectTrigger>
                <SelectContent>
                  {ALGORITHMS.map((algo) => (
                    <SelectItem key={algo} value={algo}>
                      {algo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Sampling & Resolution */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Sampling & Resolution</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Resolution Scale</Label>
                <span className="text-xs text-muted-foreground">
                  {Math.round(settings.resolutionScale * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.resolutionScale * 100]}
                min={10}
                max={200}
                step={5}
                onValueChange={([val]) =>
                  updateSettings({ resolutionScale: val / 100 })
                }
              />
            </div>
            <div className="rounded-md bg-secondary p-3 text-xs">
              <div className="flex justify-between">
                <span>Original:</span>
                <span className="font-mono">{originalWidth} x {originalHeight}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Output:</span>
                <span className="font-mono">{processedWidth} x {processedHeight}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Color Space & Palette */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Color Space & Palette</h3>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Color Space</Label>
              <Select
                value={settings.colorSpace}
                onValueChange={handleColorSpaceChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RGB">RGB (Full Color)</SelectItem>
                  <SelectItem value="Grayscale">Grayscale</SelectItem>
                  <SelectItem value="1-bit">1-bit Black & White</SelectItem>
                  <SelectItem value="Custom">Custom Palette</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {settings.colorSpace === "Grayscale" && (
              <div className="space-y-2">
                 <div className="flex justify-between">
                    <Label>Number of Colors</Label>
                    <span className="text-xs">{settings.palette.length}</span>
                 </div>
                 <Slider 
                    value={[settings.palette.length]}
                    min={2}
                    max={32}
                    step={1}
                    onValueChange={([val]) => handleColorCountChange(val)}
                 />
              </div>
            )}

            <div className="space-y-4 rounded-md border p-3">
                <Label className="text-sm font-semibold">Input Levels</Label>
                
                <LevelsSlider 
                    min={settings.levelsShadows ?? 0}
                    max={settings.levelsHighlights ?? 255}
                    mid={settings.levelsMidtones ?? 1.0}
                    onChange={(min, max, mid) => updateSettings({
                        levelsShadows: min,
                        levelsHighlights: max,
                        levelsMidtones: mid
                    })}
                    imageUrl={imageUrl}
                />
            </div>

            <div className="space-y-2">
              <Label>Current Palette ({settings.palette.length})</Label>
              <div className="grid grid-cols-6 gap-2">
                {settings.palette.map((color, idx) => (
                  <Popover key={idx}>
                    <PopoverTrigger asChild>
                      <div className="group relative aspect-square rounded-md border shadow-sm cursor-pointer hover:ring-2 hover:ring-ring hover:ring-offset-1" style={{ backgroundColor: colorToHex(color) }}>
                        <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              removeColor(idx);
                            }}
                            className="absolute -top-1 -right-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground opacity-90 hover:opacity-100 group-hover:flex z-10"
                        >
                            <Trash2 className="h-2 w-2" />
                        </button>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3">
                       <RGBColorPicker 
                          color={color} 
                          onChange={(c) => updateColor(idx, c)} 
                       />
                    </PopoverContent>
                  </Popover>
                ))}
              </div>
              
              <AddColorButton onAdd={addColor} />
            </div>
          </div>
        </div>

        {/* Adjustments */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Image Adjustments</h3>
          <div className="space-y-5">
            {[
              { label: "Brightness", key: "brightness" as const, min: -100, max: 100 },
              { label: "Contrast", key: "contrast" as const, min: -100, max: 100 },
              { label: "Sharpness", key: "sharpness" as const, min: 0, max: 100 },
              { label: "Blur", key: "blur" as const, min: 0, max: 20 },
              { label: "Noise", key: "noise" as const, min: 0, max: 100 },
            ].map((adj) => (
              <div key={adj.key} className="space-y-2">
                <div className="flex justify-between">
                  <Label>{adj.label}</Label>
                  <span className="text-xs text-muted-foreground">{settings[adj.key]}</span>
                </div>
                <Slider
                  value={[settings[adj.key]]}
                  min={adj.min}
                  max={adj.max}
                  onValueChange={([val]) => updateSettings({ [adj.key]: val })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const RGBColorPicker = ({ color, onChange }: { color: Color, onChange: (c: Color) => void }) => {
    const handleHexChange = (hex: string) => {
        onChange(hexToColor(hex));
    };

    const handleRGBChange = (key: keyof Color, value: string) => {
        const val = parseInt(value) || 0;
        const clamped = Math.min(255, Math.max(0, val));
        onChange({ ...color, [key]: clamped });
    };

    return (
        <div className="space-y-3">
           <div className="flex items-center justify-between">
               <Label className="text-xs">Edit Color</Label>
               <input 
                   type="color" 
                   value={colorToHex(color)}
                   onChange={(e) => handleHexChange(e.target.value)}
                   className="h-6 w-6 cursor-pointer border-0 p-0"
               />
           </div>
           
           <div className="grid grid-cols-3 gap-2">
               <div className="space-y-1">
                   <Label className="text-[10px]">R</Label>
                   <Input 
                       type="number" 
                       min={0} max={255} 
                       value={color.r} 
                       onChange={(e) => handleRGBChange('r', e.target.value)}
                       className="h-7 px-2 text-xs"
                   />
               </div>
               <div className="space-y-1">
                   <Label className="text-[10px]">G</Label>
                   <Input 
                       type="number" 
                       min={0} max={255} 
                       value={color.g} 
                       onChange={(e) => handleRGBChange('g', e.target.value)}
                       className="h-7 px-2 text-xs"
                   />
               </div>
               <div className="space-y-1">
                   <Label className="text-[10px]">B</Label>
                   <Input 
                       type="number" 
                       min={0} max={255} 
                       value={color.b} 
                       onChange={(e) => handleRGBChange('b', e.target.value)}
                       className="h-7 px-2 text-xs"
                   />
               </div>
           </div>
        </div>
    );
};

const AddColorButton = ({ onAdd }: { onAdd: (c: Color) => void }) => {
   const [tempColor, setTempColor] = useState<Color>({ r: 0, g: 0, b: 0 });
   const [open, setOpen] = useState(false);

   const handleAdd = () => {
       onAdd(tempColor);
       setOpen(false);
   };

   return (
       <Popover open={open} onOpenChange={setOpen}>
           <PopoverTrigger asChild>
               <Button size="sm" variant="secondary" className="w-full">
                   Add a color
               </Button>
           </PopoverTrigger>
           <PopoverContent className="w-64">
               <div className="space-y-4">
                   <h4 className="font-medium leading-none">Add Color</h4>
                   <RGBColorPicker 
                      color={tempColor} 
                      onChange={setTempColor} 
                   />
                   <Button onClick={handleAdd} className="w-full">Add Color</Button>
               </div>
           </PopoverContent>
       </Popover>
   )
};