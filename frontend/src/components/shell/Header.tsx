import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Wifi, 
  WifiOff,
  Menu,
  Clock
} from 'lucide-react';
import { FirmwareState } from '../../types/telemetry';
import { formatUptime } from '../../utils/formatters';
import { playTactileClick } from '../../utils/audio';

interface HeaderProps {
  firmwareState: FirmwareState;
  redLed: boolean;
  buzzerActive: boolean;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onResetFirmware: () => void;
  isConnected: boolean;
  uptimeSec: number;
  onToggleSidebar?: () => void;
  isClockUtc?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  firmwareState,
  redLed,
  buzzerActive,
  audioEnabled,
  onToggleAudio,
  onResetFirmware,
  isConnected,
  uptimeSec,
  onToggleSidebar,
  isClockUtc = false,
}) => {
  const isAlarm = firmwareState === 'STATE_ALARM';
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      if (isClockUtc) {
        setCurrentTime(now.toISOString().substring(11, 19) + ' UTC');
      } else {
        setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }) + ' LOC');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isClockUtc]);

  return (
    <header className="bg-slate-900/95 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md px-4 lg:px-6 py-3 shadow-xl transition-colors duration-300">
      <div className="flex items-center justify-between gap-4">
        
        {/* Left: Mobile Toggle & Brand */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              aria-label="Toggle Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border flex items-center justify-center transition-all duration-300 ${
              isAlarm 
                ? 'bg-red-500/20 border-red-500 text-red-400 animate-beacon' 
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              {isAlarm ? <ShieldAlert className="w-6 h-6 animate-pulse" /> : <ShieldCheck className="w-6 h-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  SafeGuard AI
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium">
                  Physical AI Sentinel
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold">PipeGen v0.5.1</span>
                <span>•</span>
                <span className="text-purple-400 font-semibold">FirmGen v0.4.1</span>
                <span className="hidden md:inline">•</span>
                <span className="hidden md:inline font-mono text-slate-400">ESP-IDF v5.5</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Live Actuator Hardware Badges */}
        <div className="hidden md:flex items-center gap-3 bg-slate-950/80 px-3.5 py-1.5 rounded-xl border border-slate-800/90 shadow-inner">
          {/* FSM State Badge */}
          <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">FSM:</span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1.5 transition-all ${
              isAlarm 
                ? 'bg-red-950/90 border-red-500 text-red-300 animate-pulse shadow-sm shadow-red-500/30' 
                : 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isAlarm ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} />
              {firmwareState || 'STATE_NORMAL'}
            </span>
          </div>

          {/* Actuator Statuses */}
          <div className="flex items-center gap-2.5 text-xs font-mono">
            {/* Red Beacon LED */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">GPIO 2:</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                redLed 
                  ? 'bg-red-600 text-white border-red-400 animate-pulse shadow-md shadow-red-500/50' 
                  : 'bg-slate-800/90 text-slate-400 border-slate-700'
              }`}>
                {redLed ? 'LED HIGH' : 'LED OFF'}
              </span>
            </div>

            {/* Piezo Buzzer */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <span className="text-slate-400 text-[11px]">GPIO 4:</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                buzzerActive 
                  ? 'bg-amber-500 text-black border-amber-400 animate-pulse shadow-md shadow-amber-500/40' 
                  : 'bg-slate-800/90 text-slate-400 border-slate-700'
              }`}>
                {buzzerActive ? '2.4kHz ACTIVE' : 'BUZZ IDLE'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Controls & Clocks */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Clock Display */}
          <div className="hidden xl:flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{currentTime}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Up: {formatUptime(uptimeSec)}</span>
          </div>

          {/* Audio Synthesizer Toggle */}
          <button
            onClick={() => {
              playTactileClick();
              onToggleAudio();
            }}
            title={audioEnabled ? 'Mute Browser Acoustic Buzzer' : 'Enable Browser Acoustic Buzzer'}
            className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              audioEnabled 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                : 'bg-slate-900 hover:bg-slate-800 text-slate-500 border-slate-800 line-through'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            <span className="hidden sm:inline text-xs">{audioEnabled ? 'Audio ON' : 'Muted'}</span>
          </button>

          {/* Manual Emergency Reset Button */}
          <button
            onClick={() => {
              playTactileClick();
              onResetFirmware();
            }}
            title="Manual Operator Reset Command (REQ-007)"
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset FSM</span>
          </button>

          {/* WebSocket Connection Status Pill */}
          <div 
            title={isConnected ? 'WebSocket stream active (ws://localhost:8000/ws)' : 'Connecting to backend...'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium ${
              isConnected 
                ? 'bg-emerald-950/50 border-emerald-800/80 text-emerald-400' 
                : 'bg-amber-950/50 border-amber-800/80 text-amber-400 animate-pulse'
            }`}
          >
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">{isConnected ? 'WS LIVE' : 'CONNECTING'}</span>
          </div>
        </div>

      </div>
    </header>
  );
};

export default Header;
