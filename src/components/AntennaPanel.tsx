"use client";

import { useEffect, useState } from "react";
import type { Antenna, TelemetryPoint } from "@/lib/types";
import type { HistoryRange, HourlyBucket } from "@/lib/history";
import { formatTime, signalBars, statusColor, statusLabel } from "@/lib/utils";
import {
  Battery,
  Cpu,
  Download,
  Droplets,
  Signal,
  Thermometer,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface AntennaPanelProps {
  antenna: Antenna | null;
  telemetry: TelemetryPoint[];
  onClose: () => void;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit?: string;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-surface-overlay/50 p-3">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        {label}
      </div>
      <p className="mt-1 text-lg font-bold text-white">
        {value}
        {unit && <span className="ml-0.5 text-sm font-normal text-slate-400">{unit}</span>}
      </p>
    </div>
  );
}

const RANGES: { id: HistoryRange | "live"; label: string }[] = [
  { id: "live", label: "Direct" },
  { id: "24h", label: "24 h" },
  { id: "7d", label: "7 j" },
  { id: "30d", label: "30 j" },
];

export default function AntennaPanel({ antenna, telemetry, onClose }: AntennaPanelProps) {
  const [range, setRange] = useState<HistoryRange | "live">("live");
  const [buckets, setBuckets] = useState<HourlyBucket[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const antennaId = antenna?.id;

  // Historique agrégé : chargé uniquement quand une période est demandée.
  useEffect(() => {
    if (!antennaId || range === "live") return;
    let cancelled = false;
    setLoadingHistory(true);
    fetch(`/api/history?antennaId=${antennaId}&range=${range}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setBuckets(d.buckets ?? []);
      })
      .catch(() => {
        if (!cancelled) setBuckets([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [antennaId, range]);

  if (!antenna) return null;

  const liveData = telemetry.map((t) => ({
    time: new Date(t.timestamp).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    signal: Math.round(t.signalStrength),
    temp: Math.round(t.temperature * 10) / 10,
  }));

  const historyData = buckets.map((b) => ({
    time: new Date(b.hour).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
    }),
    signal: Math.round(b.signalAvg),
    temp: Math.round(b.temperatureAvg * 10) / 10,
  }));

  const chartData = range === "live" ? liveData : historyData;
  const chartLabel =
    range === "live"
      ? "Historique signal (temps réel)"
      : `Signal moyen par heure — ${RANGES.find((r) => r.id === range)?.label}`;

  const bars = signalBars(antenna.signalStrength);

  return (
    <div className="glass animate-fade-in flex h-full flex-col rounded-xl border border-surface-overlay">
      <div className="flex items-center justify-between border-b border-surface-overlay p-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: statusColor(antenna.status) }}
            />
            <h3 className="font-mono text-sm font-bold text-accent">{antenna.name}</h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {antenna.type} · {statusLabel(antenna.status)} · {formatTime(antenna.lastSeen)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface-overlay hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex items-end gap-0.5">
            {[1, 2, 3, 4].map((bar) => (
              <div
                key={bar}
                className="w-2 rounded-sm transition-all"
                style={{
                  height: `${bar * 5 + 4}px`,
                  backgroundColor:
                    bar <= bars ? statusColor(antenna.status) : "#243044",
                }}
              />
            ))}
          </div>
          <span className="text-2xl font-bold text-white">{antenna.signalStrength}%</span>
          <span className="text-xs text-slate-400">force du signal</span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <MetricCard
            icon={Thermometer}
            label="Température"
            value={antenna.temperature}
            unit="°C"
            color="text-orange-400"
          />
          <MetricCard
            icon={Droplets}
            label="Humidité"
            value={antenna.humidity}
            unit="%"
            color="text-blue-400"
          />
          <MetricCard
            icon={Battery}
            label="Batterie"
            value={antenna.battery}
            unit="%"
            color={antenna.battery < 20 ? "text-status-offline" : "text-status-online"}
          />
          <MetricCard
            icon={Users}
            label="Appareils"
            value={antenna.connectedDevices}
            color="text-purple-400"
          />
        </div>

        <div className="mb-4 rounded-lg bg-surface-overlay/30 p-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Cpu className="h-3.5 w-3.5" />
            Firmware {antenna.firmware}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                range === r.id
                  ? "bg-accent text-black"
                  : "bg-surface-overlay text-slate-300 hover:bg-surface-overlay/70"
              }`}
            >
              {r.label}
            </button>
          ))}
          <a
            href={`/api/export?antennaId=${antenna.id}&range=30d`}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-surface-overlay px-2.5 py-1 text-[11px] text-slate-300 hover:text-white"
            title="Exporter l'historique 30 jours au format CSV"
          >
            <Download className="h-3 w-3" />
            CSV
          </a>
        </div>

        {loadingHistory && (
          <p className="mb-2 text-xs text-slate-500">Chargement de l&apos;historique…</p>
        )}

        {!loadingHistory && range !== "live" && chartData.length === 0 && (
          <p className="rounded-lg bg-surface-overlay/40 p-3 text-xs text-slate-400">
            Aucune donnée sur cette période. L&apos;historique se construit à mesure que
            les modules transmettent (un point par heure).
          </p>
        )}

        {chartData.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <Signal className="h-3.5 w-3.5 text-accent" />
              {chartLabel}
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="signalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00d4aa" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#00d4aa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#243044" />
                  <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: "#1a2332",
                      border: "1px solid #243044",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="signal"
                    stroke="#00d4aa"
                    fill="url(#signalGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
