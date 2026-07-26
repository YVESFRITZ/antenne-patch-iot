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
            className="glass animate-fade-in relative overflow-hidden rounded-2xl p-4 transition-shadow hover:shadow-card-hover"
          >
            {/* Liseré coloré : identifie la mesure d'un coup d'œil */}
            <span
              className={`absolute inset-x-0 top-0 h-1 ${card.bg.replace("/10", "")}`}
              aria-hidden
            />
            <div className="flex items-start justify-between">
              <div className={`inline-flex rounded-xl p-2 ${card.bg}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-ink">
              {card.getValue(stats)}
            </p>
            <p className="mt-0.5 text-xs font-medium text-ink-muted">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}
