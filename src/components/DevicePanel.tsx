"use client";

import { useEffect, useState } from "react";
import type { Antenna } from "@/lib/types";
import { useSerialDevice } from "@/hooks/useSerialDevice";
import {
  AlertTriangle,
  Cable,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  MapPin,
  Plug,
  PlugZap,
  Satellite,
  Trash2,
} from "lucide-react";

interface DevicePanelProps {
  antennas: Antenna[];
}

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];
const KEY_STORAGE = "antennepatch.apiKey";

const kindStyle: Record<string, string> = {
  json: "text-accent",
  nmea: "text-blue-400",
  text: "text-slate-500",
};

export default function DevicePanel({ antennas }: DevicePanelProps) {
  const [baudRate, setBaudRate] = useState(115200);
  const [antennaId, setAntennaId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [forward, setForward] = useState(true);
  const [keyRequired, setKeyRequired] = useState(false);

  const {
    supported,
    connected,
    connecting,
    error,
    log,
    lastPayload,
    framesReceived,
    framesSent,
    connect,
    disconnect,
    clearLog,
  } = useSerialDevice({ fallbackAntennaId: antennaId || undefined, apiKey, forward });

  // Clé mémorisée localement (jamais envoyée ailleurs que vers cette application).
  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved) setApiKey(saved);
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setKeyRequired(!!d.apiKeyRequired))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!antennaId && antennas.length > 0) setAntennaId(antennas[0].id);
  }, [antennas, antennaId]);

  const saveKey = (value: string) => {
    setApiKey(value);
    localStorage.setItem(KEY_STORAGE, value);
  };

  const hasFix =
    typeof lastPayload?.lat === "number" && typeof lastPayload?.lng === "number";

  return (
    <div className="max-w-4xl space-y-4">
      {/* Connexion */}
      <div className="glass rounded-xl p-5">
        <div className="mb-1 flex items-center gap-2">
          <Cable className="h-5 w-5 text-accent" />
          <h3 className="text-sm font-semibold text-white">
            Équipement connecté en USB
          </h3>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          Branchez la carte Arduino / ESP32 sur le port USB de cet ordinateur, puis
          connectez-la à l&apos;application. Les mesures et la position du module GPS
          remontent automatiquement.
        </p>

        {!supported && (
          <div className="mb-4 flex gap-2 rounded-lg bg-status-warning/10 p-3 text-xs text-status-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              La connexion USB nécessite <strong>Chrome</strong> ou <strong>Edge</strong> sur
              ordinateur. Elle n&apos;est pas disponible sur mobile, Firefox ni Safari.
              Sur ces navigateurs, utilisez l&apos;envoi WiFi du firmware.
            </span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Antenne associée
            </label>
            <select
              value={antennaId}
              onChange={(e) => setAntennaId(e.target.value)}
              className="w-full rounded-xl border border-surface-overlay bg-surface-raised px-3 py-2.5 text-sm text-white outline-none focus:border-accent/50"
            >
              {antennas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Vitesse du port (bauds)
            </label>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              disabled={connected}
              className="w-full rounded-xl border border-surface-overlay bg-surface-raised px-3 py-2.5 text-sm text-white outline-none focus:border-accent/50 disabled:opacity-50"
            >
              {BAUD_RATES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        {keyRequired && (
          <div className="mt-3">
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-400">
              <KeyRound className="h-3.5 w-3.5 text-accent" />
              Clé API (exigée par l&apos;application)
            </label>
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => saveKey(e.target.value)}
                placeholder="apk_…"
                autoComplete="off"
                className="w-full rounded-xl border border-surface-overlay bg-surface-raised px-3 py-2.5 font-mono text-sm text-white placeholder-slate-500 outline-none focus:border-accent/50"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Masquer la clé" : "Afficher la clé"}
                className="shrink-0 rounded-xl border border-surface-overlay px-3 text-slate-400 hover:text-white"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Conservée uniquement dans ce navigateur.
            </p>
          </div>
        )}

        <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={forward}
            onChange={(e) => setForward(e.target.checked)}
            className="h-4 w-4 accent-[#00d4aa]"
          />
          Transmettre les mesures reçues à l&apos;application
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {connected ? (
            <button
              onClick={() => disconnect()}
              className="flex items-center gap-2 rounded-xl bg-status-offline/15 px-4 py-2.5 text-sm font-medium text-status-offline transition-colors hover:bg-status-offline/25"
            >
              <Plug className="h-4 w-4" />
              Déconnecter
            </button>
          ) : (
            <button
              onClick={() => connect(baudRate)}
              disabled={!supported || connecting}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <PlugZap className="h-4 w-4" />
              {connecting ? "Connexion…" : "Connecter l'équipement USB"}
            </button>
          )}

          <span
            className={`flex items-center gap-1.5 text-xs ${
              connected ? "text-status-online" : "text-slate-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? "bg-status-online" : "bg-slate-600"
              }`}
            />
            {connected ? "Connecté" : "Non connecté"}
          </span>

          {connected && (
            <span className="text-xs text-slate-500">
              {framesReceived} trames reçues · {framesSent} transmises
            </span>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-status-offline/10 px-3 py-2 text-xs text-status-offline">
            {error}
          </p>
        )}
      </div>

      {/* Dernières mesures décodées */}
      {lastPayload && (
        <div className="glass rounded-xl p-5">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-status-online" />
            <h3 className="text-sm font-semibold text-white">Dernières mesures décodées</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {hasFix && (
              <div className="col-span-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Satellite className="h-3.5 w-3.5 text-accent" />
                  Position GPS du module
                </div>
                <p className="mt-1 font-mono text-sm font-bold text-accent">
                  {lastPayload.lat!.toFixed(5)}, {lastPayload.lng!.toFixed(5)}
                </p>
                {typeof lastPayload.satellites === "number" && (
                  <p className="text-[11px] text-slate-500">
                    {lastPayload.satellites} satellites
                  </p>
                )}
              </div>
            )}
            {[
              { label: "Signal", value: lastPayload.signalStrength, unit: "%" },
              { label: "Température", value: lastPayload.temperature, unit: "°C" },
              { label: "Humidité", value: lastPayload.humidity, unit: "%" },
              { label: "Batterie", value: lastPayload.battery, unit: "%" },
              { label: "Appareils", value: lastPayload.connectedDevices, unit: "" },
            ]
              .filter((m) => typeof m.value === "number")
              .map((m) => (
                <div key={m.label} className="rounded-lg bg-surface-overlay/40 p-3">
                  <p className="text-xs text-slate-400">{m.label}</p>
                  <p className="mt-0.5 text-lg font-bold text-white">
                    {typeof m.value === "number" ? Math.round(m.value * 10) / 10 : "—"}
                    <span className="ml-0.5 text-xs font-normal text-slate-400">{m.unit}</span>
                  </p>
                </div>
              ))}
          </div>

          {!hasFix && (
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              Aucune position GPS reçue pour l&apos;instant — le module a besoin d&apos;une
              vue dégagée du ciel (première acquisition : 1 à 5 minutes).
            </p>
          )}
        </div>
      )}

      {/* Journal série */}
      <div className="glass rounded-xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Journal du port série</h3>
          {log.length > 0 && (
            <button
              onClick={clearLog}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Vider
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto rounded-lg bg-surface-overlay/40 p-3">
          {log.length === 0 ? (
            <p className="text-xs text-slate-500">
              Aucune donnée reçue. Connectez l&apos;équipement pour voir les trames.
            </p>
          ) : (
            <ul className="space-y-1">
              {log.map((entry) => (
                <li key={entry.id} className="flex gap-2 font-mono text-[11px]">
                  <span className="shrink-0 text-slate-600">
                    {new Date(entry.at).toLocaleTimeString("fr-FR")}
                  </span>
                  <span className={`break-all ${kindStyle[entry.kind]}`}>{entry.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Formats reconnus : JSON du firmware et trames NMEA du module GPS (GGA / RMC).
        </p>
      </div>
    </div>
  );
}
