import type { Antenna, Site, Thresholds } from "./types";

/** Contenu sauvegardé : la configuration de l'utilisateur, pas la télémétrie. */
export interface StoredConfig {
  version: number;
  sites: Site[];
  antennas: Antenna[];
  thresholds: Thresholds;
  updatedAt: string;
}

const STORE_NAME = "antennepatch";
const CONFIG_KEY = "config";
/** Fichier utilisé en développement local (hors Netlify). */
const LOCAL_FILE = ".data/config.json";

type Backend = "blobs" | "file" | "memory";

let resolvedBackend: Backend | null = null;
let memoryFallback: StoredConfig | null = null;

/** Store Netlify Blobs, ou null si l'on ne tourne pas sur Netlify. */
async function getBlobStore() {
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore({ name: STORE_NAME, consistency: "strong" });
  } catch {
    // Contexte Blobs indisponible (dev local, build, autre hébergeur).
    return null;
  }
}

async function readLocalFile(): Promise<StoredConfig | null> {
  try {
    const { readFile } = await import("fs/promises");
    const raw = await readFile(LOCAL_FILE, "utf8");
    return JSON.parse(raw) as StoredConfig;
  } catch {
    return null;
  }
}

async function writeLocalFile(config: StoredConfig): Promise<boolean> {
  try {
    const { writeFile, mkdir } = await import("fs/promises");
    const { dirname } = await import("path");
    await mkdir(dirname(LOCAL_FILE), { recursive: true });
    await writeFile(LOCAL_FILE, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

/** Charge la configuration sauvegardée, ou null si aucune. */
export async function loadConfig(): Promise<StoredConfig | null> {
  const store = await getBlobStore();
  if (store) {
    try {
      const data = (await store.get(CONFIG_KEY, { type: "json" })) as StoredConfig | null;
      resolvedBackend = "blobs";
      if (data) return data;
      return null;
    } catch {
      // Lecture impossible : on tente les autres supports.
    }
  }

  const fromFile = await readLocalFile();
  if (fromFile) {
    resolvedBackend = "file";
    return fromFile;
  }

  resolvedBackend = resolvedBackend ?? "memory";
  return memoryFallback;
}

/** Enregistre la configuration. Retourne le support réellement utilisé. */
export async function saveConfig(config: StoredConfig): Promise<Backend> {
  memoryFallback = config;

  const store = await getBlobStore();
  if (store) {
    try {
      await store.setJSON(CONFIG_KEY, config);
      resolvedBackend = "blobs";
      return "blobs";
    } catch {
      // On bascule sur le fichier local.
    }
  }

  if (await writeLocalFile(config)) {
    resolvedBackend = "file";
    return "file";
  }

  resolvedBackend = "memory";
  return "memory";
}

/** Support de sauvegarde utilisé, pour l'afficher dans les réglages. */
export function currentBackend(): Backend | "inconnu" {
  return resolvedBackend ?? "inconnu";
}
