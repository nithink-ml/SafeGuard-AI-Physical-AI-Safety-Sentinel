import React, { useState } from 'react';
import { Compass, Video, Sliders } from 'lucide-react';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { LivePerceptionSentinel } from './LivePerceptionSentinel';
import { ZoneDefinition } from '../../types/schema';
import { playTactileClick } from '../../utils/audio';

interface MonitoringViewProps {
  zones: ZoneDefinition[];
  workerPos: { x: number; y: number };
  onMoveWorker: (x: number, y: number) => void;
  onTriggerIncursion: (scenario: 'breach' | 'clear') => void;
  isAlarmActive: boolean;
  currentZoneId?: string | null;
}

export const MonitoringView: React.FC<MonitoringViewProps> = ({
  zones,
  workerPos,
  onMoveWorker,
  onTriggerIncursion,
  isAlarmActive,
  currentZoneId,
}) => {
  const [activeModal, setActiveModal] = useState<'twin' | 'vision'>('twin');

  return (
    <div className="space-y-4">
      
      {/* Industrial Workstation Modality Selector Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-1.5 rounded-xl shadow-sm font-mono">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              playTactileClick();
              setActiveModal('twin');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 ${
              activeModal === 'twin'
                ? 'bg-blue-600 text-white shadow-sm font-bold border border-blue-500'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Spatial CAD Blueprint Twin (2D Vector Plan)</span>
          </button>

          <button
            onClick={() => {
              playTactileClick();
              setActiveModal('vision');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 ${
              activeModal === 'vision'
                ? 'bg-blue-600 text-white shadow-sm font-bold border border-blue-500'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>CCTV NVR Sentinel Station (CAM-01 YOLOv8)</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 pr-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-300">DUAL-SENSOR SYNCHRONIZED</span>
        </div>
      </div>

      {/* Render Selected View */}
      {activeModal === 'twin' ? (
        <FloorPlanCanvas
          zones={zones}
          workerPos={workerPos}
          onMoveWorker={onMoveWorker}
          onTriggerIncursion={onTriggerIncursion}
          isAlarmActive={isAlarmActive}
          currentZoneId={currentZoneId}
        />
      ) : (
        <LivePerceptionSentinel />
      )}

    </div>
  );
};

export default MonitoringView;
