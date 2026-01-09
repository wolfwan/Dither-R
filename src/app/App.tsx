import React, { useState, useRef, useCallback, useEffect } from "react";
import { SettingsPanel } from "./components/SettingsPanel";
import { ImageUploader } from "./components/ImageUploader";
import { DitherCanvas } from "./components/DitherCanvas";
import { DitherSettings } from "./types";
import { PRESET_PALETTES } from "./lib/palettes";
import { Button } from "./components/ui/button";
import { Download, ZoomIn, ZoomOut, Upload, Monitor, Maximize2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./components/ui/tooltip";

const DEFAULT_SETTINGS: DitherSettings = {
  algorithm: "Floyd-Steinberg",
  resolutionScale: 0.5,
  colorSpace: "1-bit",
  palette: PRESET_PALETTES[0].colors,
  brightness: 0,
  contrast: 0,
  sharpness: 0,
  blur: 0,
  noise: 0,
  levelsShadows: 0,
  levelsMidtones: 1.0,
  levelsHighlights: 255,
};

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [settings, setSettings] = useState<DitherSettings>(DEFAULT_SETTINGS);
  const [originalDimensions, setOriginalDimensions] = useState({ w: 0, h: 0 });
  const [processedDimensions, setProcessedDimensions] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [isFit, setIsFit] = useState(true);
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg" | "webp">("png");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (file: File) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setIsFit(true);
    setSettings((prev) => ({ ...prev, resolutionScale: 0.5 }));
    
    // Reset dimensions on new image (will be updated by onLoad)
    const img = new Image();
    img.src = url;
    img.onload = () => {
       setOriginalDimensions({ w: img.width, h: img.height });
    };
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageUpload(e.target.files[0]);
    }
    // Reset value so same file can be selected again if needed
    if (e.target) {
        e.target.value = '';
    }
  };

  const updateSettings = (partial: Partial<DitherSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleDimensionsChange = useCallback((w: number, h: number) => {
    setProcessedDimensions(prev => {
      if (prev.w === w && prev.h === h) return prev;
      return { w, h };
    });
  }, []);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `dithered-image.${exportFormat}`;
    link.href = canvasRef.current.toDataURL(`image/${exportFormat}`);
    link.click();
  };

  const adjustZoom = (delta: number) => {
      setIsFit(false);
      setZoom(z => Math.max(0.1, Math.min(10, z + delta)));
  };

  const toggleFit = () => {
      setIsFit(prev => !prev);
      if (!isFit) {
          // Reset zoom when going back to fit? Or keep it? 
          // Usually fit overrides zoom.
      } else {
          setZoom(1); // Reset to 100% when leaving fit mode? Or maybe calculated fit?
      }
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2 font-semibold">
          <Monitor className="h-5 w-5" />
          <span>Dither-R</span>
        </div>
        <div className="flex items-center gap-4">
           {imageFile && (
              <>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/png, image/jpeg, image/webp" 
                    onChange={handleFileInputChange}
                />
                <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                   <Upload className="mr-2 h-4 w-4" /> Upload another picture
                </Button>
              </>
           )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {!imageFile ? (
          <div className="flex h-full w-full items-center justify-center p-8">
            <div className="w-full max-w-xl">
               <h1 className="mb-6 text-center text-3xl font-bold">Image Dithering Studio</h1>
               <ImageUploader onImageUpload={handleImageUpload} />
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col lg:flex-row">
            {/* Sidebar Controls */}
            <aside className="w-full border-b bg-muted/10 lg:w-80 lg:border-r lg:border-b-0">
               <SettingsPanel 
                  settings={settings} 
                  updateSettings={updateSettings}
                  originalWidth={originalDimensions.w}
                  originalHeight={originalDimensions.h}
                  processedWidth={processedDimensions.w}
                  processedHeight={processedDimensions.h}
                  imageUrl={imageUrl}
               />
            </aside>

            {/* Preview Area */}
            <div className="flex flex-1 flex-col bg-muted/30">
              {/* Toolbar */}
              <div className="flex items-center justify-between border-b bg-background px-4 py-2">
                 <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant={isFit ? "secondary" : "outline"} size="icon" onClick={toggleFit}>
                              <Maximize2 className="h-4 w-4" />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent>Fit to Screen</TooltipContent>
                    </Tooltip>
                    
                    <div className="mx-2 h-4 w-px bg-border" />

                    <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={() => adjustZoom(-0.1)}>
                            <ZoomOut className="h-4 w-4" />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent>Zoom Out</TooltipContent>
                    </Tooltip>
                    
                    <span className="w-16 text-center text-sm font-mono">
                        {isFit ? "Fit" : `${Math.round(zoom * 100)}%`}
                    </span>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={() => adjustZoom(0.1)}>
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent>Zoom In</TooltipContent>
                    </Tooltip>
                 </div>

                 <div className="flex items-center gap-2">
                    <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
                       <SelectTrigger className="w-24">
                          <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                          <SelectItem value="png">PNG</SelectItem>
                          <SelectItem value="jpeg">JPG</SelectItem>
                          <SelectItem value="webp">WebP</SelectItem>
                       </SelectContent>
                    </Select>
                    <Button onClick={handleDownload} className="gap-2">
                       <Download className="h-4 w-4" /> Export
                    </Button>
                 </div>
              </div>


              
              {/* Re-implementing structure for correct scrolling/fitting */}
               <div className={`flex flex-1 items-center justify-center p-4 ${isFit ? 'overflow-hidden' : 'overflow-auto'}`}>
                   <div className={`relative rounded-md border shadow-sm bg-background transition-all ${
                       isFit ? 'h-full w-full' : ''
                   }`}>
                      <DitherCanvas
                         ref={canvasRef}
                         src={imageUrl}
                         settings={settings}
                         onDimensionsChange={handleDimensionsChange}
                         zoom={zoom}
                         className={`transition-all ${isFit ? 'h-full w-full object-contain' : ''}`}
                         style={isFit ? { width: '100%', height: '100%', objectFit: 'contain' } : undefined}
                      />
                   </div>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
