import React from 'react';
import { 
  Building2, 
  UserCheck, 
  ShieldCheck, 
  Clock, 
  HelpCircle,
  Volume2,
  BellRing
} from 'lucide-react';
import { testSirenChirp, playTactileClick } from '../../utils/audio';

interface OperationalShiftBarProps {
  onOpenShortcuts: () => void;
  isClockUtc: boolean;
  onToggleClockUtc: () => void;
}

export const OperationalShiftBar: React.FC<OperationalShiftBarProps> = ({
  onOpenShortcuts,
  isClockUtc,
  onToggleClockUtc,
}) => {
  const handleTestSiren = () => {
    playTactileClick();
    testSirenChirp();
  };

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono px-4 lg:px-6 py-2 text-slate-400 flex flex-wrap items-center justify-between gap-3 shadow-sm">
      
      {/* Left: Plant & Cell Operational Context */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold text-white">Apex Detroit Robotics</span>
          <span className="text-slate-600">/</span>
          <span className="text-cyan-400 font-medium">Cell #02 (Robotic Enclosure)</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-purple-400" />
          <span>Shift: <strong className="text-slate-200">Alpha Day</strong></span>
          <span className="text-slate-600">•</span>
          <span>Lead: <span className="text-slate-200">Nithin (Supervisor)</span></span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>47 Days Zero LTI</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">OSHA 1910.212 / ISO 45001</span>
        </div>
      </div>

      {/* Right: Tactile Quick Tools & Keyboard Shortcuts */}
      <div className="flex items-center gap-2">
        {/* Siren Sound Test Button */}
        <button
          onClick={handleTestSiren}
          title="Audible Siren Pre-Shift Test Chirp (350ms 2.4kHz pulse)"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95"
        >
          <BellRing className="w-3 h-3 text-amber-400" />
          <span>Test Siren</span>
        </button>

        {/* Clock UTC/Local Toggle */}
        <button
          onClick={() => {
            playTactileClick();
            onToggleClockUtc();
          }}
          title="Toggle Local vs UTC timestamp format"
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95"
        >
          <Clock className="w-3 h-3 text-cyan-400" />
          <span>{isClockUtc ? 'UTC' : 'LOCAL'}</span>
        </button>

        {/* Keyboard Shortcuts Trigger Button */}
        <button
          onClick={() => {
            playTactileClick();
            onOpenShortcuts();
          }}
          title="View Operator Keyboard Shortcuts [?]"
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800/80 transition-all active:scale-95"
        >
          <HelpCircle className="w-3 h-3 text-blue-400" />
          <span className="hidden sm:inline">Shortcuts</span>
          <kbd className="px-1 py-0.2 bg-blue-900 border border-blue-700 rounded text-[9px] font-bold">?</kbd>
        </button>
      </div>

    </div>
  );
};

export default OperationalShiftBar;
