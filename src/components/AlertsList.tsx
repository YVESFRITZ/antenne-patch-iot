"use client";

import type { Alert } from "@/lib/types";
import { formatTime } from "@/lib/utils";
import { AlertTriangle, Bell, Check, Info, XCircle } from "lucide-react";

interface AlertsListProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
}

const severityConfig = {
  critical: { icon: XCircle, color: "text-status-offline", bg: "bg-status-offline/10" },
  warning: { icon: AlertTriangle, color: "text-status-warning", bg: "bg-status-warning/10" },
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-400/10" },
};

export default function AlertsList({ alerts, onAcknowledge }: AlertsListProps) {
  const activeAlerts = alerts.filter((a) => !a.acknowledged);

  if (activeAlerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Bell className="mb-3 h-8 w-8 text-status-online" />
        <p className="text-sm">Aucune alerte active</p>
        <p className="text-xs">Tous les systèmes fonctionnent normalement</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activeAlerts.map((alert) => {
        const config = severityConfig[alert.severity];
        const Icon = config.icon;
        return (
          <div
            key={alert.id}
            className="glass animate-fade-in flex items-start gap-3 rounded-xl p-4"
          >
            <div className={`rounded-lg p-2 ${config.bg}`}>
              <Icon className={`h-4 w-4 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{alert.message}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {alert.antennaName} · {alert.siteName} · {formatTime(alert.timestamp)}
              </p>
            </div>
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="flex items-center gap-1 rounded-lg bg-surface-overlay px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-accent/10 hover:text-accent"
            >
              <Check className="h-3 w-3" />
              Acquitter
            </button>
          </div>
        );
      })}
    </div>
  );
}
