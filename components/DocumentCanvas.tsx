
import React, { useState, useRef, useEffect } from 'react';
import { Region, Point } from '../types';

interface DocumentCanvasProps {
  imageSrc: string;
  regions: Region[];
  onRegionsChange: (regions: Region[]) => void;
  activeRegionId: string | null;
  onSelectRegion: (id: string) => void;
}

const DocumentCanvas: React.FC<DocumentCanvasProps> = ({ 
  imageSrc, 
  regions, 
  onRegionsChange,
  activeRegionId,
  onSelectRegion
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<Point | null>(null);
  const [currentPos, setCurrentPos] = useState<Point | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setStartPos({ x, y });
    setCurrentPos({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCurrentPos({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !startPos || !currentPos) {
      setIsDrawing(false);
      return;
    }

    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    if (width > 1 && height > 1) {
      const newRegion: Region = {
        id: crypto.randomUUID(),
        name: `Field ${regions.length + 1}`,
        x: Math.min(startPos.x, currentPos.x),
        y: Math.min(startPos.y, currentPos.y),
        width,
        height,
      };
      onRegionsChange([...regions, newRegion]);
      onSelectRegion(newRegion.id);
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentPos(null);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-[1/1.4] bg-white shadow-2xl rounded-lg overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <img 
        src={imageSrc} 
        alt="Document Preview" 
        className="w-full h-full object-contain pointer-events-none"
      />
      
      {/* Existing Regions */}
      {regions.map((region) => (
        <div
          key={region.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelectRegion(region.id);
          }}
          className={`absolute border-2 transition-all cursor-pointer ${
            activeRegionId === region.id 
              ? 'border-blue-500 bg-blue-500/20 ring-2 ring-blue-300' 
              : 'border-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
          }`}
          style={{
            left: `${region.x}%`,
            top: `${region.y}%`,
            width: `${region.width}%`,
            height: `${region.height}%`,
          }}
        >
          <div className="absolute -top-6 left-0 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap shadow-md">
            {region.name}
          </div>
        </div>
      ))}

      {/* Drawing Preview */}
      {isDrawing && startPos && currentPos && (
        <div
          className="absolute border-2 border-blue-400 bg-blue-400/20"
          style={{
            left: `${Math.min(startPos.x, currentPos.x)}%`,
            top: `${Math.min(startPos.y, currentPos.y)}%`,
            width: `${Math.abs(currentPos.x - startPos.x)}%`,
            height: `${Math.abs(currentPos.y - startPos.y)}%`,
          }}
        />
      )}
    </div>
  );
};

export default DocumentCanvas;
