"use client";

import { useMemo } from "react";
import type { Antenna } from "@/lib/types";
import {
  cardinalDirection,
  computeLinkBudget,
  formatDistance,
  statusColor,
  statusLabel,
  typicalFrequencyMHz,
} from "@/lib/utils";
import {
  ArrowRight,
  Compass,
  Gauge,
  Radio,
  Ruler,
  Satellite,
  Signal,
  Waves,
} from "lucide-react";

interface LinkCalculatorProps {
  antennas: Antenna[];
  txId: string | null;
  rxId: string | null;
  onTxChange: (id: string) => void;
  onRxChange: (id: string) => void;
}

const qualityColor: Record<string, string> = {
  excellent: "#22c55e",
  bon: "#0d9488",
  limite: "#f59e0b",
  hors_portee: "#ef4444",
};

function AntennaSelect({
  label,
  role,
  value,
  antennas,
  onChange,
}: {
  label: string;
  role: "émetteur" | "récepteur";
  value: string | null;
  antennas: Antenna[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex-1">
      <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-ink-muted">
        {role === "émetteur" ? (
          <Radio className="h-3.5 w-3.5 text-accent" />
        ) : (
          <Satellite className="h-3.5 w-3.5 text-blue-400" />
        )}
        {label}
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-surface-overlay bg-surface-raised px-3 py-2.5 text-sm text-ink outline-none focus:border-accent/50"
      >
        <option value="" disabled>
          Sélectionner…
        </option>
        {antennas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {a.type} · {statusLabel(a.status)}
          </option>
        ))}
      </select>
    </div>
  );
}

function ResultCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-ink",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-surface-overlay bg-surface-overlay/40 p-4">
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`mt-1.5 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-subtle">{sub}</p>}
    </div>
  );
}

export default function LinkCalculator({
  antennas,
  txId,
  rxId,
  onTxChange,
  onRxChange,
}: LinkCalculatorProps) {
  const tx = antennas.find((a) => a.id === txId) ?? null;
  const rx = antennas.find((a) => a.id === rxId) ?? null;

  const budget = useMemo(() => {
    if (!tx || !rx || tx.id === rx.id) return null;
    // Fréquence de la liaison : celle de l'émetteur.
    const freqMHz = typicalFrequencyMHz(tx.type);
    return computeLinkBudget({
      lat1: tx.lat,
      lng1: tx.lng,
      lat2: rx.lat,
      lng2: rx.lng,
      freqMHz,
      txSignal: tx.signalStrength,
      rxSignal: rx.signalStrength,
    });
  }, [tx, rx]);

  const sameModule = tx && rx && tx.id === rx.id;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="glass rounded-xl p-5">
        <div className="mb-1 flex items-center gap-2">
          <Ruler className="h-5 w-5 text-accent" />
          <h3 className="text-sm font-semibold text-ink">
            Calcul de liaison émetteur → récepteur
          </h3>
        </div>
        <p className="mb-4 text-xs text-ink-muted">
          Sélectionnez deux modules pour calculer la distance géodésique, l&apos;azimut
          de pointage et le bilan de liaison radio (portée estimée).
        </p>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
          <AntennaSelect
            label="Module émetteur (TX)"
            role="émetteur"
            value={txId}
            antennas={antennas}
            onChange={onTxChange}
          />
          <div className="hidden pb-3 sm:block">
            <ArrowRight className="h-5 w-5 text-ink-subtle" />
          </div>
          <AntennaSelect
            label="Module récepteur (RX)"
            role="récepteur"
            value={rxId}
            antennas={antennas}
            onChange={onRxChange}
          />
        </div>

        {sameModule && (
          <p className="mt-3 rounded-lg bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
            Sélectionnez deux modules différents.
          </p>
        )}
      </div>

      {budget && tx && rx && (
        <>
          {/* Bandeau qualité */}
          <div
            className="glass flex items-center justify-between rounded-xl border-l-4 p-4"
            style={{ borderColor: qualityColor[budget.quality] }}
          >
            <div className="flex items-center gap-3">
              <Waves
                className="h-6 w-6"
                style={{ color: qualityColor[budget.quality] }}
              />
              <div>
                <p
                  className="text-base font-bold"
                  style={{ color: qualityColor[budget.quality] }}
                >
                  {budget.qualityLabel}
                </p>
                <p className="text-xs text-ink-muted">
                  Marge de liaison estimée :{" "}
                  <span className="font-mono text-ink">
                    {budget.linkMarginDb.toFixed(1)} dB
                  </span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs text-ink-muted">
                {tx.name}
                <span className="mx-1.5 text-accent">→</span>
                {rx.name}
              </p>
              <p className="text-xs text-ink-subtle">
                Liaison {tx.type} · {budget.freqMHz} MHz
              </p>
            </div>
          </div>

          {/* Résultats principaux */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ResultCard
              icon={Ruler}
              label="Distance"
              value={formatDistance(budget.distanceMeters)}
              sub={`${budget.distanceMeters.toFixed(0)} mètres`}
              color="text-accent"
            />
            <ResultCard
              icon={Compass}
              label="Azimut (TX → RX)"
              value={`${budget.bearingDeg.toFixed(0)}°`}
              sub={`Direction ${cardinalDirection(budget.bearingDeg)}`}
            />
            <ResultCard
              icon={Signal}
              label="Affaiblissement (FSPL)"
              value={`${budget.fsplDb.toFixed(1)} dB`}
              sub="Espace libre"
            />
            <ResultCard
              icon={Gauge}
              label="Marge de liaison"
              value={`${budget.linkMarginDb.toFixed(1)} dB`}
              sub={budget.linkMarginDb > 0 ? "Liaison viable" : "Signal insuffisant"}
              color={budget.linkMarginDb > 0 ? "text-status-online" : "text-status-offline"}
            />
          </div>

          {/* Schéma de liaison */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between gap-4">
              {/* Émetteur */}
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                  <Radio className="h-6 w-6 text-accent" />
                </div>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: statusColor(tx.status) }}
                />
                <p className="font-mono text-xs text-ink">{tx.name}</p>
                <p className="text-[10px] text-ink-subtle">
                  {tx.lat.toFixed(4)}, {tx.lng.toFixed(4)}
                </p>
              </div>

              {/* Ligne */}
              <div className="relative flex-1">
                <div className="h-px w-full bg-gradient-to-r from-accent via-accent/50 to-blue-400" />
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    backgroundColor: `${qualityColor[budget.quality]}20`,
                    color: qualityColor[budget.quality],
                  }}
                >
                  {formatDistance(budget.distanceMeters)}
                </div>
              </div>

              {/* Récepteur */}
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-400/10">
                  <Satellite className="h-6 w-6 text-blue-400" />
                </div>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: statusColor(rx.status) }}
                />
                <p className="font-mono text-xs text-ink">{rx.name}</p>
                <p className="text-[10px] text-ink-subtle">
                  {rx.lat.toFixed(4)}, {rx.lng.toFixed(4)}
                </p>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] text-ink-subtle">
              Modèle espace libre (Friis). Les valeurs réelles dépendent du relief,
              des obstacles et des conditions météo.
            </p>
          </div>
        </>
      )}

      {!budget && !sameModule && (
        <div className="glass flex h-40 items-center justify-center rounded-xl">
          <p className="text-sm text-ink-muted">
            Choisissez un émetteur et un récepteur pour lancer le calcul.
          </p>
        </div>
      )}
    </div>
  );
}
