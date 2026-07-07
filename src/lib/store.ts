import type {
  Alert,
  Antenna,
  AntennaPayload,
  AntennaStatus,
  DashboardStats,
  Site,
  TelemetryPoint,
} from "./types";

const now = () => new Date().toISOString();

const initialSites: Site[] = [
  {
    id: "site-1",
    name: "Campus Nord — Bâtiment A",
    address: "12 Rue des Capteurs, Lyon",
    lat: 45.764,
    lng: 4.8357,
    description: "Site principal — 3 antennes LoRa",
    status: "online",
  },
  {
    id: "site-2",
    name: "Entrepôt Logistique Sud",
    address: "Zone Industrielle, Vénissieux",
    lat: 45.6972,
    lng: 4.8853,
    description: "Couverture entrepôt et parking",
    status: "warning",
  },
  {
    id: "site-3",
    name: "Station Météo Montagne",
    address: "Col de la Croix-Rousse",
    lat: 45.774,
    lng: 4.822,
    description: "Capteurs environnementaux haute altitude",
    status: "online",
  },
  {
    id: "site-4",
    name: "Port Fluvial — Quai 7",
    address: "Quai Rambaud, Lyon",
    lat: 45.733,
    lng: 4.818,
    description: "Surveillance flotte et containers",
    status: "offline",
  },
  {
    id: "site-5",
    name: "Data Center Edge",
    address: "Parc Technologique, Écully",
    lat: 45.775,
    lng: 4.778,
    description: "Passerelle edge computing",
    status: "online",
  },
];

const initialAntennas: Antenna[] = [
  {
    id: "ant-1",
    siteId: "site-1",
    name: "ANT-NORD-01",
    type: "LoRa",
    lat: 45.7642,
    lng: 4.836,
    status: "online",
    signalStrength: 87,
    temperature: 24.5,
    humidity: 45,
    battery: 92,
    lastSeen: now(),
    firmware: "v2.4.1",
    connectedDevices: 34,
  },
  {
    id: "ant-2",
    siteId: "site-1",
    name: "ANT-NORD-02",
    type: "WiFi",
    lat: 45.7638,
    lng: 4.8352,
    status: "online",
    signalStrength: 72,
    temperature: 26.1,
    humidity: 42,
    battery: 100,
    lastSeen: now(),
    firmware: "v1.8.3",
    connectedDevices: 18,
  },
  {
    id: "ant-3",
    siteId: "site-2",
    name: "ANT-SUD-01",
    type: "4G",
    lat: 45.6975,
    lng: 4.8858,
    status: "warning",
    signalStrength: 45,
    temperature: 31.2,
    humidity: 58,
    battery: 28,
    lastSeen: now(),
    firmware: "v3.1.0",
    connectedDevices: 12,
  },
  {
    id: "ant-4",
    siteId: "site-3",
    name: "ANT-METEO-01",
    type: "LoRa",
    lat: 45.7742,
    lng: 4.8215,
    status: "online",
    signalStrength: 91,
    temperature: 12.8,
    humidity: 72,
    battery: 78,
    lastSeen: now(),
    firmware: "v2.4.1",
    connectedDevices: 8,
  },
  {
    id: "ant-5",
    siteId: "site-4",
    name: "ANT-PORT-01",
    type: "Satellite",
    lat: 45.7328,
    lng: 4.8175,
    status: "offline",
    signalStrength: 0,
    temperature: 0,
    humidity: 0,
    battery: 5,
    lastSeen: new Date(Date.now() - 3600000).toISOString(),
    firmware: "v2.0.0",
    connectedDevices: 0,
  },
  {
    id: "ant-6",
    siteId: "site-5",
    name: "ANT-EDGE-01",
    type: "WiFi",
    lat: 45.7752,
    lng: 4.7785,
    status: "online",
    signalStrength: 95,
    temperature: 22.0,
    humidity: 38,
    battery: 100,
    lastSeen: now(),
    firmware: "v4.0.2",
    connectedDevices: 56,
  },
];

function computeStatus(antenna: Antenna): AntennaStatus {
  const lastSeenMs = Date.now() - new Date(antenna.lastSeen).getTime();
  if (lastSeenMs > 300000) return "offline";
  if (antenna.battery < 20 || antenna.signalStrength < 40) return "warning";
  if (antenna.signalStrength === 0) return "offline";
  return "online";
}

