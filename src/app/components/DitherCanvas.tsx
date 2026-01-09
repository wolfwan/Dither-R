import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { DitherSettings } from "../types";
import { processImage } from "../lib/ditherAlgorithms";

interface DitherCanvasProps {
  src: string;
  settings: DitherSettings;
  onDimensionsChange?: (width: number, height: number) => void;
  className?: string;
  zoom?: number;
  style?: React.CSSProperties;
}

export const DitherCanvas = forwardRef<HTMLCanvasElement, DitherCanvasProps>(
  ({ src, settings, onDimensionsChange, className, zoom = 1, style }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Expose the canvas ref
    useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);

    // Load Image
    useEffect(() => {
      if (!src) return;
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = src;
      img.onload = () => setImage(img);
    }, [src]);

    // Calculate Dimensions & Notify Parent
    // This effect handles sizing updates
    useEffect(() => {
      if (!image) return;

      const scale = settings.resolutionScale; 
      const width = Math.floor(image.width * scale);
      const height = Math.floor(image.height * scale);

      setDimensions(prev => {
         // Optimization: Only update state if values actually changed
         // This prevents unnecessary re-renders when only palette changes
         if (prev.width === width && prev.height === height) return prev;
         return { width, height };
      });
      
    }, [image, settings.resolutionScale]);

    // Notify parent of dimension changes
    // Separated to avoid re-calculating dimensions just because callback changed
    useEffect(() => {
        if (dimensions.width > 0 && dimensions.height > 0 && onDimensionsChange) {
            onDimensionsChange(dimensions.width, dimensions.height);
        }
    }, [dimensions, onDimensionsChange]);

    // Process Image
    // This effect handles drawing logic
    useEffect(() => {
      // Ensure we have everything we need and dimensions are set
      if (!image || !canvasRef.current || dimensions.width === 0 || dimensions.height === 0) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Note: We rely on the React rendered 'width' and 'height' attributes 
      // matching our 'dimensions' state.
      // If we manually set canvas.width here, it clears the canvas.
      // Since 'dimensions' update triggers a render, the DOM attributes should be correct
      // by the time this effect runs.

      // Draw original resized
      ctx.drawImage(image, 0, 0, dimensions.width, dimensions.height);

      // Get Data
      const imageData = ctx.getImageData(0, 0, dimensions.width, dimensions.height);
      
      // Process
      setIsProcessing(true);
      
      // Use RequestAnimationFrame to avoid blocking the main thread
      const animationFrame = requestAnimationFrame(() => {
         const processed = processImage(imageData, settings);
         if (canvasRef.current) { // Check if still mounted
             const currentCtx = canvasRef.current.getContext("2d");
             if (currentCtx) {
                 currentCtx.putImageData(processed, 0, 0);
             }
         }
         setIsProcessing(false);
      });

      return () => cancelAnimationFrame(animationFrame);

    }, [image, settings, dimensions]);

    return (
        <canvas
          ref={canvasRef}
          className={className}
          width={dimensions.width}
          height={dimensions.height}
          style={{
            ...style,
            width: style?.height === '100%' ? 'auto' : (style?.width ?? (dimensions.width ? dimensions.width * zoom : undefined)),
            height: style?.height ?? (dimensions.height ? dimensions.height * zoom : undefined),
            imageRendering: "pixelated",
          }}
        />
    );
  }
);

DitherCanvas.displayName = "DitherCanvas";
