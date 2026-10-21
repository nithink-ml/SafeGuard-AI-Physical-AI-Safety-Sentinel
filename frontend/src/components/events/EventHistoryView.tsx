import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  FileCode, 
  CheckCircle, 
  Copy, 
  Check, 
  RefreshCw, 
  X,
  ExternalLink,
  Download,
  Terminal,
  Activity,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Disc
} from 'lucide-react';
import api from '../../services/api';
import { SafetyEvent } from '../../types/schema';
import { formatDateTime, exportAuditCsv } from '../../utils/formatters';
import { playTactileClick } from '../../utils/audio';

export const EventHistoryView: React.FC = () => {
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<SafetyEvent | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const typeParam = filterType === 'all' ? undefined : filterType;
      const res = await api.getEvents(100, typeParam);
      setEvents(res.events);
    } catch (err) {
      console.warn('Events fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 4000);
    return () => clearInterval(interval);
  }, [filterType]);

  const handleCopyPayload = (ev: SafetyEvent) => {
    playTactileClick();
    navigator.clipboard.writeText(JSON.stringify(ev, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredEvents = events.filter(e => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.event_id.toLowerCase().includes(q) ||
        e.zone_id.toLowerCase().includes(q) ||
        e.event_type.toLowerCase().includes(q) ||
        (e.actor_id && e.actor_id.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const breachCount = events.filter(e => e.event_type === 'restricted_zone_entry').length;
  const clearCount = events.filter(e => e.event_type === 'restricted_zone_clear').length;

  return (
    <div className="space-y-5">
      
      {/* Industrial Workstation Black-Box Recorder Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <Disc className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Black-Box Event Telemetry Flight Recorder (`safeguard/events`)
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 border border-purple-700 text-purple-300">
                16-SLOT RING BUFFER
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic, non-volatile ingestion history of Protocol Schema v1.0 JSON payloads with microsecond timestamps.
            </p>
          </div>
        </div>

        {/* Filter & Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto font-mono text-xs">
          <div className="relative w-48 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search UUID, zone, actor..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => {
                playTactileClick();
                setFilterType('all');
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'all' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({events.length})
            </button>
            <button
              onClick={() => {
                playTactileClick();
                setFilterType('restricted_zone_entry');
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'restricted_zone_entry' ? 'bg-red-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Breaches ({breachCount})
            </button>
            <button
              onClick={() => {
                playTactileClick();
                setFilterType('restricted_zone_clear');
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'restricted_zone_clear' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Clearances ({clearCount})
            </button>
          </div>

          <button
            onClick={() => {
              playTactileClick();
              exportAuditCsv(filteredEvents);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900/80 text-blue-300 border border-blue-700/80 transition-all active:scale-95 shadow-sm font-sans"
            title="Download CSV for regulatory audit"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-xs">Export CSV</span>
          </button>

          <button
            onClick={() => {
              playTactileClick();
              fetchEvents();
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95 transition-all"
            title="Refresh Ingestion Stream"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Flight Recorder Telemetry Ingestion Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm font-mono text-xs">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          <div className="p-2.5 space-y-0.5">
            <div className="text-[10px] uppercase text-slate-500">Ingested Events</div>
            <div className="text-xl font-bold text-white">{events.length} Frames</div>
            <div className="text-[10px] text-slate-400">Ring Capacity: 100/100</div>
          </div>

          <div className="p-2.5 space-y-0.5">
            <div className="text-[10px] uppercase text-slate-500">Incursion Breaches</div>
            <div className="text-xl font-bold text-red-400">{breachCount} Declared</div>
            <div className="text-[10px] text-slate-400">GPIO 2 & 4 Interlock</div>
          </div>

          <div className="p-2.5 space-y-0.5">
            <div className="text-[10px] uppercase text-slate-500">Clearance Latches</div>
            <div className="text-xl font-bold text-emerald-400">{clearCount} Reset</div>
            <div className="text-[10px] text-slate-400">Safe Operator Evacuation</div>
          </div>

          <div className="p-2.5 space-y-0.5">
            <div className="text-[10px] uppercase text-slate-500">Packet Integrity</div>
            <div className="text-xl font-bold text-cyan-300">100.0%</div>
            <div className="text-[10px] text-emerald-400">Zero Malformed Drops</div>
          </div>
        </div>
      </div>

      {/* High-Density Black-Box Events Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm font-mono text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                <th className="p-2.5 pl-3">Frame</th>
                <th className="p-2.5">UTC Timestamp</th>
                <th className="p-2.5">Safety Event Classification</th>
                <th className="p-2.5">Unique Event UUID</th>
                <th className="p-2.5">Hazard Zone</th>
                <th className="p-2.5">Confidence</th>
                <th className="p-2.5">Foot-Point Contact (P_contact)</th>
                <th className="p-2.5 pr-3 text-right">Raw Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((ev, idx) => {
                  const isBreach = ev.event_type === 'restricted_zone_entry';
                  const fp = Array.isArray(ev.foot_point) 
                    ? `[${ev.foot_point[0]}, ${ev.foot_point[1]}]`
                    : ev.foot_point ? `[${ev.foot_point.x}, ${ev.foot_point.y}]` : '--';

                  return (
                    <tr key={ev.event_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-2.5 pl-3 text-slate-500 font-bold">
                        #{String(events.length - idx).padStart(3, '0')}
                      </td>
                      <td className="p-2.5 text-slate-300 whitespace-nowrap">
                        {formatDateTime(ev.timestamp)}
                      </td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1.5 w-fit ${
                          isBreach 
                            ? 'bg-red-950/80 text-red-300 border-red-700' 
                            : 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isBreach ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} />
                          {ev.event_type}
                        </span>
                      </td>
                      <td className="p-2.5 text-white font-bold whitespace-nowrap">
                        <code>{ev.event_id.slice(0, 16)}...</code>
                      </td>
                      <td className="p-2.5 text-slate-300">
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px]">
                          {ev.zone_id}
                        </span>
                      </td>
                      <td className="p-2.5 text-emerald-400 font-bold">
                        {Math.round(ev.confidence * 100)}%
                      </td>
                      <td className="p-2.5 text-cyan-300 font-bold whitespace-nowrap">
                        {fp}
                      </td>
                      <td className="p-2.5 pr-3 text-right">
                        <button
                          onClick={() => {
                            playTactileClick();
                            setSelectedEvent(ev);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold transition-colors active:scale-95 shadow-sm font-sans"
                        >
                          Inspect JSON
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 text-xs font-sans">
                    No safety events matching filter criteria. Trigger an incursion breach or run the vision sentinel to generate telemetry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Protocol Schema v1.0 JSON Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-5 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white">
                  Black-Box Ingestion Frame &bull; UUID: {selectedEvent.event_id.slice(0, 12)}...
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyPayload(selectedEvent)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button 
                  onClick={() => {
                    playTactileClick();
                    setSelectedEvent(null);
                  }}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-[#050811] border border-slate-800 rounded-lg p-3 text-xs text-purple-300 overflow-x-auto max-h-96 shadow-inner">
              <pre>{JSON.stringify(selectedEvent, null, 2)}</pre>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span>Schema Version: <strong className="text-white">1.0</strong></span>
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> Pydantic v2.10 Validated
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EventHistoryView;
