import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { authorizeDevice } from "@/lib/apiAuth";
import type { DetectedNetwork } from "@/lib/types";

/** Derniers balayages radio des modules. */
export async function GET(request: NextRequest) {
  await store.ensureLoaded();

  const antennaId = request.nextUrl.searchParams.get("antennaId");
  if (antennaId) {
    const scan = store.getScan(antennaId);
    if (!scan) {
      return NextResponse.json({ error: "Aucun balayage récent" }, { status: 404 });
    }
    return NextResponse.json(scan);
  }
  return NextResponse.json({ scans: store.getScans() });
}

/** Valide et normalise les réseaux transmis par un module. */
function readNetworks(raw: unknown): DetectedNetwork[] {
  if (!Array.isArray(raw)) return [];

  const networks: DetectedNetwork[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const n = item as Record<string, unknown>;
    const rssi = typeof n.rssi === "number" ? n.rssi : Number(n.rssi);
    // Un RSSI plausible est négatif : au-delà, la mesure est erronée.
    if (!Number.isFinite(rssi) || rssi > 0 || rssi < -120) continue;

    networks.push({
      ssid:
        typeof n.ssid === "string" && n.ssid.trim().length > 0
          ? n.ssid.slice(0, 64)
          : "(réseau masqué)",
      bssid: typeof n.bssid === "string" ? n.bssid.slice(0, 32) : undefined,
      rssi,
      channel: typeof n.channel === "number" ? n.channel : undefined,
      encryption: typeof n.enc === "string" ? n.enc.slice(0, 24) : undefined,
    });
  }
  // Limite de sécurité : un module ne devrait pas remonter des centaines
  // de réseaux, et cela protège la mémoire du serveur.
  return networks.slice(0, 60);
}

export async function POST(request: NextRequest) {
  const auth = authorizeDevice(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  await store.ensureLoaded();

  try {
    const body = (await request.json()) as { antennaId?: string; networks?: unknown };
    if (!body.antennaId) {
      return NextResponse.json({ error: "antennaId requis" }, { status: 400 });
    }

    const networks = readNetworks(body.networks);
    if (networks.length === 0) {
      return NextResponse.json({ error: "Aucun réseau valide transmis" }, { status: 400 });
    }

    const scan = store.recordScan(body.antennaId, networks);
    if (!scan) {
      return NextResponse.json({ error: "Antenne introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `${scan.networks.length} antenne(s) captée(s) enregistrée(s)`,
      scan,
    });
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
  }
}
