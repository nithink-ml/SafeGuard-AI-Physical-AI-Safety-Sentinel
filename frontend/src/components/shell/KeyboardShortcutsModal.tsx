import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Acknowledge active critical safety alert' },
    { key: 'M', desc: 'Toggle mute / unmute for browser piezo siren' },
    { key: 'R', desc: 'Emergency reset ESP32 state machine (FSM)' },
    { key: 'T', desc: 'Trigger 2.4kHz piezo siren test chirp' },
    { key: '1 - 8', desc: 'Quick switch between operational views' },
    { key: '?', desc: 'Open / close this operator shortcuts modal' },
    { key: 'Esc', desc: 'Close any active overlay or modal' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl p-6 text-slate-100"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Operator Keyboard Shortcuts</h3>
              <p className="text-xs text-slate-400">Rapid industrial HMI hotkey reference</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          {shortcuts.map((sc, idx) => (
            <div 
              key={idx}
              className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
            >
              <span className="text-slate-300 font-medium">{sc.desc}</span>
              <kbd className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-600 font-mono text-[11px] font-bold text-slate-200 shadow-sm">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>ANSI/ISA-101 Operator Ergonomics</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;