function updateSiteStatuses(sites: Site[], antennas: Antenna[]): Site[] {
  return sites.map((site) => {
    const siteAntennas = antennas.filter((a) => a.siteId === site.id);
    if (siteAntennas.length === 0) return { ...site, status: "idle" as AntennaStatus };
    if (siteAntennas.every((a) => a.status === "offline")) return { ...site, status: "offline" };
    if (siteAntennas.some((a) => a.status === "warning" || a.status === "offline"))
      return { ...site, status: "warning" };
    return { ...site, status: "online" };
  });
}

function generateAlerts(antennas: Antenna[], sites: Site[]): Alert[] {
  const alerts: Alert[] = [];
  for (const antenna of antennas) {
    const site = sites.find((s) => s.id === antenna.siteId);
    if (antenna.status === "offline") {
      alerts.push({
        id: `alert-offline-${antenna.id}`,
        antennaId: antenna.id,
        antennaName: antenna.name,
        siteName: site?.name ?? "Inconnu",
        type: "offline",
        severity: "critical",
        message: `${antenna.name} hors ligne depuis plus de 5 minutes`,
        timestamp: antenna.lastSeen,
        acknowledged: false,
      });
    }
    if (antenna.battery < 20 && antenna.status !== "offline") {
      alerts.push({
        id: `alert-battery-${antenna.id}`,
        antennaId: antenna.id,
        antennaName: antenna.name,
        siteName: site?.name ?? "Inconnu",
        type: "low_battery",
        severity: "warning",
        message: `Batterie faible : ${antenna.battery}%`,
        timestamp: now(),
        acknowledged: false,
      });
    }
    if (antenna.temperature > 30 && antenna.status !== "offline") {
      alerts.push({
        id: `alert-temp-${antenna.id}`,
        antennaId: antenna.id,
        antennaName: antenna.name,
        siteName: site?.name ?? "Inconnu",
        type: "high_temp",
        severity: "warning",
        message: `Température élevée : ${antenna.temperature.toFixed(1)}°C`,
        timestamp: now(),
        acknowledged: false,
      });
    }
    if (antenna.signalStrength < 40 && antenna.signalStrength > 0) {
      alerts.push({
        id: `alert-signal-${antenna.id}`,
        antennaId: antenna.id,
        antennaName: antenna.name,
        siteName: site?.name ?? "Inconnu",
        type: "weak_signal",
        severity: "info",
        message: `Signal faible : ${antenna.signalStrength}%`,
        timestamp: now(),
        acknowledged: false,
      });
    }
  }
  return alerts;
}

class IoTStore {
  sites: Site[] = [...initialSites];
  antennas: Antenna[] = [...initialAntennas];
  telemetryHistory: Map<string, TelemetryPoint[]> = new Map();
  acknowledgedAlerts: Set<string> = new Set();

  constructor() {
    for (const antenna of this.antennas) {
      this.telemetryHistory.set(antenna.id, this.generateHistory(antenna));
    }
    this.startSimulation();
  }

  private generateHistory(antenna: Antenna): TelemetryPoint[] {
    const points: TelemetryPoint[] = [];
    for (let i = 23; i >= 0; i--) {
      const t = new Date(Date.now() - i * 3600000);
      points.push({
        timestamp: t.toISOString(),
        signalStrength: Math.max(
          0,
          antenna.signalStrength + (Math.random() - 0.5) * 15
        ),
        temperature: antenna.temperature + (Math.random() - 0.5) * 3,
        humidity: antenna.humidity + (Math.random() - 0.5) * 8,
        battery: Math.min(100, antenna.battery + (Math.random() - 0.5) * 2),
      });
    }
    return points;
  }

