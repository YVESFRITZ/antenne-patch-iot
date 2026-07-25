import type {
  Alert,
  Antenna,
  AntennaInput,
  AntennaPayload,
  AntennaStatus,
  DashboardStats,
  DetectedNetwork,
  ScanResult,
  Site,
  SiteInput,
  TelemetryPoint,
  Thresholds,
} from "./types";
import { DEFAULT_THRESHOLDS } from "./types";
import { loadConfig, saveConfig, type StoredConfig } from "./persistence";
import {
  addSample,
  filterRange,
  loadHistory,
  saveHistory,
  type HistoryRange,
  type HistoryStore,
  type HourlyBucket,
} from "./history";

const now = () => new Date().toISOString();

/**
 * Durée pendant laquelle la configuration en mémoire est considérée à jour.
 * Passé ce délai, la prochaine requête revérifie la sauvegarde partagée.
 */
const CONFIG_CACHE_MS = 2000;

/**
 * Intervalle minimal entre deux écritures de l'historique. Les modules
 * émettent toutes les 10 s : sans cette limite, on écrirait le stockage
 * bien plus souvent que nécessaire pour des agrégats horaires.
 */
const HISTORY_WRITE_MS = 60_000;

/** Ramène une valeur dans un intervalle, en ignorant les entrées invalides. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

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

function computeStatus(antenna: Antenna, thresholds: Thresholds): AntennaStatus {
  const lastSeenMs = Date.now() - new Date(antenna.lastSeen).getTime();
  if (lastSeenMs > thresholds.offlineAfterSeconds * 1000) return "offline";
  if (antenna.battery < thresholds.lowBattery || antenna.signalStrength < thresholds.weakSignal)
    return "warning";
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

function generateAlerts(antennas: Antenna[], sites: Site[], thresholds: Thresholds): Alert[] {
  const alerts: Alert[] = [];
  const offlineMinutes = Math.round(thresholds.offlineAfterSeconds / 60);
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
        message:
          offlineMinutes >= 1
            ? `${antenna.name} hors ligne depuis plus de ${offlineMinutes} min`
            : `${antenna.name} hors ligne`,
        timestamp: antenna.lastSeen,
        acknowledged: false,
      });
    }
    if (antenna.battery < thresholds.lowBattery && antenna.status !== "offline") {
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
    if (antenna.temperature > thresholds.highTemperature && antenna.status !== "offline") {
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
    if (antenna.signalStrength < thresholds.weakSignal && antenna.signalStrength > 0) {
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
  thresholds: Thresholds = { ...DEFAULT_THRESHOLDS };
  telemetryHistory: Map<string, TelemetryPoint[]> = new Map();
  acknowledgedAlerts: Set<string> = new Set();

  /** Empêche plusieurs chargements simultanés de la configuration. */
  private loading: Promise<void> | null = null;
  private loaded = false;
  /** Horodatage de la dernière config appliquée, pour ne rien réappliquer inutilement. */
  private configStamp: string | null = null;
  /** Dernière vérification du support de sauvegarde. */
  private lastCheckAt = 0;

  /**
   * Dernier balayage radio de chaque module. Données vivantes, non
   * persistées : elles n'ont d'intérêt que récentes.
   */
  private scans: Map<string, ScanResult> = new Map();

  /** Agrégats horaires par antenne, conservés 30 jours. */
  private history: HistoryStore = {};
  private historyLoaded = false;
  private historyLoading: Promise<void> | null = null;
  private historyDirty = false;
  private lastHistoryWrite = 0;

  constructor() {
    for (const antenna of this.antennas) {
      this.telemetryHistory.set(antenna.id, this.generateHistory(antenna));
    }
    this.startSimulation();
  }

  /**
   * Synchronise la configuration avec la sauvegarde partagée.
   *
   * Sur un hébergement sans serveur, plusieurs instances tournent en
   * parallèle : une instance qui aurait chargé la configuration une seule
   * fois servirait indéfiniment des données périmées. On revérifie donc
   * régulièrement, et on ne réapplique la configuration que si elle a
   * réellement changé (comparaison de l'horodatage).
   *
   * @param force relit immédiatement, sans attendre l'expiration du cache
   *              (utilisé avant toute modification, pour ne pas écraser
   *              les changements faits par une autre instance).
   */
  async ensureLoaded(force = false): Promise<void> {
    const fresh = Date.now() - this.lastCheckAt < CONFIG_CACHE_MS;
    if (!force && this.loaded && fresh) return;

    // Une lecture déjà en cours : on attend son résultat plutôt que d'en lancer une autre.
    if (this.loading) {
      await this.loading;
      return;
    }

    this.loading = (async () => {
      const saved = await loadConfig();
      this.lastCheckAt = Date.now();
      this.loaded = true;
      if (saved && saved.updatedAt !== this.configStamp) {
        this.configStamp = saved.updatedAt;
        this.applyConfig(saved);
      }
    })();

    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  /**
   * Applique une configuration sauvegardée en préservant la télémétrie
   * en cours : seuls les champs de configuration sont repris, les mesures
   * vivantes (signal, température, batterie…) restent celles reçues des
   * modules.
   */
  private applyConfig(saved: StoredConfig): void {
    if (saved.thresholds) {
      this.thresholds = { ...DEFAULT_THRESHOLDS, ...saved.thresholds };
    }
    if (saved.sites?.length) {
      this.sites = saved.sites;
    }
    if (saved.antennas) {
      const live = new Map(this.antennas.map((a) => [a.id, a]));
      this.antennas = saved.antennas.map((config) => {
        const current = live.get(config.id);
        if (!current) return config;
        return {
          ...current,
          siteId: config.siteId,
          name: config.name,
          type: config.type,
          firmware: config.firmware,
          lat: config.lat,
          lng: config.lng,
        };
      });
      for (const antenna of this.antennas) {
        if (!this.telemetryHistory.has(antenna.id)) {
          this.telemetryHistory.set(antenna.id, this.generateHistory(antenna));
        }
      }
    }
  }

  /** Sauvegarde la configuration courante. */
  private async persist(): Promise<void> {
    const config: StoredConfig = {
      version: 1,
      sites: this.sites,
      antennas: this.antennas,
      thresholds: this.thresholds,
      updatedAt: now(),
    };
    // On retient l'horodatage écrit : inutile de réappliquer notre propre
    // sauvegarde à la prochaine vérification.
    this.configStamp = config.updatedAt;
    this.lastCheckAt = Date.now();
    await saveConfig(config);
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
        updated.status = computeStatus(updated, this.thresholds);

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
    return this.antennas.map((a) => ({ ...a, status: computeStatus(a, this.thresholds) }));
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
    const alerts = generateAlerts(this.getAntennas(), this.sites, this.thresholds);
    return alerts.map((a) => ({
      ...a,
      acknowledged: this.acknowledgedAlerts.has(a.id),
    }));
  }

  acknowledgeAlert(alertId: string): void {
    this.acknowledgedAlerts.add(alertId);
  }

  /* ---------------- Balayages radio ---------------- */

  /** Enregistre les antennes captées par un module. */
  recordScan(antennaId: string, networks: DetectedNetwork[]): ScanResult | null {
    if (!this.antennas.some((a) => a.id === antennaId)) return null;

    const result: ScanResult = {
      antennaId,
      at: now(),
      // Du signal le plus fort au plus faible, pour un affichage direct.
      networks: [...networks].sort((a, b) => b.rssi - a.rssi),
    };
    this.scans.set(antennaId, result);
    return result;
  }

  /** Dernier balayage d'un module, s'il est encore récent. */
  getScan(antennaId: string): ScanResult | null {
    const scan = this.scans.get(antennaId);
    if (!scan) return null;
    // Au-delà d'une heure, l'information n'est plus représentative.
    if (Date.now() - new Date(scan.at).getTime() > 3600_000) return null;
    return scan;
  }

  /** Derniers balayages de tous les modules. */
  getScans(): ScanResult[] {
    return this.antennas
      .map((a) => this.getScan(a.id))
      .filter((s): s is ScanResult => s !== null);
  }

  /* ---------------- Historique long terme ---------------- */

  /** Charge l'historique agrégé (une fois par instance). */
  async ensureHistoryLoaded(): Promise<void> {
    if (this.historyLoaded) return;
    if (this.historyLoading) {
      await this.historyLoading;
      return;
    }
    this.historyLoading = (async () => {
      this.history = await loadHistory();
      this.historyLoaded = true;
    })();
    try {
      await this.historyLoading;
    } finally {
      this.historyLoading = null;
    }
  }

  /** Intègre une mesure dans l'historique agrégé, puis écrit si nécessaire. */
  private async recordHistory(antennaId: string, point: TelemetryPoint): Promise<void> {
    await this.ensureHistoryLoaded();
    this.history[antennaId] = addSample(this.history[antennaId] ?? [], point);
    this.historyDirty = true;

    // Écriture limitée : les agrégats horaires n'ont pas besoin d'être
    // sauvegardés à chaque mesure reçue.
    if (Date.now() - this.lastHistoryWrite < HISTORY_WRITE_MS) return;
    this.lastHistoryWrite = Date.now();
    this.historyDirty = false;
    try {
      await saveHistory(this.history);
    } catch {
      // Une écriture ratée sera retentée à la mesure suivante.
      this.historyDirty = true;
    }
  }

  /** Historique agrégé d'une antenne sur la période demandée. */
  async getHistory(antennaId: string, range: HistoryRange): Promise<HourlyBucket[]> {
    await this.ensureHistoryLoaded();
    return filterRange(this.history[antennaId] ?? [], range);
  }

  /** Historique agrégé de toutes les antennes sur la période demandée. */
  async getAllHistory(range: HistoryRange): Promise<HistoryStore> {
    await this.ensureHistoryLoaded();
    const result: HistoryStore = {};
    for (const [id, buckets] of Object.entries(this.history)) {
      result[id] = filterRange(buckets, range);
    }
    return result;
  }

  /* ---------------- Seuils d'alerte ---------------- */

  getThresholds(): Thresholds {
    return this.thresholds;
  }

  async updateThresholds(patch: Partial<Thresholds>): Promise<Thresholds> {
    await this.ensureLoaded(true);
    const merged = { ...this.thresholds, ...patch };
    // Bornes de sécurité : des valeurs absurdes rendraient les alertes inutiles.
    this.thresholds = {
      lowBattery: clamp(merged.lowBattery, 0, 100),
      highTemperature: clamp(merged.highTemperature, -50, 150),
      weakSignal: clamp(merged.weakSignal, 0, 100),
      offlineAfterSeconds: clamp(merged.offlineAfterSeconds, 30, 86400),
    };
    await this.persist();
    return this.thresholds;
  }

  /* ---------------- Gestion des sites ---------------- */

  async addSite(input: SiteInput): Promise<Site> {
    // Repartir de la configuration la plus récente : une autre instance
    // a pu créer ou modifier des éléments entre-temps.
    await this.ensureLoaded(true);
    const site: Site = {
      id: `site-${Date.now().toString(36)}`,
      name: input.name,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      description: input.description,
      status: "idle",
    };
    this.sites = [...this.sites, site];
    await this.persist();
    return site;
  }

  async updateSite(id: string, patch: Partial<SiteInput>): Promise<Site | null> {
    await this.ensureLoaded(true);
    const index = this.sites.findIndex((s) => s.id === id);
    if (index === -1) return null;
    this.sites[index] = { ...this.sites[index], ...patch };
    await this.persist();
    return this.sites[index];
  }

  /** Supprime un site et toutes ses antennes. */
  async deleteSite(id: string): Promise<boolean> {
    await this.ensureLoaded(true);
    const before = this.sites.length;
    this.sites = this.sites.filter((s) => s.id !== id);
    if (this.sites.length === before) return false;

    for (const antenna of this.antennas.filter((a) => a.siteId === id)) {
      this.telemetryHistory.delete(antenna.id);
    }
    this.antennas = this.antennas.filter((a) => a.siteId !== id);
    await this.persist();
    return true;
  }

  /* ---------------- Gestion des antennes ---------------- */

  async addAntenna(input: AntennaInput): Promise<Antenna | null> {
    await this.ensureLoaded(true);
    if (!this.sites.some((s) => s.id === input.siteId)) return null;

    const antenna: Antenna = {
      id: `ant-${Date.now().toString(36)}`,
      siteId: input.siteId,
      name: input.name,
      type: input.type,
      lat: input.lat,
      lng: input.lng,
      status: "idle",
      signalStrength: 0,
      temperature: 0,
      humidity: 0,
      battery: 100,
      lastSeen: now(),
      firmware: input.firmware ?? "—",
      connectedDevices: 0,
    };
    this.antennas = [...this.antennas, antenna];
    this.telemetryHistory.set(antenna.id, []);
    this.sites = updateSiteStatuses(this.sites, this.antennas);
    await this.persist();
    return antenna;
  }

  async updateAntenna(id: string, patch: Partial<AntennaInput>): Promise<Antenna | null> {
    await this.ensureLoaded(true);
    const index = this.antennas.findIndex((a) => a.id === id);
    if (index === -1) return null;
    if (patch.siteId && !this.sites.some((s) => s.id === patch.siteId)) return null;

    this.antennas[index] = { ...this.antennas[index], ...patch };
    this.sites = updateSiteStatuses(this.sites, this.antennas);
    await this.persist();
    return this.antennas[index];
  }

  async deleteAntenna(id: string): Promise<boolean> {
    await this.ensureLoaded(true);
    const before = this.antennas.length;
    this.antennas = this.antennas.filter((a) => a.id !== id);
    if (this.antennas.length === before) return false;

    this.telemetryHistory.delete(id);
    this.sites = updateSiteStatuses(this.sites, this.antennas);
    await this.persist();
    return true;
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

  async receiveAntennaPayload(payload: AntennaPayload): Promise<Antenna | null> {
    const index = this.antennas.findIndex((a) => a.id === payload.antennaId);
    if (index === -1) return null;

    const current = this.antennas[index];
    // Position GPS du module : appliquée uniquement si les coordonnées sont
    // valides, pour ne pas déplacer l'antenne sur un point aberrant (0,0).
    const hasFix =
      typeof payload.lat === "number" &&
      typeof payload.lng === "number" &&
      Number.isFinite(payload.lat) &&
      Number.isFinite(payload.lng) &&
      Math.abs(payload.lat) <= 90 &&
      Math.abs(payload.lng) <= 180 &&
      !(payload.lat === 0 && payload.lng === 0);

    const updated: Antenna = {
      ...current,
      lat: hasFix ? (payload.lat as number) : current.lat,
      lng: hasFix ? (payload.lng as number) : current.lng,
      signalStrength: payload.signalStrength ?? current.signalStrength,
      temperature: payload.temperature ?? current.temperature,
      humidity: payload.humidity ?? current.humidity,
      battery: payload.battery ?? current.battery,
      connectedDevices: payload.connectedDevices ?? current.connectedDevices,
      lastSeen: now(),
      status: payload.status ?? computeStatus({ ...current, lastSeen: now() }, this.thresholds),
    };
    updated.status = computeStatus(updated, this.thresholds);
    this.antennas[index] = updated;

    const point: TelemetryPoint = {
      timestamp: now(),
      signalStrength: updated.signalStrength,
      temperature: updated.temperature,
      humidity: updated.humidity,
      battery: updated.battery,
    };

    const history = this.telemetryHistory.get(updated.id) ?? [];
    history.push(point);
    if (history.length > 48) history.shift();
    this.telemetryHistory.set(updated.id, history);

    // Historique long terme (agrégats horaires conservés 30 jours).
    await this.recordHistory(updated.id, point);

    this.sites = updateSiteStatuses(this.sites, this.antennas);
    return updated;
  }
}

const globalForStore = globalThis as unknown as { iotStore?: IoTStore };

export const store = globalForStore.iotStore ?? new IoTStore();
if (process.env.NODE_ENV !== "production") globalForStore.iotStore = store;
