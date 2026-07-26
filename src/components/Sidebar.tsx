"use client";

import { Activity, Radio, Wifi } from "lucide-react";
import { navItems } from "@/lib/navItems";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  alertCount: number;
}

export default function Sidebar({ activeTab, onTabChange, alertCount }: SidebarProps) {
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-surface-overlay bg-surface-raised lg:flex">
      <div className="border-b border-surface-overlay p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white shadow-glow-lg">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-ink">AntennePatch</h1>
            <p className="text-xs text-ink-muted">Supervision IoT</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-accent-soft text-accent-dim"
                  : "text-ink-muted hover:bg-surface-overlay/60 hover:text-ink"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
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
          <div className="flex items-center gap-2 text-xs text-ink-muted">
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
