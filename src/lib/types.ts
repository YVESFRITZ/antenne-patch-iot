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
