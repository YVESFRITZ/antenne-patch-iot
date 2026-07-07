"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { Alert, Antenna, DashboardStats, Site, TelemetryPoint } from "@/lib/types";
import Sidebar from "./Sidebar";
import StatsCards from "./StatsCards";
import AntennaPanel from "./AntennaPanel";
import AlertsList from "./AlertsList";
import AntennaList from "./AntennaList";
import { RefreshCw, Search } from "lucide-react";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border border-surface-overlay bg-surface-raised">
      <div className="flex items-center gap-2 text-slate-400">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Chargement Google Maps...
      </div>
    </div>
  ),
});

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sites, setSites] = useState<Site[]>([]);
  const [antennas, setAntennas] = useState<Antenna[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAntennaId, setSelectedAntennaId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [search, setSearch] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      setSites(data.sites);
      setAntennas(data.antennas);
      setStats(data.stats);
      setAlerts(data.alerts);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Erreur chargement dashboard:", err);
    }
  }, []);

  const fetchTelemetry = useCallback(async (antennaId: string) => {
    try {
      const res = await fetch(`/api/telemetry?antennaId=${antennaId}`);
      const data = await res.json();
      setTelemetry(data);
    } catch (err) {
      console.error("Erreur chargement télémétrie:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (selectedAntennaId) {
      fetchTelemetry(selectedAntennaId);
      const interval = setInterval(() => fetchTelemetry(selectedAntennaId), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedAntennaId, fetchTelemetry]);

  const handleAcknowledge = async (alertId: string) => {
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId }),
    });
    fetchData();
  };

  const selectedAntenna = antennas.find((a) => a.id === selectedAntennaId) ?? null;

  const filteredAntennas = antennas.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.type.toLowerCase().includes(search.toLowerCase())
  );

  const activeAlertCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0e14]">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alertCount={activeAlertCount}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-surface-overlay bg-surface-raised/50 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              {activeTab === "dashboard" && "Tableau de bord"}
              {activeTab === "map" && "Carte des sites IoT"}
              {activeTab === "antennas" && "Gestion des antennes"}
              {activeTab === "alerts" && "Centre d'alertes"}
              {activeTab === "settings" && "Paramètres"}
            </h2>
            <p className="text-xs text-slate-400">
              Dernière mise à jour : {lastUpdate.toLocaleTimeString("fr-FR")}
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent transition-colors hover:bg-accent/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 grid-bg">
          {stats && <StatsCards stats={stats} />}

          {activeTab === "dashboard" && (
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 h-[500px]">
                <MapView
                  sites={sites}
                  antennas={antennas}
                  selectedAntennaId={selectedAntennaId}
                  onSelectAntenna={setSelectedAntennaId}
                />
              </div>
              <div className="space-y-4">
                {selectedAntenna ? (
                  <AntennaPanel
                    antenna={selectedAntenna}
                    telemetry={telemetry}
                    onClose={() => setSelectedAntennaId(null)}
                  />
                ) : (
                  <div className="glass rounded-xl p-6 text-center">
                    <p className="text-sm text-slate-400">
                      Cliquez sur une antenne sur la carte pour voir ses détails
                    </p>
                  </div>
                )}
                <div className="glass rounded-xl p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">
                    Alertes récentes
                  </h3>
                  <AlertsList alerts={alerts.slice(0, 3)} onAcknowledge={handleAcknowledge} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "map" && (
            <div className="mt-4 h-[500px]">
              <MapView
                sites={sites}
                antennas={antennas}
                selectedAntennaId={selectedAntennaId}
                onSelectAntenna={setSelectedAntennaId}
              />
            </div>
          )}

          {activeTab === "antennas" && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher une antenne..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-surface-overlay bg-surface-raised py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-accent/50"
                  />
                </div>
                <AntennaList
                  antennas={filteredAntennas}
                  selectedId={selectedAntennaId}
                  onSelect={setSelectedAntennaId}
                />
              </div>
              <div>
                {selectedAntenna ? (
                  <AntennaPanel
                    antenna={selectedAntenna}
                    telemetry={telemetry}
                    onClose={() => setSelectedAntennaId(null)}
                  />
                ) : (
                  <div className="glass flex h-64 items-center justify-center rounded-xl">
                    <p className="text-sm text-slate-400">
                      Sélectionnez une antenne pour voir les détails
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "alerts" && (
            <div className="mt-4 max-w-3xl">
              <AlertsList alerts={alerts} onAcknowledge={handleAcknowledge} />
            </div>
          )}

          {activeTab === "settings" && (
            <div className="mt-4 max-w-2xl space-y-4">
              <div className="glass rounded-xl p-6">
                <h3 className="mb-4 text-sm font-semibold text-white">
                  Google Maps — Configuré
                </h3>
                <p className="mb-2 text-sm text-slate-400">
                  Carte Google Maps active (projet <span className="font-mono text-accent">ice-tech7</span>).
                  Langue : FR · Région : France · Géolocalisation temps réel.
                </p>
                <p className="text-xs text-status-online">● Clé API chargée depuis .env.local</p>
              </div>
              <div className="glass rounded-xl p-6">
                <h3 className="mb-2 text-sm font-semibold text-white">
                  Arduino — Connexion antenne
                </h3>
                <p className="mb-4 text-sm text-slate-400">
                  Firmware dans <span className="font-mono text-accent">firmware/arduino/</span>.
                  Éditez <span className="font-mono">config.h</span> avec votre WiFi et l&apos;IP de ce PC.
                </p>
                <pre className="overflow-x-auto rounded-lg bg-surface-overlay p-4 font-mono text-xs text-accent">
{`#define WIFI_SSID     "MonWiFi"
#define WIFI_PASSWORD "motdepasse"
#define SERVER_HOST   "192.168.1.111"
#define ANTENNA_ID    "ant-1"`}
                </pre>
                <p className="mt-3 text-xs text-slate-500">
                  ESP32 (WiFi) ou Arduino UNO + shield Ethernet. Voir firmware/arduino/README.md
                </p>
              </div>
              <div className="glass rounded-xl p-6">
                <h3 className="mb-4 text-sm font-semibold text-white">
                  API REST — Envoi de télémétrie
                </h3>
                <pre className="overflow-x-auto rounded-lg bg-surface-overlay p-4 font-mono text-xs text-accent">
{`POST /api/telemetry
Content-Type: application/json

{
  "antennaId": "ant-1",
  "signalStrength": 85,
  "temperature": 24.5,
  "humidity": 45,
  "battery": 92,
  "connectedDevices": 34
}`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
