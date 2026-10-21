import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/shell/Header';
import Sidebar from './components/shell/Sidebar';
import OperationalShiftBar from './components/shell/OperationalShiftBar';
import KeyboardShortcutsModal from './components/shell/KeyboardShortcutsModal';
import OverviewDashboard from './components/dashboard/OverviewDashboard';
import MonitoringView from './components/monitoring/MonitoringView';
import SafetyAlertsView from './components/alerts/SafetyAlertsView';
import SafetyAnalyticsView from './components/analytics/SafetyAnalyticsView';
import DeviceTelemetryView from './components/devices/DeviceTelemetryView';
import EventHistoryView from './components/events/EventHistoryView';
import SystemHealthView from './components/health/SystemHealthView';
import ProtocolTraceabilityView from './components/health/ProtocolTraceabilityView';

import api from './services/api';
import wsService from './services/websocket';
import { 
  startAlarmBuzzer, 
  stopAlarmBuzzer, 
  setAudioEnabled,
  playTactileClick,
  testSirenChirp
} from './utils/audio';

import { NavigationTab } from './types/navigation';
import { FirmwareState, WebSocketTelemetryMessage } from './types/telemetry';
import { ZoneDefinition } from './types/schema';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [audioActive, setAudioActive] = useState<boolean>(true);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isClockUtc, setIsClockUtc] = useState<boolean>(false);

  // System & Firmware State
  const [firmwareState, setFirmwareState] = useState<FirmwareState>('STATE_NORMAL');
  const [redLed, setRedLed] = useState<boolean>(false);
  const [buzzerActive, setBuzzerActive] = useState<boolean>(false);
  const [uptimeSec, setUptimeSec] = useState<number>(0);
  const [freeHeapBytes, setFreeHeapBytes] = useState<number>(294812);
  const [totalEvents, setTotalEvents] = useState<number>(0);
  const [duplicateDropped, setDuplicateDropped] = useState<number>(0);
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(0);
  const [uartLogs, setUartLogs] = useState<string[]>([]);

  // Spatial & Zone State
  const [zones, setZones] = useState<ZoneDefinition[]>([]);
  const [workerPos, setWorkerPos] = useState<{ x: number; y: number }>({ x: 200, y: 200 });
  const [currentZoneId, setCurrentZoneId] = useState<string | null>(null);
  const [latestEvent, setLatestEvent] = useState<any | null>(null);

  // Sync acoustic browser buzzer with firmware alarm state
  useEffect(() => {
    if (firmwareState === 'STATE_ALARM' && audioActive) {
      startAlarmBuzzer();
    } else {
      stopAlarmBuzzer();
    }

    return () => {
      stopAlarmBuzzer();
    };
  }, [firmwareState, audioActive]);

  const handleToggleAudio = () => {
    const next = !audioActive;
    setAudioActive(next);
    setAudioEnabled(next);
  };

  // Global Operator Keyboard Shortcuts (ANSI/ISA-101 Ergonomics)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        playTactileClick();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsShortcutsOpen(false);
        setIsSidebarOpenMobile(false);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        playTactileClick();
        handleToggleAudio();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTactileClick();
        handleResetFirmware();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        playTactileClick();
        testSirenChirp();
      } else if (e.key === ' ') {
        e.preventDefault();
        playTactileClick();
        if (firmwareState === 'STATE_ALARM') {
          handleTriggerIncursion('clear');
        } else {
          testSirenChirp();
        }
      } else if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(e.key)) {
        e.preventDefault();
        playTactileClick();
        const tabMap: Record<string, NavigationTab> = {
          '1': 'overview',
          '2': 'monitoring',
          '3': 'alerts',
          '4': 'analytics',
          '5': 'devices',
          '6': 'events',
          '7': 'health',
          '8': 'protocol',
        };
        const nextTab = tabMap[e.key];
        if (nextTab) setActiveTab(nextTab);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [firmwareState, audioActive]);

  // Initial Data Fetch
  const fetchInitialData = useCallback(async () => {
    try {
      const [zonesRes, statusRes, logsRes, alertsRes] = await Promise.allSettled([
        api.getZones(),
        api.getStatus(),
        api.getUartLogs(30),
        api.getAlerts(true),
      ]);

      if (zonesRes.status === 'fulfilled' && zonesRes.value.zones) {
        setZones(zonesRes.value.zones);
      }
      if (statusRes.status === 'fulfilled') {
        const fw = statusRes.value.firmware;
        if (fw) {
          setFirmwareState(fw.state);
          setRedLed(fw.red_led);
          setBuzzerActive(fw.buzzer_active);
          setUptimeSec(fw.uptime_sec);
          setFreeHeapBytes(fw.free_heap_bytes);
          setTotalEvents(fw.total_events);
          setDuplicateDropped(fw.duplicates_dropped);
        }
        if (typeof statusRes.value.active_alerts_count === 'number') {
          setActiveAlertsCount(statusRes.value.active_alerts_count);
        }
      }
      if (logsRes.status === 'fulfilled' && logsRes.value.logs) {
        setUartLogs(logsRes.value.logs);
      }
      if (alertsRes.status === 'fulfilled' && typeof alertsRes.value.active_count === 'number') {
        setActiveAlertsCount(alertsRes.value.active_count);
      }
    } catch (err) {
      console.warn('Initial data load warning:', err);
    }
  }, []);

  // Real-Time WebSocket Streaming Integration
  useEffect(() => {
    fetchInitialData();
    wsService.connect();

    const unsubStatus = wsService.onStatusChange((connected) => {
      setIsConnected(connected);
    });

    const unsubMessage = wsService.onMessage((msg: WebSocketTelemetryMessage) => {
      if (msg.type === 'TELEMETRY_UPDATE') {
        const fw = msg.firmware;
        if (fw) {
          setFirmwareState(fw.state);
          setRedLed(fw.red_led);
          setBuzzerActive(fw.buzzer);
          setUptimeSec(fw.uptime_sec);
          setFreeHeapBytes(fw.free_heap_bytes);
          setTotalEvents(fw.total_events);
          setDuplicateDropped(fw.duplicate_dropped);
        }
        if (msg.recent_logs) {
          setUartLogs(msg.recent_logs);
        }
        if (msg.latest_event) {
          setLatestEvent(msg.latest_event);
        }
        if (msg.worker) {
          setWorkerPos(msg.worker);
        }
        if (typeof msg.active_alerts_count === 'number') {
          setActiveAlertsCount(msg.active_alerts_count);
        }
      }
    });

    return () => {
      unsubStatus();
      unsubMessage();
      wsService.disconnect();
    };
  }, [fetchInitialData]);

  // Handle worker position update from FloorPlanCanvas
  const handleMoveWorker = async (x: number, y: number) => {
    setWorkerPos({ x, y });

    try {
      const data = await api.moveWorker(x, y, 'worker-01', 0.95);
      setFirmwareState(data.firmware_state);
      setRedLed(data.red_led);
      setBuzzerActive(data.buzzer_active);
      setCurrentZoneId(data.zone_id);
      if (data.event_emitted) {
        setLatestEvent(data.event_emitted);
      }
    } catch (err) {
      console.error('Worker move error:', err);
    }
  };

  // Handle preset incursion trigger (breach vs clear)
  const handleTriggerIncursion = async (scenario: 'breach' | 'clear') => {
    try {
      const data = await api.triggerIncursion(scenario, 'worker-01');
      setFirmwareState(data.firmware_state);
      setRedLed(data.red_led);
      setBuzzerActive(data.buzzer_active);
      setCurrentZoneId(data.zone_id);
      setWorkerPos(data.worker);
      if (data.event_emitted) {
        setLatestEvent(data.event_emitted);
      }
      // Refresh alerts count
      const alerts = await api.getAlerts(true);
      setActiveAlertsCount(alerts.active_count);
    } catch (err) {
      console.error('Incursion trigger error:', err);
    }
  };

  // Handle manual firmware reset
  const handleResetFirmware = async () => {
    try {
      const data = await api.resetFirmware();
      setFirmwareState(data.current_state as FirmwareState);
      setRedLed(data.red_led);
      setBuzzerActive(data.buzzer);
      setCurrentZoneId(null);
      // Refresh alerts count
      const alerts = await api.getAlerts(true);
      setActiveAlertsCount(alerts.active_count);
    } catch (err) {
      console.error('Reset error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-red-500 selection:text-white">
      
      {/* Top Industrial Navigation Header */}
      <Header
        firmwareState={firmwareState}
        redLed={redLed}
        buzzerActive={buzzerActive}
        audioEnabled={audioActive}
        onToggleAudio={handleToggleAudio}
        onResetFirmware={handleResetFirmware}
        isConnected={isConnected}
        uptimeSec={uptimeSec}
        onToggleSidebar={() => setIsSidebarOpenMobile(!isSidebarOpenMobile)}
        isClockUtc={isClockUtc}
      />

      {/* Operational Shift & Industrial Plant Metadata Strip */}
      <OperationalShiftBar
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        isClockUtc={isClockUtc}
        onToggleClockUtc={() => setIsClockUtc(!isClockUtc)}
      />

      {/* Operator Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Main Split Layout: Sidebar Navigation + Dynamic Workspace */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          activeAlertsCount={activeAlertsCount}
          isOpenMobile={isSidebarOpenMobile}
          onCloseMobile={() => setIsSidebarOpenMobile(false)}
        />

        {/* Dynamic Workspace Container */}
        <main className="flex-1 p-4 lg:p-6 min-w-0 max-w-full overflow-x-hidden">
          
          {activeTab === 'overview' && (
            <OverviewDashboard
              firmwareState={firmwareState}
              redLed={redLed}
              buzzerActive={buzzerActive}
              uptimeSec={uptimeSec}
              freeHeapBytes={freeHeapBytes}
              totalEvents={totalEvents}
              duplicateDropped={duplicateDropped}
              activeAlertsCount={activeAlertsCount}
              onNavigate={setActiveTab}
              onTriggerIncursion={handleTriggerIncursion}
              onResetFirmware={handleResetFirmware}
              recentLogs={uartLogs}
            />
          )}

          {activeTab === 'monitoring' && (
            <MonitoringView
              zones={zones}
              workerPos={workerPos}
              onMoveWorker={handleMoveWorker}
              onTriggerIncursion={handleTriggerIncursion}
              isAlarmActive={firmwareState === 'STATE_ALARM'}
              currentZoneId={currentZoneId}
            />
          )}

          {activeTab === 'alerts' && (
            <SafetyAlertsView />
          )}

          {activeTab === 'analytics' && (
            <SafetyAnalyticsView />
          )}

          {activeTab === 'devices' && (
            <DeviceTelemetryView
              logs={uartLogs}
              freeHeapBytes={freeHeapBytes}
              uptimeSec={uptimeSec}
              totalEvents={totalEvents}
              duplicateDropped={duplicateDropped}
              firmwareState={firmwareState}
              redLed={redLed}
              buzzerActive={buzzerActive}
            />
          )}

          {activeTab === 'events' && (
            <EventHistoryView />
          )}

          {activeTab === 'health' && (
            <SystemHealthView />
          )}

          {activeTab === 'protocol' && (
            <ProtocolTraceabilityView
              latestEvent={latestEvent}
            />
          )}

        </main>
      </div>

      {/* Industrial Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-3.5 px-4 lg:px-8 text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1600px] mx-auto w-full">
        <div>
          SafeGuard AI &bull; Embedded SF: CraftifAI Physical AI Hackathon &bull; Team: <strong className="text-slate-300">Byte Hustlers (69949982)</strong>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <span>PipeGen v0.5.1</span>
          <span>&bull;</span>
          <span>FirmGen v0.4.1</span>
          <span>&bull;</span>
          <span>ESP-IDF v5.5</span>
          <span>&bull;</span>
          <span className="text-emerald-400 font-bold">BARR-C:2018 Compliant</span>
        </div>
      </footer>

    </div>
  );
};

export default App;
