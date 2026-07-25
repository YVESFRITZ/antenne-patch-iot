export type AntennaStatus = "online" | "warning" | "offline" | "idle";

export interface Site {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
  status: AntennaStatus;
}

export interface Antenna {
  id: string;
  siteId: string;
  name: string;
  type: "LoRa" | "4G" | "WiFi" | "Satellite";
  lat: number;
  lng: number;
  status: AntennaStatus;
  signalStrength: number;
  temperature: number;
  humidity: number;
  battery: number;
  lastSeen: string;
  firmware: string;
  connectedDevices: number;
}

export interface TelemetryPoint {
  timestamp: string;
  signalStrength: number;
  temperature: number;
  humidity: number;
  battery: number;
}

export interface Alert {
  id: string;
  antennaId: string;
  antennaName: string;
  siteName: string;
  type: "offline" | "low_battery" | "high_temp" | "weak_signal";
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

/** Seuils déclenchant les alertes, réglables depuis l'interface. */
export interface Thresholds {
  /** Batterie basse (%) — en dessous, alerte. */
  lowBattery: number;
  /** Température élevée (°C) — au-dessus, alerte. */
  highTemperature: number;
  /** Signal faible (%) — en dessous, alerte. */
  weakSignal: number;
  /** Délai sans nouvelle (secondes) avant de déclarer l'antenne hors ligne. */
  offlineAfterSeconds: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  lowBattery: 20,
  highTemperature: 30,
  weakSignal: 40,
  offlineAfterSeconds: 300,
};

/** Champs modifiables d'un site depuis l'interface. */
export interface SiteInput {
  name: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
}

/** Champs modifiables d'une antenne depuis l'interface. */
export interface AntennaInput {
  siteId: string;
  name: string;
  type: Antenna["type"];
  lat: number;
  lng: number;
  firmware?: string;
}

export interface DashboardStats {
  totalSites: number;
  totalAntennas: number;
  onlineAntennas: number;
  warningAntennas: number;
  offlineAntennas: number;
  activeAlerts: number;
  avgSignalStrength: number;
}

export interface AntennaPayload {
  antennaId: string;
  signalStrength?: number;
  temperature?: number;
  humidity?: number;
  battery?: number;
  connectedDevices?: number;
  status?: AntennaStatus;
  /** Position GPS du module (module NEO-6M / u-blox connecté à l'Arduino). */
  lat?: number;
  lng?: number;
  /** Nombre de satellites captés, si le module GPS le fournit. */
  satellites?: number;
}
