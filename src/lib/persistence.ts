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
/** Dossier utilisé en développement local (hors Netlify). */
const LOCAL_DIR = ".data";

type Backend = "blobs" | "file" | "memory";

let resolvedBackend: Backend | null = null;
/** Dernier recours : conserve les valeurs dans l'instance courante. */
const memoryFallback: Record<string, unknown> = {};

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

async function readLocalFile<T>(key: string): Promise<T | null> {
  try {
    const { readFile } = await import("fs/promises");
    const raw = await readFile(`${LOCAL_DIR}/${key}.json`, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeLocalFile<T>(key: string, value: T): Promise<boolean> {
  try {
    const { writeFile, mkdir } = await import("fs/promises");
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(`${LOCAL_DIR}/${key}.json`, JSON.stringify(value, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Lit une valeur JSON persistée.
 * Netlify Blobs en production, fichier local en développement.
 */
export async function readJson<T>(key: string): Promise<T | null> {
  const store = await getBlobStore();
  if (store) {
    try {
      const data = (await store.get(key, { type: "json" })) as T | null;
      resolvedBackend = "blobs";
      return data ?? null;
    } catch {
      // Lecture impossible : on tente les autres supports.
    }
  }

  const fromFile = await readLocalFile<T>(key);
  if (fromFile) {
    resolvedBackend = "file";
    return fromFile;
  }

  resolvedBackend = resolvedBackend ?? "memory";
  return (memoryFallback[key] as T) ?? null;
}

/** Écrit une valeur JSON persistée. Retourne le support réellement utilisé. */
export async function writeJson<T>(key: string, value: T): Promise<Backend> {
  memoryFallback[key] = value;

  const store = await getBlobStore();
  if (store) {
    try {
      await store.setJSON(key, value);
      resolvedBackend = "blobs";
      return "blobs";
    } catch {
      // On bascule sur le fichier local.
    }
  }

  if (await writeLocalFile(key, value)) {
    resolvedBackend = "file";
    return "file";
  }

  resolvedBackend = "memory";
  return "memory";
}

/** Charge la configuration sauvegardée, ou null si aucune. */
export function loadConfig(): Promise<StoredConfig | null> {
  return readJson<StoredConfig>(CONFIG_KEY);
}

/** Enregistre la configuration. */
export function saveConfig(config: StoredConfig): Promise<Backend> {
  return writeJson(CONFIG_KEY, config);
}

/** Support de sauvegarde utilisé, pour l'afficher dans les réglages. */
export function currentBackend(): Backend | "inconnu" {
  return resolvedBackend ?? "inconnu";
}
