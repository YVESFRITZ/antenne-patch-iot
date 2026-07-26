"use client";

import { useEffect, useState } from "react";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/types";
import { Battery, Check, Database, RotateCcw, Signal, Thermometer, WifiOff } from "lucide-react";

interface ThresholdSettingsProps {
  /** Rafraîchit le tableau de bord (les alertes changent avec les seuils). */
  onChanged: () => void;
}

const FIELDS = [
  {
    key: "lowBattery" as const,
    label: "Batterie faible",
    unit: "%",
    icon: Battery,
    color: "text-status-online",
    help: "Alerte quand la batterie descend sous cette valeur",
    min: 0,
    max: 100,
  },
  {
    key: "highTemperature" as const,
    label: "Température élevée",
    unit: "°C",
    icon: Thermometer,
    color: "text-orange-400",
    help: "Alerte au-dessus de cette température",
    min: -50,
    max: 150,
  },
  {
    key: "weakSignal" as const,
    label: "Signal faible",
    unit: "%",
    icon: Signal,
    color: "text-accent",
    help: "Alerte quand le signal passe sous cette valeur",
    min: 0,
    max: 100,
  },
  {
    key: "offlineAfterSeconds" as const,
    label: "Délai hors ligne",
    unit: "s",
    icon: WifiOff,
    color: "text-status-offline",
    help: "Sans nouvelle pendant ce délai, l'antenne est déclarée hors ligne",
    min: 30,
    max: 86400,
  },
];

const STORAGE_LABEL: Record<string, string> = {
  blobs: "Netlify Blobs (persistant)",
  file: "Fichier local (.data/config.json)",
  memory: "Mémoire seule — non persistant",
  inconnu: "non déterminé",
};

export default function ThresholdSettings({ onChanged }: ThresholdSettingsProps) {
  const [values, setValues] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [storage, setStorage] = useState<string>("inconnu");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.thresholds) setValues(d.thresholds);
        if (d.storage) setStorage(d.storage);
      })
      .catch(() => setError("Impossible de charger les réglages"));
  }, []);

  async function save(next: Thresholds) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Enregistrement impossible");
        return;
      }
      setValues(data.thresholds);
      if (data.storage) setStorage(data.storage);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onChanged();
    } catch {
      setError("Impossible de joindre le serveur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="mb-1 text-sm font-semibold text-ink">Seuils d&apos;alerte</h3>
      <p className="mb-4 text-sm text-ink-muted">
        Réglez à partir de quand une antenne déclenche une alerte. Les changements
        s&apos;appliquent immédiatement à toutes les antennes.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => {
          const Icon = field.icon;
          return (
            <div key={field.key} className="rounded-lg bg-surface-overlay/40 p-3">
              <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-ink-muted">
                <Icon className={`h-3.5 w-3.5 ${field.color}`} />
                {field.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={values[field.key]}
                  min={field.min}
                  max={field.max}
                  onChange={(e) =>
                    setValues({ ...values, [field.key]: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-surface-overlay bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-accent/50"
                />
                <span className="shrink-0 text-xs text-ink-muted">{field.unit}</span>
              </div>
              <p className="mt-1 text-[11px] text-ink-subtle">{field.help}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => save(values)}
          disabled={saving}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
        >
          {saving ? "Enregistrement…" : "Enregistrer les seuils"}
        </button>
        <button
          onClick={() => save(DEFAULT_THRESHOLDS)}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs text-ink-muted hover:text-ink disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Valeurs par défaut
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-status-online">
            <Check className="h-3.5 w-3.5" />
            Enregistré
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-status-offline/10 px-3 py-2 text-xs text-status-offline">
          {error}
        </p>
      )}

      <p className="mt-4 flex items-center gap-2 border-t border-surface-overlay pt-3 text-[11px] text-ink-subtle">
        <Database className="h-3.5 w-3.5" />
        Sauvegarde : {STORAGE_LABEL[storage] ?? storage}
      </p>
    </div>
  );
}
