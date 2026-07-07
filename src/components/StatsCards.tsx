"use client";

import type { DashboardStats } from "@/lib/types";
import { Activity, AlertTriangle, Antenna, MapPin, Signal, WifiOff } from "lucide-react";

interface StatsCardsProps {
  stats: DashboardStats;
}

const cards = [
  {
    key: "sites" as const,
    label: "Sites IoT",
    icon: MapPin,
    color: "text-accent",
    bg: "bg-accent/10",
    getValue: (s: DashboardStats) => s.totalSites,
  },
  {
    key: "antennas" as const,
    label: "Antennes",
    icon: Antenna,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    getValue: (s: DashboardStats) => s.totalAntennas,
  },
  {
    key: "online" as const,
    label: "En ligne",
    icon: Activity,
    color: "text-status-online",
    bg: "bg-status-online/10",
    getValue: (s: DashboardStats) => s.onlineAntennas,
  },
  {
    key: "alerts" as const,
    label: "Alertes actives",
    icon: AlertTriangle,
    color: "text-status-warning",
    bg: "bg-status-warning/10",
    getValue: (s: DashboardStats) => s.activeAlerts,
  },
  {
    key: "offline" as const,
    label: "Hors ligne",
    icon: WifiOff,
    color: "text-status-offline",
    bg: "bg-status-offline/10",
    getValue: (s: DashboardStats) => s.offlineAntennas,
  },
  {
    key: "signal" as const,
    label: "Signal moyen",
    icon: Signal,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    getValue: (s: DashboardStats) => `${s.avgSignalStrength}%`,
  },
];

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="glass animate-fade-in rounded-xl p-4 transition-transform hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <div className={`rounded-lg p-2 ${card.bg}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-white">{card.getValue(stats)}</p>
            <p className="text-xs text-slate-400">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}
