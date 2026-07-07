"use client";

import {
  Activity,
  AlertTriangle,
  Antenna,
  Bell,
  LayoutDashboard,
  Map,
  Radio,
  Settings,
  Wifi,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  alertCount: number;
}

const navItems = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "map", label: "Carte des sites", icon: Map },
  { id: "antennas", label: "Antennes", icon: Antenna },
  { id: "alerts", label: "Alertes", icon: Bell },
  { id: "settings", label: "Paramètres", icon: Settings },
];

export default function Sidebar({ activeTab, onTabChange, alertCount }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-surface-overlay bg-surface-raised">
      <div className="border-b border-surface-overlay p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 shadow-glow">
            <Radio className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-white">AntennePatch</h1>
            <p className="text-xs text-slate-400">IoT Supervision</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                isActive
                  ? "bg-accent/10 text-accent shadow-glow"
                  : "text-slate-400 hover:bg-surface-overlay hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === "alerts" && alertCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-status-offline px-1.5 text-xs font-bold text-white">
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-surface-overlay p-4">
        <div className="rounded-lg bg-surface-overlay/50 p-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Activity className="h-3.5 w-3.5 text-status-online" />
            <span>Système opérationnel</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Wifi className="h-3.5 w-3.5 text-accent" />
            <span className="font-mono text-xs text-accent">MQTT · API REST</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