  private startSimulation() {
    setInterval(() => {
      this.antennas = this.antennas.map((antenna) => {
        if (antenna.status === "offline") return antenna;
        const updated: Antenna = {
          ...antenna,
          signalStrength: Math.round(
            Math.min(100, Math.max(0, antenna.signalStrength + (Math.random() - 0.5) * 6))
          ),
          temperature: Math.round((antenna.temperature + (Math.random() - 0.5) * 0.8) * 10) / 10,
          humidity: Math.round(
            Math.min(100, Math.max(0, antenna.humidity + (Math.random() - 0.5) * 3))
          ),
          battery: Math.max(0, antenna.battery - (Math.random() > 0.9 ? 0.1 : 0)),
          connectedDevices: Math.max(
            0,
            antenna.connectedDevices + Math.floor((Math.random() - 0.5) * 3)
          ),
          lastSeen: now(),
        };
        updated.status = computeStatus(updated);

        const history = this.telemetryHistory.get(antenna.id) ?? [];
        history.push({
          timestamp: now(),
          signalStrength: updated.signalStrength,
          temperature: updated.temperature,
          humidity: updated.humidity,
          battery: updated.battery,
        });
        if (history.length > 48) history.shift();
        this.telemetryHistory.set(antenna.id, history);

        return updated;
      });
      this.sites = updateSiteStatuses(this.sites, this.antennas);
    }, 5000);
  }

  getSites(): Site[] {
    return this.sites;
  }

  getAntennas(): Antenna[] {
    return this.antennas.map((a) => ({ ...a, status: computeStatus(a) }));
  }

  getAntenna(id: string): Antenna | undefined {
    return this.getAntennas().find((a) => a.id === id);
  }

  getAntennasBySite(siteId: string): Antenna[] {
    return this.getAntennas().filter((a) => a.siteId === siteId);
  }

  getTelemetry(antennaId: string): TelemetryPoint[] {
    return this.telemetryHistory.get(antennaId) ?? [];
  }

  getAlerts(): Alert[] {
    const alerts = generateAlerts(this.getAntennas(), this.sites);
    return alerts.map((a) => ({
      ...a,
      acknowledged: this.acknowledgedAlerts.has(a.id),
    }));
  }

  acknowledgeAlert(alertId: string): void {
    this.acknowledgedAlerts.add(alertId);
  }

  getStats(): DashboardStats {
    const antennas = this.getAntennas();
    const online = antennas.filter((a) => a.status === "online").length;
    const warning = antennas.filter((a) => a.status === "warning").length;
    const offline = antennas.filter((a) => a.status === "offline").length;
    const activeAntennas = antennas.filter((a) => a.status !== "offline");
    const avgSignal =
      activeAntennas.length > 0
        ? Math.round(
            activeAntennas.reduce((sum, a) => sum + a.signalStrength, 0) / activeAntennas.length
          )
        : 0;

    return {
      totalSites: this.sites.length,
      totalAntennas: antennas.length,
      onlineAntennas: online,
      warningAntennas: warning,
      offlineAntennas: offline,
      activeAlerts: this.getAlerts().filter((a) => !a.acknowledged).length,
      avgSignalStrength: avgSignal,
    };
  }

  receiveAntennaPayload(payload: AntennaPayload): Antenna | null {
    const index = this.antennas.findIndex((a) => a.id === payload.antennaId);
    if (index === -1) return null;

    const current = this.antennas[index];
    const updated: Antenna = {
      ...current,
      signalStrength: payload.signalStrength ?? current.signalStrength,
      temperature: payload.temperature ?? current.temperature,
      humidity: payload.humidity ?? current.humidity,
      battery: payload.battery ?? current.battery,
      connectedDevices: payload.connectedDevices ?? current.connectedDevices,
      lastSeen: now(),
      status: payload.status ?? computeStatus({ ...current, lastSeen: now() }),
    };
    updated.status = computeStatus(updated);
    this.antennas[index] = updated;

    const history = this.telemetryHistory.get(updated.id) ?? [];
    history.push({
      timestamp: now(),
      signalStrength: updated.signalStrength,
      temperature: updated.temperature,
      humidity: updated.humidity,
      battery: updated.battery,
    });
    if (history.length > 48) history.shift();
    this.telemetryHistory.set(updated.id, history);

    this.sites = updateSiteStatuses(this.sites, this.antennas);
    return updated;
  }
}

const globalForStore = globalThis as unknown as { iotStore?: IoTStore };

export const store = globalForStore.iotStore ?? new IoTStore();
if (process.env.NODE_ENV !== "production") globalForStore.iotStore = store;
