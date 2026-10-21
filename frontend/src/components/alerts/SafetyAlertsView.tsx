import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Search, 
  Filter, 
  Clock, 
  UserCheck, 
  FileText, 
  RefreshCw,
  X
} from 'lucide-react';
import api from '../../services/api';
import { SafetyAlert } from '../../types/api';
import { formatDateTime, formatTimestamp, exportAuditCsv } from '../../utils/formatters';
import { playTactileClick } from '../../utils/audio';

export const SafetyAlertsView: React.FC = () => {
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'active' | 'ack'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal state
  const [selectedAlertForAck, setSelectedAlertForAck] = useState<SafetyAlert | null>(null);
  const [ackName, setAckName] = useState('Safety Supervisor (Nithin)');
  const [ackNote, setAckNote] = useState('Hazard zone verified clear and personnel alerted.');
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);

  const quickPresets = [
    'Hazard zone verified clear — personnel stepped back into safe walkway',
    'Authorized maintenance procedure with lockout/tagout (LOTO) active',
    'Optical laser curtain sensor check / alignment calibration complete',
  ];

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAlerts(filterType === 'active');
      setAlerts(res.alerts);
    } catch (err) {
      console.warn('Alerts fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 4000);
    return () => clearInterval(interval);
  }, [filterType]);

  const handleAcknowledge = async () => {
    if (!selectedAlertForAck) return;
    setIsSubmittingAck(true);

    try {
      await api.acknowledgeAlert(selectedAlertForAck.alert_id, ackName, ackNote);
      setSelectedAlertForAck(null);
      await fetchAlerts();
    } catch (err) {
      console.error('Ack error:', err);
    } finally {
      setIsSubmittingAck(false);
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filterType === 'active' && a.acknowledged) return false;
    if (filterType === 'ack' && !a.acknowledged) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        a.alert_id.toLowerCase().includes(q) ||
        a.zone_id.toLowerCase().includes(q) ||
        (a.actor_id && a.actor_id.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const activeCount = alerts.filter(a => !a.acknowledged).length;
  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const acknowledgedCount = alerts.filter(a => a.acknowledged).length;

  return (
    <div className="space-y-4">
      
      {/* ISA-18.2 Annunciator Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Critical Priority</div>
            <div className="text-base font-bold text-red-400 mt-0.5">{criticalCount} Incidents</div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Unacknowledged</div>
            <div className="text-base font-bold text-amber-400 mt-0.5">{activeCount} Pending</div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Supervisor Signed</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">{acknowledgedCount} Cleared</div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Alarm Standard</div>
            <div className="text-base font-bold text-purple-300 mt-0.5">ISA-18.2 / EEMUA</div>
          </div>
          <span className="text-[10px] text-slate-400 font-bold">191</span>
        </div>
      </div>

      {/* Header & Filter Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Safety Incident Alerts Queue
            </h2>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-mono font-bold animate-pulse">
                {activeCount} ACTIVE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time critical machine envelope breach incidents generated by the physical AI sentinel.
          </p>
        </div>

        {/* Filter Pills, CSV Export & Refresh */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search alert ID or zone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium font-mono">
            <button
              onClick={() => {
                playTactileClick();
                setFilterType('all');
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'all' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => {
                playTactileClick();
                setFilterType('active');
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'active' ? 'bg-red-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => {
                playTactileClick();
                setFilterType('ack');
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'ack' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Acknowledged
            </button>
          </div>

          <button
            onClick={() => {
              playTactileClick();
              exportAuditCsv(filteredAlerts.map(a => ({
                ...a,
                event_type: a.acknowledged ? 'acknowledged_incident' : 'active_breach'
              })));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900/80 text-blue-300 border border-blue-700/80 text-xs font-semibold font-mono transition-all active:scale-95"
            title="Download Safety Alerts CSV"
          >
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              playTactileClick();
              fetchAlerts();
            }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95 transition-all"
            title="Refresh Alerts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alerts Table / List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {filteredAlerts.length > 0 ? (
          <div className="divide-y divide-slate-800/80">
            {filteredAlerts.map(alert => {
              const isUnacknowledged = !alert.acknowledged;

              return (
                <div 
                  key={alert.alert_id}
                  className={`p-4 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 ${
                    isUnacknowledged 
                      ? 'border-l-red-500 bg-red-950/20 hover:bg-red-950/30' 
                      : 'border-l-emerald-500 hover:bg-slate-850/50'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`p-2 rounded-xl mt-0.5 border ${
                      isUnacknowledged 
                        ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' 
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-white">
                          {alert.alert_id}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                          alert.severity === 'CRITICAL' 
                            ? 'bg-red-600 text-white border-red-500' 
                            : 'bg-amber-600 text-white border-amber-500'
                        }`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          Zone: <strong className="text-slate-200">{alert.zone_id}</strong>
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                        <span>Time: <strong className="text-slate-300 font-mono">{formatDateTime(alert.timestamp)}</strong></span>
                        <span>•</span>
                        <span>Confidence: <strong className="text-emerald-400 font-mono">{Math.round(alert.confidence * 100)}%</strong></span>
                        {alert.foot_point && (
                          <>
                            <span>•</span>
                            <span>P_foot: <strong className="text-blue-400 font-mono">({alert.foot_point[0]}, {alert.foot_point[1]})</strong></span>
                          </>
                        )}
                      </div>

                      {alert.acknowledged && (
                        <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5 pt-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Acknowledged by {alert.acknowledged_by || 'Operator'}</span>
                          {alert.note && <span className="text-slate-400 italic">(&ldquo;{alert.note}&rdquo;)</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    {isUnacknowledged ? (
                      <button
                        onClick={() => setSelectedAlertForAck(alert)}
                        className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-600/30 flex items-center gap-1.5"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Acknowledge</span>
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-400 text-xs font-mono font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolved</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 px-4 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">No Safety Incidents In Queue</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {filterType === 'active' 
                ? 'All exclusion zones are clear and secure. No unacknowledged incursions.' 
                : 'Trigger an incursion breach from the dashboard or spatial twin to populate alerts.'}
            </p>
          </div>
        )}
      </div>

      {/* Acknowledge Modal Dialog */}
      {selectedAlertForAck && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                Acknowledge Safety Incident
              </h3>
              <button 
                onClick={() => setSelectedAlertForAck(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs space-y-1">
              <div>Alert ID: <strong className="text-white">{selectedAlertForAck.alert_id}</strong></div>
              <div>Zone: <strong className="text-amber-400">{selectedAlertForAck.zone_id}</strong></div>
              <div>Timestamp: <span className="text-slate-400">{formatDateTime(selectedAlertForAck.timestamp)}</span></div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Acknowledging Supervisor Name:</label>
                <input
                  type="text"
                  value={ackName}
                  onChange={e => setAckName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Operational Resolution Note:</label>
                <textarea
                  value={ackNote}
                  onChange={e => setAckNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] text-slate-400 font-semibold block">Quick Incident Presets:</label>
                <div className="flex flex-col gap-1.5">
                  {quickPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        playTactileClick();
                        setAckNote(preset);
                      }}
                      className="text-left p-1.5 px-2.5 rounded bg-slate-950 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      &bull; {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedAlertForAck(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledge}
                disabled={isSubmittingAck}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/30"
              >
                {isSubmittingAck ? 'Submitting...' : 'Confirm Acknowledgment'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SafetyAlertsView;
