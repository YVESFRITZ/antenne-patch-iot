"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type {
  Alert,
  Antenna,
  DashboardStats,
  ScanResult,
  Site,
  TelemetryPoint,
} from "@/lib/types";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import StatsCards from "./StatsCards";
import AntennaPanel from "./AntennaPanel";
import AlertsList from "./AlertsList";
import AntennaList from "./AntennaList";
import LinkCalculator from "./LinkCalculator";
import DevicePanel from "./DevicePanel";
import ManagementPanel from "./ManagementPanel";
import ThresholdSettings from "./ThresholdSettings";
import { Download, Radio, RefreshCw, Search } from "lucide-react";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border border-surface-overlay bg-surface-raised">
      <div className="flex items-center gap-2 text-ink-muted">
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
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [selectedAntennaId, setSelectedAntennaId] = useState<string | null>(null);
  const [linkTxId, setLinkTxId] = useState<string | null>(null);
  const [linkRxId, setLinkRxId] = useState<string | null>(null);
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
      setScans(data.scans ?? []);
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
    <div className="flex h-[100dvh] overflow-hidden bg-surface">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alertCount={activeAlertCount}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-surface-overlay bg-surface-raised px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-glow-lg lg:hidden">
              <Radio className="h-5 w-5" />
            </div>
            <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight text-ink sm:text-xl">
              {activeTab === "dashboard" && "Tableau de bord"}
              {activeTab === "map" && "Carte des sites IoT"}
              {activeTab === "antennas" && "Gestion des antennes"}
              {activeTab === "manage" && "Gérer sites et antennes"}
              {activeTab === "link" && "Liaison — distance émetteur / récepteur"}
              {activeTab === "device" && "Équipement connecté (USB)"}
              {activeTab === "alerts" && "Centre d'alertes"}
              {activeTab === "settings" && "Paramètres"}
            </h2>
            <p className="truncate text-xs text-ink-muted">
              Dernière mise à jour : {lastUpdate.toLocaleTimeString("fr-FR")}
            </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            aria-label="Actualiser"
            className="flex shrink-0 items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-xs font-medium text-accent-dim transition-colors hover:bg-accent hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 pb-24 grid-bg sm:p-6 lg:pb-6">
          {stats && <StatsCards stats={stats} />}

          {activeTab === "dashboard" && (
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="h-[320px] sm:h-[420px] lg:col-span-2 lg:h-[560px]">
                <MapView
                  sites={sites}
                  antennas={antennas}
                  selectedAntennaId={selectedAntennaId}
                  onSelectAntenna={setSelectedAntennaId}
                  linkTxId={linkTxId}
                  linkRxId={linkRxId}
                  scans={scans}
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
                    <p className="text-sm text-ink-muted">
                      Cliquez sur une antenne sur la carte pour voir ses détails
                    </p>
                  </div>
                )}
                <div className="glass rounded-xl p-4">
                  <h3 className="mb-3 text-sm font-semibold text-ink">
                    Alertes récentes
                  </h3>
                  <AlertsList alerts={alerts.slice(0, 3)} onAcknowledge={handleAcknowledge} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "map" && (
            <div className="mt-4 h-[calc(100dvh-260px)] min-h-[340px]">
              <MapView
                sites={sites}
                antennas={antennas}
                selectedAntennaId={selectedAntennaId}
                onSelectAntenna={setSelectedAntennaId}
                linkTxId={linkTxId}
                linkRxId={linkRxId}
                scans={scans}
              />
            </div>
          )}

          {activeTab === "antennas" && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input
                    type="text"
                    placeholder="Rechercher une antenne..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-surface-overlay bg-surface-raised py-2.5 pl-10 pr-4 text-sm text-ink placeholder-ink-subtle outline-none focus:border-accent/50"
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
                    <p className="text-sm text-ink-muted">
                      Sélectionnez une antenne pour voir les détails
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "link" && (
            <div className="mt-4">
              <LinkCalculator
                antennas={antennas}
                txId={linkTxId}
                rxId={linkRxId}
                onTxChange={setLinkTxId}
                onRxChange={setLinkRxId}
              />
            </div>
          )}

          {activeTab === "manage" && (
            <div className="mt-4">
              <ManagementPanel sites={sites} antennas={antennas} onChanged={fetchData} />
            </div>
          )}

          {activeTab === "device" && (
            <div className="mt-4">
              <DevicePanel antennas={antennas} />
            </div>
          )}

          {activeTab === "alerts" && (
            <div className="mt-4 max-w-3xl">
              <AlertsList alerts={alerts} onAcknowledge={handleAcknowledge} />
            </div>
          )}

          {activeTab === "settings" && (
            <div className="mt-4 max-w-2xl space-y-4">
              <ThresholdSettings onChanged={fetchData} />

              <div className="glass rounded-xl p-6">
                <h3 className="mb-2 text-sm font-semibold text-ink">
                  Historique et export
                </h3>
                <p className="mb-4 text-sm text-ink-muted">
                  Les mesures sont agrégées par heure et conservées 30 jours.
                  Téléchargez-les au format CSV pour vos rapports (ouvrable dans
                  Excel ou LibreOffice).
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["24h", "7d", "30d"] as const).map((r) => (
                    <a
                      key={r}
                      href={`/api/export?range=${r}`}
                      className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent hover:bg-accent/20"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {r === "24h" ? "24 heures" : r === "7d" ? "7 jours" : "30 jours"}
                    </a>
                  ))}
                </div>
              </div>
              <div className="glass rounded-xl p-6">
                <h3 className="mb-4 text-sm font-semibold text-ink">
                  Google Maps — Configuré
                </h3>
                <p className="mb-2 text-sm text-ink-muted">
                  Carte Google Maps active (projet <span className="font-mono text-accent">ice-tech7</span>).
                  Langue : FR · Région : France · Géolocalisation temps réel.
                </p>
                <p className="text-xs text-status-online">● Clé API chargée depuis .env.local</p>
              </div>
              <div className="glass rounded-xl p-6">
                <h3 className="mb-2 text-sm font-semibold text-ink">
                  Arduino — Connexion directe à l&apos;application
                </h3>
                <p className="mb-4 text-sm text-ink-muted">
                  Firmware dans <span className="font-mono text-accent">firmware/arduino/</span>.
                  Éditez <span className="font-mono">config.h</span> : votre WiFi et la clé API
                  suffisent, le module se connecte alors directement à cette application.
                </p>
                <pre className="overflow-x-auto rounded-lg bg-surface-overlay p-4 font-mono text-xs text-accent">
{`#define WIFI_SSID     "MonWiFi"
#define WIFI_PASSWORD "motdepasse"

#define USE_TLS
#define SERVER_HOST   "antenne-patch-iot.netlify.app"
#define SERVER_PORT   443

#define API_KEY       "votre_cle_api"
#define ANTENNA_ID    "ant-1"`}
                </pre>
                <p className="mt-3 text-xs text-ink-subtle">
                  La clé API est stockée côté serveur (variable{" "}
                  <span className="font-mono">ANTENNE_API_KEY</span>) et n&apos;est jamais
                  affichée ici. ESP32 pour l&apos;envoi WiFi/HTTPS, UNO + shield Ethernet
                  pour un serveur local. Voir firmware/arduino/README.md
                </p>
              </div>
              <div className="glass rounded-xl p-6">
                <h3 className="mb-2 text-sm font-semibold text-ink">
                  Module GPS — Position des antennes
                </h3>
                <p className="mb-4 text-sm text-ink-muted">
                  Branchez un module GPS (NEO-6M) sur l&apos;Arduino : sa position réelle
                  remplace automatiquement les coordonnées de l&apos;antenne sur la carte.
                </p>
                <pre className="overflow-x-auto rounded-lg bg-surface-overlay p-4 font-mono text-xs text-accent">
{`#define USE_GPS
#define GPS_RX_PIN 16   // ESP32 <- TX du GPS
#define GPS_TX_PIN 17   // ESP32 -> RX du GPS
#define GPS_BAUD   9600`}
                </pre>
                <p className="mt-3 text-xs text-ink-subtle">
                  Bibliothèque requise : TinyGPSPlus. Première acquisition en extérieur :
                  1 à 5 minutes.
                </p>
              </div>
              <div className="glass rounded-xl p-6">
                <h3 className="mb-4 text-sm font-semibold text-ink">
                  API REST — Envoi de télémétrie
                </h3>
                <pre className="overflow-x-auto rounded-lg bg-surface-overlay p-4 font-mono text-xs text-accent">
{`POST /api/telemetry
Content-Type: application/json
x-api-key: votre_cle_api

{
  "antennaId": "ant-1",
  "signalStrength": 85,
  "temperature": 24.5,
  "humidity": 45,
  "battery": 92,
  "connectedDevices": 34,
  "lat": 5.35995,
  "lng": -4.00826,
  "satellites": 9
}`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </main>

      <MobileNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alertCount={activeAlertCount}
      />
    </div>
  );
}
