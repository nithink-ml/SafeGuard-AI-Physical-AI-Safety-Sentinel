import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Compass, 
  AlertTriangle, 
  CheckCircle2, 
  Move, 
  Sliders, 
  Maximize2,
  Crosshair,
  Grid,
  Layers,
  Ruler
} from 'lucide-react';
import { ZoneDefinition } from '../../types/schema';
import { playTactileClick } from '../../utils/audio';

interface FloorPlanCanvasProps {
  zones: ZoneDefinition[];
  workerPos: { x: number; y: number };
  onMoveWorker: (x: number, y: number) => void;
  onTriggerIncursion: (scenario: 'breach' | 'clear') => void;
  isAlarmActive: boolean;
  currentZoneId?: string | null;
}

export const FloorPlanCanvas: React.FC<FloorPlanCanvasProps> = ({
  zones = [],
  workerPos = { x: 200, y: 200 },
  onMoveWorker,
  onTriggerIncursion,
  isAlarmActive,
  currentZoneId,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localPos, setLocalPos] = useState(workerPos);

  useEffect(() => {
    setLocalPos(workerPos);
  }, [workerPos]);

  // Transform client mouse coordinate into SVG viewBox coordinates (800x600)
  const getSVGCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!svgRef.current) return { x: 200, y: 200 };
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const scaleY = 600 / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    let x = (clientX - rect.left) * scaleX;
    let y = (clientY - rect.top) * scaleY;

    // Constrain to canvas bounds
    x = Math.max(30, Math.min(770, Math.round(x)));
    y = Math.max(40, Math.min(570, Math.round(y)));

    return { x, y };
  }, []);

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const coords = getSVGCoordinates(e);
    setLocalPos(coords);
    onMoveWorker(coords.x, coords.y);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDragging) {
      const coords = getSVGCoordinates(e);
      setLocalPos(coords);
      onMoveWorker(coords.x, coords.y);
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleSliderX = (e: React.ChangeEvent<HTMLInputElement>) => {
    const x = Number(e.target.value);
    setLocalPos(prev => ({ ...prev, x }));
    onMoveWorker(x, localPos.y);
  };

  const handleSliderY = (e: React.ChangeEvent<HTMLInputElement>) => {
    const y = Number(e.target.value);
    setLocalPos(prev => ({ ...prev, y }));
    onMoveWorker(localPos.x, y);
  };

  // Format polygon vertices [[x,y],...] to SVG points string
  const formatPolygonPoints = (pts: [number, number][]) => {
    return pts.map(([x, y]) => `${x},${y}`).join(' ');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-6 shadow-xl flex flex-col gap-4">
      
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-400" />
            Interactive Factory Floor Digital Twin (2D Spatial Engine)
          </h2>
          <p className="text-xs text-slate-400">
            Click, drag, or use sliders to reposition the worker avatar. Real-time Jordan curve raycasting evaluates contact point.
          </p>
        </div>

        {/* Live Coordinate Badges */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center gap-1.5">
            <span className="text-slate-500">P_contact:</span>
            <span className="text-blue-400 font-bold">X:{Math.round(localPos.x)} Y:{Math.round(localPos.y)}</span>
          </div>

          <div className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 font-bold ${
            isAlarmActive 
              ? 'bg-red-950/80 border-red-700 text-red-300 animate-pulse' 
              : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
          }`}>
            {isAlarmActive ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span>BREACH: {currentZoneId || 'ACTIVE'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>CORRIDOR SAFE</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Interactive SVG Blueprint Canvas */}
      <div className="relative w-full aspect-[4/3] max-h-[580px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner select-none cursor-crosshair">
        
        <svg 
          ref={svgRef}
          viewBox="0 0 800 600" 
          className="w-full h-full"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          <defs>
            {/* Fine Grid Blueprint */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
            </pattern>
            <pattern id="majorGrid" width="160" height="160" patternUnits="userSpaceOnUse">
              <path d="M 160 0 L 0 0 0 160" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1.5" />
            </pattern>

            {/* Warning Diagonal Stripe Pattern */}
            <pattern id="dangerHatch" width="20" height="20" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(239, 68, 68, 0.25)" strokeWidth="8" />
            </pattern>
            <pattern id="cautionHatch" width="20" height="20" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(245, 158, 11, 0.2)" strokeWidth="6" />
            </pattern>
          </defs>

          {/* Grid Blueprint Background */}
          <rect width="800" height="600" fill="#070a13" />
          <rect width="800" height="600" fill="url(#grid)" />
          <rect width="800" height="600" fill="url(#majorGrid)" />

          {/* Pedestrian Walkway Safe Lane Guides */}
          <path d="M 0 180 L 800 180" stroke="rgba(52, 211, 153, 0.2)" strokeWidth="2" strokeDasharray="8 8" />
          <path d="M 0 240 L 800 240" stroke="rgba(52, 211, 153, 0.2)" strokeWidth="2" strokeDasharray="8 8" />
          <text x="30" y="215" fill="rgba(52, 211, 153, 0.5)" fontSize="12" fontFamily="monospace" fontWeight="bold">
            SAFE PEDESTRIAN WALKWAY CORRIDOR [CLEAR ENVELOPE]
          </text>

          {/* Render Hazard Exclusion Zones */}
          {zones.map((zone) => {
            const isTargetZone = isAlarmActive && (currentZoneId === zone.zone_id || !currentZoneId);
            const vertices = zone.vertices || zone.polygon || [];
            if (vertices.length < 3) return null;

            const ptsStr = formatPolygonPoints(vertices);
            const [firstX, firstY] = vertices[0];

            return (
              <g key={zone.zone_id}>
                {/* Filled Area with Hatch */}
                <polygon 
                  points={ptsStr} 
                  fill={isTargetZone ? "url(#dangerHatch)" : "url(#cautionHatch)"} 
                />
                {/* Zone Perimeter Outline */}
                <polygon 
                  points={ptsStr} 
                  fill={isTargetZone ? "rgba(239, 68, 68, 0.25)" : "rgba(245, 158, 11, 0.12)"} 
                  stroke={isTargetZone ? "#ef4444" : "#f59e0b"} 
                  strokeWidth={isTargetZone ? "3.5" : "2"} 
                  strokeDasharray={isTargetZone ? "none" : "6 4"}
                />

                {/* Zone Header Label */}
                <rect 
                  x={firstX - 10} 
                  y={firstY - 26} 
                  width="220" 
                  height="22" 
                  rx="4" 
                  fill={isTargetZone ? "#ef4444" : "#1e293b"} 
                  stroke={isTargetZone ? "#f87171" : "#475569"} 
                />
                <text 
                  x={firstX - 2} 
                  y={firstY - 11} 
                  fill="#ffffff" 
                  fontSize="10" 
                  fontFamily="monospace" 
                  fontWeight="bold"
                >
                  {isTargetZone ? '🚨 BREACH: ' : '⚠️ '} {zone.zone_name.slice(0, 24)}
                </text>
              </g>
            );
          })}

          {/* Worker Silhouette Avatar */}
          <g transform={`translate(${localPos.x}, ${localPos.y})`}>
            {/* Projected ground contact footprint ripple */}
            <circle 
              cx="0" 
              cy="0" 
              r={isAlarmActive ? "24" : "16"} 
              fill={isAlarmActive ? "rgba(239, 68, 68, 0.3)" : "rgba(59, 130, 246, 0.25)"} 
              className={isAlarmActive ? "animate-ping" : ""}
            />

            {/* Bounding Box Silhouette (Simulating YOLOv8 detection envelope) */}
            <rect 
              x="-24" 
              y="-95" 
              width="48" 
              height="95" 
              rx="4"
              fill={isAlarmActive ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.1)"} 
              stroke={isAlarmActive ? "#ef4444" : "#3b82f6"} 
              strokeWidth="2" 
            />

            {/* Head */}
            <circle 
              cx="0" 
              cy="-75" 
              r="12" 
              fill={isAlarmActive ? "#ef4444" : "#3b82f6"} 
            />

            {/* Torso */}
            <line 
              x1="0" 
              y1="-63" 
              x2="0" 
              y2="-25" 
              stroke={isAlarmActive ? "#ef4444" : "#3b82f6"} 
              strokeWidth="4" 
            />

            {/* Legs */}
            <line 
              x1="0" 
              y1="-25" 
              x2="-10" 
              y2="0" 
              stroke={isAlarmActive ? "#ef4444" : "#3b82f6"} 
              strokeWidth="3.5" 
            />
            <line 
              x1="0" 
              y1="-25" 
              x2="10" 
              y2="0" 
              stroke={isAlarmActive ? "#ef4444" : "#3b82f6"} 
              strokeWidth="3.5" 
            />

            {/* Ground Contact Dot Crosshair: P_contact = ((x1+x2)/2, y2) */}
            <circle 
              cx="0" 
              cy="0" 
              r="6" 
              fill={isAlarmActive ? "#ef4444" : "#10b981"} 
              stroke="#ffffff" 
              strokeWidth="2" 
            />

            {/* Coordinate Label Tag */}
            <rect 
              x="14" 
              y="-10" 
              width="105" 
              height="18" 
              rx="3" 
              fill="#090d16" 
              stroke="#334155" 
            />
            <text 
              x="18" 
              y="3" 
              fill="#94a3b8" 
              fontSize="9" 
              fontFamily="monospace"
            >
              P_contact ({Math.round(localPos.x)}, {Math.round(localPos.y)})
            </text>
          </g>
        </svg>

        {/* Top-Right HUD Badge */}
        <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span>DRAG AVATAR TO SIMULATE</span>
        </div>
      </div>

      {/* Manual Sliders & One-Click Trigger Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        
        {/* Sliders Box */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <span>Precision Coordinate Sliders</span>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Worker Foot X Coordinate:</span>
                <span className="font-bold text-blue-400">{Math.round(localPos.x)} px</span>
              </div>
              <input 
                type="range" 
                min="40" 
                max="760" 
                value={localPos.x} 
                onChange={handleSliderX} 
                className="w-full accent-blue-600 bg-slate-800 rounded-lg cursor-pointer h-2" 
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Worker Foot Y Coordinate:</span>
                <span className="font-bold text-blue-400">{Math.round(localPos.y)} px</span>
              </div>
              <input 
                type="range" 
                min="50" 
                max="560" 
                value={localPos.y} 
                onChange={handleSliderY} 
                className="w-full accent-blue-600 bg-slate-800 rounded-lg cursor-pointer h-2" 
              />
            </div>
          </div>
        </div>

        {/* Incursion Triggers Box */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            <div className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Closed-Loop Incursion Scenarios</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Demonstrates 3-frame persistence filter and automatic clearance dwell recovery.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                playTactileClick();
                onTriggerIncursion('breach');
              }}
              className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 font-mono"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>TRIGGER BREACH (500, 450)</span>
            </button>

            <button
              onClick={() => {
                playTactileClick();
                onTriggerIncursion('clear');
              }}
              className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 font-mono"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>CLEAR ZONE (200, 200)</span>
            </button>
          </div>
        </div>

      </div>

      {/* CAD Spatial Geometry Inspector Table */}
      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            Active Spatial Geometry Telemetry (Jordan Curve Ray-Casting)
          </span>
          <span className="text-slate-500">Coordinate Transform: Orthogonal Floor Plane</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 text-[11px]">
          <div>
            <span className="text-slate-500 text-[10px] block">TARGET IDENTIFIER</span>
            <span className="text-slate-200 font-bold">worker-01 (Operator)</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">FOOT PROJECTION (P_contact)</span>
            <span className="text-cyan-400 font-bold">({Math.round(localPos.x)}, {Math.round(localPos.y)}) px</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">CONTAINMENT STATUS</span>
            <span className={isAlarmActive ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isAlarmActive ? `INSIDE (${currentZoneId || 'zone-machine-danger-1'})` : 'CLEAR (Safe Corridor)'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">PERSISTENCE LATCH</span>
            <span className="text-purple-400 font-bold">3 Frames (Flicker Guard)</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default FloorPlanCanvas;
