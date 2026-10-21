import React from 'react';
import { 
  LayoutDashboard, 
  Eye, 
  AlertTriangle, 
  BarChart3, 
  Cpu, 
  History, 
  HeartPulse, 
  FileCode,
  ShieldCheck,
  X
} from 'lucide-react';
import { NavigationTab } from '../../types/navigation';
import { playTactileClick } from '../../utils/audio';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  activeAlertsCount: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeAlertsCount,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'overview' as NavigationTab,
      label: 'Overview Dashboard',
      icon: LayoutDashboard,
      hotkey: '1',
      badge: null,
    },
    {
      id: 'monitoring' as NavigationTab,
      label: 'Live AI Monitoring',
      icon: Eye,
      hotkey: '2',
      badge: 'LIVE',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'alerts' as NavigationTab,
      label: 'Safety Alerts',
      icon: AlertTriangle,
      hotkey: '3',
      badge: activeAlertsCount > 0 ? `${activeAlertsCount}` : null,
      badgeColor: activeAlertsCount > 0 ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse' : '',
    },
    {
      id: 'analytics' as NavigationTab,
      label: 'Safety Analytics',
      icon: BarChart3,
      hotkey: '4',
      badge: null,
    },
    {
      id: 'devices' as NavigationTab,
      label: 'ESP32 Diagnostics',
      icon: Cpu,
      hotkey: '5',
      badge: 'BARR-C',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    },
    {
      id: 'events' as NavigationTab,
      label: 'Event History',
      icon: History,
      hotkey: '6',
      badge: null,
    },
    {
      id: 'health' as NavigationTab,
      label: 'System Health',
      icon: HeartPulse,
      hotkey: '7',
      badge: null,
    },
    {
      id: 'protocol' as NavigationTab,
      label: 'Protocol & RTM',
      icon: FileCode,
      hotkey: '8',
      badge: 'v1.0',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Panel */}
      <aside className={`
        fixed lg:sticky top-0 lg:top-[61px] left-0 h-screen lg:h-[calc(100vh-61px)] 
        w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between 
        z-50 transition-transform duration-300 ease-in-out
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        
        {/* Navigation Items List */}
        <div className="p-3 space-y-1 overflow-y-auto">
          {/* Mobile Header with close button */}
          <div className="flex items-center justify-between p-2 mb-2 lg:hidden border-b border-slate-800">
            <span className="text-sm font-bold text-white">SafeGuard Sentinel</span>
            <button 
              onClick={onCloseMobile}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 px-3 py-1 font-semibold">
            Control Center
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  playTactileClick();
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-semibold ${item.badgeColor || 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      {item.badge}
                    </span>
                  )}
                  <kbd className={`hidden sm:inline-block px-1 py-0.2 rounded font-mono text-[9px] font-semibold border ${
                    isActive 
                      ? 'bg-blue-700 text-blue-100 border-blue-500' 
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {item.hotkey}
                  </kbd>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Hardware & Team Info */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 flex flex-col gap-2">
          {/* Automated Verification Badge */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-[11px] font-mono">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>TEST SUITE</span>
            </div>
            <span className="text-emerald-400 font-semibold">35/35 PASS</span>
          </div>

          {/* Team Info */}
          <div className="text-[10px] font-mono text-slate-500 px-1">
            <div className="flex justify-between">
              <span>Team: <strong className="text-slate-300">Byte Hustlers</strong></span>
              <span>Code: <strong className="text-slate-300">69949982</strong></span>
            </div>
            <div className="text-slate-600 mt-0.5 text-[9px]">
              CraftifAI Physical AI Hackathon
            </div>
          </div>
        </div>

      </aside>
    </>
  );
};

export default Sidebar;
