import type { AntennaStatus } from "@/lib/types";

export function statusColor(status: AntennaStatus): string {
  const colors: Record<AntennaStatus, string> = {
    online: "#22c55e",
    warning: "#f59e0b",
    offline: "#ef4444",
    idle: "#64748b",
  };
  return colors[status];
}

export function statusLabel(status: AntennaStatus): string {
  const labels: Record<AntennaStatus, string> = {
    online: "En ligne",
    warning: "Alerte",
    offline: "Hors ligne",
    idle: "Inactif",
  };
  return labels[status];
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function signalBars(strength: number): number {
  if (strength >= 80) return 4;
  if (strength >= 60) return 3;
  if (strength >= 40) return 2;
  if (strength > 0) return 1;
  return 0;
}
