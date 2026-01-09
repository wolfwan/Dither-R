import React, { useRef, useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface LevelsSliderProps {
  min: number; // 0-255
  max: number; // 0-255
  mid: number; // Gamma (e.g. 1.0)
  onChange: (min: number, max: number, mid: number) => void;
  imageUrl?: string;
  className?: string;
}

export const LevelsSlider: React.FC<LevelsSliderProps> = ({
  min,
  max,
  mid,
  onChange,
  imageUrl,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [histogram, setHistogram] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState<"min" | "max" | "mid" | null>(null);

  // Calculate histogram when imageUrl changes
  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Downscale for performance if needed, but 256 bins is fixed.
      // We need full pixel data for accuracy, but a smaller image is fine for the shape.
      const w = Math.min(img.width, 1000); 
      const h = Math.min(img.height, (img.height / img.width) * 1000);
      
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      const hist = new Array(256).fill(0);
      
      for (let i = 0; i < data.length; i += 4) {
        // Luminance
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const val = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        hist[val]++;
      }
      
      // Normalize histogram
      const maxCount = Math.max(...hist);
      setHistogram(hist.map(c => c / maxCount));
    };
  }, [imageUrl]);

  // Convert gamma to relative position (0-1) between min and max
  // Standard Levels: Gamma = 1 means mid is exactly halfway between min and max.
  // Formula: Gamma = log(0.5) / log(normalized_mid_pos)
  // Inverse: normalized_mid_pos = 0.5 ^ (1/Gamma) (Wait, I derived 0.5^Gamma before. Let's re-verify)
  
  // If Gamma=1, pos=0.5. 
  // If Gamma=2 (Brighter), we want the slider to be at 0.25 (darker inputs boosted).
  // 0.5^(1/2) = 0.707 (Wrong direction)
  // 0.5^2 = 0.25 (Correct)
  // So normalized_mid_pos = 0.5 ^ mid
  
  const getMidPos = () => {
    const range = max - min;
    const normalizedPos = Math.pow(0.5, mid);
    return min + range * normalizedPos;
  };
  
  const midPos = getMidPos();

  // Handlers
  const handleMouseDown = (type: "min" | "max" | "mid") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(type);
    
    const handleMouseMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
      const val = (x / rect.width) * 255;
      
      if (type === "min") {
        // Min cannot go past max (minus buffer)
        const newMin = Math.min(Math.round(val), max - 2);
        // Keep gamma constant? Or keep mid visual pos constant? 
        // Photoshop keeps gamma constant, so mid slider moves.
        onChange(newMin, max, mid);
      } else if (type === "max") {
        const newMax = Math.max(Math.round(val), min + 2);
        onChange(min, newMax, mid);
      } else if (type === "mid") {
        // Calculate new gamma
        // val is absolute 0-255 position
        // Clamp between min and max
        const safeVal = Math.max(min + 1, Math.min(max - 1, val));
        
        // normalized relative to range
        const range = max - min;
        if (range <= 0) return;
        
        const norm = (safeVal - min) / range;
        // avoid log(0)
        const safeNorm = Math.max(0.01, Math.min(0.99, norm));
        
        // Gamma = log(0.5) / log(safeNorm)
        const newGamma = Math.log(0.5) / Math.log(safeNorm);
        
        onChange(min, max, parseFloat(newGamma.toFixed(2)));
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className={cn("w-full select-none space-y-4", className)}>
      <div className="relative h-24 w-full pt-4">
        {/* Histogram */}
        <div className="absolute inset-x-0 bottom-6 top-0 flex items-end px-[7px] opacity-50">
           {histogram.length > 0 ? (
               <div className="flex h-full w-full items-end gap-[1px]">
                   {histogram.map((h, i) => (
                       <div key={i} className="flex-1 bg-foreground" style={{ height: `${h * 100}%` }} />
                   ))}
               </div>
           ) : (
               <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground bg-muted/20">
                   No histogram data
               </div>
           )}
        </div>
        
        {/* Track */}
        <div 
            ref={containerRef}
            className="absolute bottom-6 left-[7px] right-[7px] h-2 cursor-pointer border bg-gradient-to-r from-black via-gray-500 to-white shadow-inner"
        />
        
        {/* Controls Container (Absolute over track) */}
        <div className="absolute bottom-6 left-[7px] right-[7px] h-0">
            {/* Black Point */}
            <div 
                className="absolute top-0 -ml-[7px] flex cursor-col-resize flex-col items-center touch-none"
                style={{ left: `${(min / 255) * 100}%` }}
                onMouseDown={handleMouseDown("min")}
            >
                 {/* Triangle pointing up */}
                 <div className="h-0 w-0 border-b-[8px] border-l-[7px] border-r-[7px] border-b-black border-l-transparent border-r-transparent hover:scale-110" />
                 <div className="mt-1 text-[10px] font-mono">{min}</div>
            </div>

            {/* White Point */}
            <div 
                className="absolute top-0 -ml-[7px] flex cursor-col-resize flex-col items-center touch-none"
                style={{ left: `${(max / 255) * 100}%` }}
                onMouseDown={handleMouseDown("max")}
            >
                 {/* Triangle pointing up, filled white with border */}
                 <div className="h-0 w-0 border-b-[8px] border-l-[7px] border-r-[7px] border-b-white border-l-transparent border-r-transparent drop-shadow-[0_0_1px_rgba(0,0,0,0.8)] hover:scale-110" />
                 {/* Outline helper since it's white */}
                 <div className="absolute top-0 h-0 w-0 border-b-[8px] border-l-[7px] border-r-[7px] border-b-black border-l-transparent border-r-transparent -z-10 translate-y-[1px]" />
                 <div className="mt-1 text-[10px] font-mono">{max}</div>
            </div>

            {/* Mid Point (Gamma) */}
            <div 
                className="absolute top-0 -ml-[7px] flex cursor-col-resize flex-col items-center touch-none"
                style={{ left: `${(midPos / 255) * 100}%` }}
                onMouseDown={handleMouseDown("mid")}
            >
                 {/* Triangle pointing up, gray */}
                 <div className="h-0 w-0 border-b-[8px] border-l-[7px] border-r-[7px] border-b-gray-500 border-l-transparent border-r-transparent hover:scale-110" />
                 <div className="mt-1 text-[10px] font-mono">{mid}</div>
            </div>
        </div>
      </div>
    </div>
  );
};
