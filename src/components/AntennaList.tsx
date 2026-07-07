"use client";

import type { Antenna } from "@/lib/types";
import { formatTime, signalBars, statusColor, statusLabel } from "@/lib/utils";
import { Antenna as AntennaIcon, Battery, Signal } from "lucide-react";

interface AntennaListProps {
  antennas: Antenna[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function AntennaList({ antennas, selectedId, onSelect }: AntennaListProps) {
  return (
    <div className="space-y-2">
      {antennas.map((antenna) => {
        const isSelected = antenna.id === selectedId;
        const bars = signalBars(antenna.signalStrength);

        return (
          <button
            key={antenna.id}
            onClick={() => onSelect(antenna.id)}
            className={`glass w-full rounded-xl p-4 text-left transition-all hover:scale-[1.01] ${
              isSelected ? "border-accent/50 shadow-glow" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${statusColor(antenna.status)}15` }}
                >
                  <AntennaIcon
                    className="h-4 w-4"
                    style={{ color: statusColor(antenna.status) }}
                  />
                </div>
                <div>
                  <p className="font-mono text-sm font-bold text-white">{antenna.name}</p>
                  <p className="text-xs text-slate-400">
                    {antenna.type} · {statusLabel(antenna.status)}
                  </p>
                </div>
              </div>
              <div className="flex items-end gap-0.5">
                {[1, 2, 3, 4].map((bar) => (
                  <div
                    key={bar}
                    className="w-1.5 rounded-sm"
                    style={{
                      height: `${bar * 3 + 3}px`,
                      backgroundColor: bar <= bars ? statusColor(antenna.status) : "#243044",
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Signal className="h-3 w-3" />
                {antenna.signalStrength}%
              </span>
              <span className="flex items-center gap-1">
                <Battery className="h-3 w-3" />
                {antenna.battery}%
              </span>
              <span>{antenna.connectedDevices} appareils</span>
              <span className="ml-auto">{formatTime(antenna.lastSeen)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
