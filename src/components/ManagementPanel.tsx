"use client";

import { useState } from "react";
import type { Antenna, Site } from "@/lib/types";
import { statusColor, statusLabel } from "@/lib/utils";
import { useGeolocation } from "@/hooks/useGeolocation";
import {
  Antenna as AntennaIcon,
  Crosshair,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

interface ManagementPanelProps {
  sites: Site[];
  antennas: Antenna[];
  /** Rafraîchit le tableau de bord après une modification. */
  onChanged: () => void;
}

const ANTENNA_TYPES: Antenna["type"][] = ["LoRa", "4G", "WiFi", "Satellite"];

const inputClass =
  "w-full rounded-xl border border-surface-overlay bg-surface-raised px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-accent/50";
const labelClass = "mb-1.5 block text-xs font-medium text-slate-400";

interface SiteDraft {
  id?: string;
  name: string;
  address: string;
  description: string;
  lat: string;
  lng: string;
}

interface AntennaDraft {
  id?: string;
  siteId: string;
  name: string;
  type: Antenna["type"];
  lat: string;
  lng: string;
  firmware: string;
}

const emptySite: SiteDraft = { name: "", address: "", description: "", lat: "", lng: "" };

/** Sites d'exemple livrés avec l'application (données fictives, Lyon). */
const DEMO_SITE_IDS = ["site-1", "site-2", "site-3", "site-4", "site-5"];

export default function ManagementPanel({ sites, antennas, onChanged }: ManagementPanelProps) {
  const { position } = useGeolocation();

  const [siteDraft, setSiteDraft] = useState<SiteDraft | null>(null);
  const [antennaDraft, setAntennaDraft] = useState<AntennaDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDemo, setConfirmDemo] = useState(false);

  /** Appelle l'API et rafraîchit, en remontant les erreurs à l'utilisateur. */
  async function call(url: string, options: RequestInit): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Erreur ${res.status}`);
        return false;
      }
      onChanged();
      return true;
    } catch {
      setError("Impossible de joindre le serveur");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const useMyPosition = (setter: (lat: string, lng: string) => void) => {
    if (!position) {
      setError("Position non disponible — autorisez la géolocalisation");
      return;
    }
    setter(position.lat.toFixed(6), position.lng.toFixed(6));
  };

  /* ---------------- Sites ---------------- */

  async function saveSite() {
    if (!siteDraft) return;
    const payload = {
      name: siteDraft.name,
      address: siteDraft.address,
      description: siteDraft.description,
      lat: Number(siteDraft.lat),
      lng: Number(siteDraft.lng),
    };
    if (!payload.name.trim()) return setError("Le nom du site est obligatoire");
    if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng))
      return setError("Coordonnées invalides");

    const ok = siteDraft.id
      ? await call("/api/sites", {
          method: "PUT",
          body: JSON.stringify({ id: siteDraft.id, ...payload }),
        })
      : await call("/api/sites", { method: "POST", body: JSON.stringify(payload) });
    if (ok) setSiteDraft(null);
  }

  async function removeSite(id: string) {
    const ok = await call(`/api/sites?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (ok) setConfirmDelete(null);
  }

  /* ---------------- Antennes ---------------- */

  async function saveAntenna() {
    if (!antennaDraft) return;
    const payload = {
      siteId: antennaDraft.siteId,
      name: antennaDraft.name,
      type: antennaDraft.type,
      lat: Number(antennaDraft.lat),
      lng: Number(antennaDraft.lng),
      firmware: antennaDraft.firmware,
    };
    if (!payload.name.trim()) return setError("Le nom de l'antenne est obligatoire");
    if (!payload.siteId) return setError("Choisissez un site");
    if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng))
      return setError("Coordonnées invalides");

    const ok = antennaDraft.id
      ? await call("/api/antennas", {
          method: "PUT",
          body: JSON.stringify({ id: antennaDraft.id, ...payload }),
        })
      : await call("/api/antennas", { method: "POST", body: JSON.stringify(payload) });
    if (ok) setAntennaDraft(null);
  }

  async function removeAntenna(id: string) {
    const ok = await call(`/api/antennas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (ok) setConfirmDelete(null);
  }

  /** Supprime les 5 sites de démonstration livrés avec l'application. */
  async function removeDemoData() {
    setBusy(true);
    setError(null);
    let removed = 0;
    for (const site of sites.filter((s) => DEMO_SITE_IDS.includes(s.id))) {
      const res = await fetch(`/api/sites?id=${encodeURIComponent(site.id)}`, {
        method: "DELETE",
      });
      if (res.ok) removed++;
    }
    setBusy(false);
    setConfirmDemo(false);
    if (removed === 0) setError("Aucune donnée de démonstration à supprimer");
    onChanged();
  }

  const demoCount = sites.filter((s) => DEMO_SITE_IDS.includes(s.id)).length;

  return (
    <div className="max-w-4xl space-y-4">
      {demoCount > 0 && (
        <div className="glass rounded-xl border-l-4 border-status-warning p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">
                {demoCount} site(s) de démonstration
              </p>
              <p className="text-xs text-slate-400">
                Ces sites (Lyon) sont des exemples livrés avec l&apos;application : ce
                ne sont pas de vraies antennes. Supprimez-les pour ne garder que
                votre matériel.
              </p>
            </div>
            {confirmDemo ? (
              <div className="flex gap-2">
                <button
                  onClick={removeDemoData}
                  disabled={busy}
                  className="rounded-lg bg-status-offline px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  {busy ? "Suppression…" : "Confirmer"}
                </button>
                <button
                  onClick={() => setConfirmDemo(false)}
                  className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDemo(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-status-warning/15 px-3 py-2 text-xs font-medium text-status-warning hover:bg-status-warning/25"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer les exemples
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-xl bg-status-offline/10 px-4 py-3 text-sm text-status-offline">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* -------- Sites -------- */}
      <div className="glass rounded-xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold text-white">
              Sites <span className="text-slate-500">({sites.length})</span>
            </h3>
          </div>
          <button
            onClick={() =>
              setSiteDraft({
                ...emptySite,
                lat: position ? position.lat.toFixed(6) : "",
                lng: position ? position.lng.toFixed(6) : "",
              })
            }
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </div>

        {siteDraft && (
          <div className="mb-4 space-y-3 rounded-xl border border-accent/30 bg-surface-overlay/30 p-4">
            <p className="text-xs font-semibold text-accent">
              {siteDraft.id ? "Modifier le site" : "Nouveau site"}
            </p>
            <div>
              <label className={labelClass}>Nom *</label>
              <input
                className={inputClass}
                value={siteDraft.name}
                onChange={(e) => setSiteDraft({ ...siteDraft, name: e.target.value })}
                placeholder="Ex : Antenne toit bâtiment B"
              />
            </div>
            <div>
              <label className={labelClass}>Adresse</label>
              <input
                className={inputClass}
                value={siteDraft.address}
                onChange={(e) => setSiteDraft({ ...siteDraft, address: e.target.value })}
                placeholder="Ex : 12 rue des Capteurs, Abidjan"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Latitude *</label>
                <input
                  className={inputClass}
                  value={siteDraft.lat}
                  onChange={(e) => setSiteDraft({ ...siteDraft, lat: e.target.value })}
                  placeholder="5.359500"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className={labelClass}>Longitude *</label>
                <input
                  className={inputClass}
                  value={siteDraft.lng}
                  onChange={(e) => setSiteDraft({ ...siteDraft, lng: e.target.value })}
                  placeholder="-4.008300"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <input
                className={inputClass}
                value={siteDraft.description}
                onChange={(e) => setSiteDraft({ ...siteDraft, description: e.target.value })}
                placeholder="Ex : couverture parking et entrepôt"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  useMyPosition((lat, lng) => setSiteDraft({ ...siteDraft, lat, lng }))
                }
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-2 text-xs text-blue-400 hover:bg-blue-500/25"
              >
                <Crosshair className="h-3.5 w-3.5" />
                Utiliser ma position
              </button>
              <button
                onClick={saveSite}
                disabled={busy}
                className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-black hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                onClick={() => setSiteDraft(null)}
                className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        <ul className="space-y-2">
          {sites.map((site) => (
            <li
              key={site.id}
              className="flex items-center gap-3 rounded-lg bg-surface-overlay/40 p-3"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: statusColor(site.status) }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{site.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {site.address || "sans adresse"} ·{" "}
                  <span className="font-mono">
                    {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
                  </span>{" "}
                  · {antennas.filter((a) => a.siteId === site.id).length} antenne(s)
                </p>
              </div>
              <button
                onClick={() =>
                  setSiteDraft({
                    id: site.id,
                    name: site.name,
                    address: site.address,
                    description: site.description,
                    lat: String(site.lat),
                    lng: String(site.lng),
                  })
                }
                aria-label="Modifier"
                className="rounded-lg p-2 text-slate-400 hover:bg-surface-overlay hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {confirmDelete === site.id ? (
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => removeSite(site.id)}
                    disabled={busy}
                    className="rounded-lg bg-status-offline px-2 py-1 text-[11px] font-bold text-white"
                  >
                    Supprimer
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="rounded-lg px-2 py-1 text-[11px] text-slate-400"
                  >
                    Non
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(site.id)}
                  aria-label="Supprimer"
                  className="rounded-lg p-2 text-slate-400 hover:bg-status-offline/15 hover:text-status-offline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
          {sites.length === 0 && (
            <li className="rounded-lg bg-surface-overlay/30 p-4 text-center text-sm text-slate-400">
              Aucun site. Cliquez sur « Ajouter » pour créer le premier.
            </li>
          )}
        </ul>
        {confirmDelete && sites.some((s) => s.id === confirmDelete) && (
          <p className="mt-2 text-xs text-status-warning">
            Supprimer ce site supprimera aussi toutes ses antennes.
          </p>
        )}
      </div>

      {/* -------- Antennes -------- */}
      <div className="glass rounded-xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AntennaIcon className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold text-white">
              Antennes <span className="text-slate-500">({antennas.length})</span>
            </h3>
          </div>
          <button
            onClick={() =>
              setAntennaDraft({
                siteId: sites[0]?.id ?? "",
                name: "",
                type: "LoRa",
                lat: position ? position.lat.toFixed(6) : "",
                lng: position ? position.lng.toFixed(6) : "",
                firmware: "",
              })
            }
            disabled={sites.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </div>

        {sites.length === 0 && (
          <p className="mb-3 text-xs text-slate-500">Créez d&apos;abord un site.</p>
        )}

        {antennaDraft && (
          <div className="mb-4 space-y-3 rounded-xl border border-accent/30 bg-surface-overlay/30 p-4">
            <p className="text-xs font-semibold text-accent">
              {antennaDraft.id ? "Modifier l'antenne" : "Nouvelle antenne"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Nom *</label>
                <input
                  className={inputClass}
                  value={antennaDraft.name}
                  onChange={(e) => setAntennaDraft({ ...antennaDraft, name: e.target.value })}
                  placeholder="Ex : ANT-TOIT-01"
                />
              </div>
              <div>
                <label className={labelClass}>Site *</label>
                <select
                  className={inputClass}
                  value={antennaDraft.siteId}
                  onChange={(e) => setAntennaDraft({ ...antennaDraft, siteId: e.target.value })}
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Type</label>
                <select
                  className={inputClass}
                  value={antennaDraft.type}
                  onChange={(e) =>
                    setAntennaDraft({
                      ...antennaDraft,
                      type: e.target.value as Antenna["type"],
                    })
                  }
                >
                  {ANTENNA_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Firmware</label>
                <input
                  className={inputClass}
                  value={antennaDraft.firmware}
                  onChange={(e) =>
                    setAntennaDraft({ ...antennaDraft, firmware: e.target.value })
                  }
                  placeholder="v1.0.0"
                />
              </div>
              <div>
                <label className={labelClass}>Latitude *</label>
                <input
                  className={inputClass}
                  value={antennaDraft.lat}
                  onChange={(e) => setAntennaDraft({ ...antennaDraft, lat: e.target.value })}
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className={labelClass}>Longitude *</label>
                <input
                  className={inputClass}
                  value={antennaDraft.lng}
                  onChange={(e) => setAntennaDraft({ ...antennaDraft, lng: e.target.value })}
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  useMyPosition((lat, lng) => setAntennaDraft({ ...antennaDraft, lat, lng }))
                }
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-2 text-xs text-blue-400 hover:bg-blue-500/25"
              >
                <Crosshair className="h-3.5 w-3.5" />
                Utiliser ma position
              </button>
              <button
                onClick={saveAntenna}
                disabled={busy}
                className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-black hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                onClick={() => setAntennaDraft(null)}
                className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white"
              >
                Annuler
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              L&apos;identifiant sera généré automatiquement : reportez-le dans{" "}
              <span className="font-mono">ANTENNA_ID</span> du firmware Arduino.
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {antennas.map((antenna) => (
            <li
              key={antenna.id}
              className="flex items-center gap-3 rounded-lg bg-surface-overlay/40 p-3"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: statusColor(antenna.status) }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-medium text-white">
                  {antenna.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  <span className="font-mono text-accent">{antenna.id}</span> · {antenna.type} ·{" "}
                  {statusLabel(antenna.status)} ·{" "}
                  {sites.find((s) => s.id === antenna.siteId)?.name ?? "site inconnu"}
                </p>
              </div>
              <button
                onClick={() =>
                  setAntennaDraft({
                    id: antenna.id,
                    siteId: antenna.siteId,
                    name: antenna.name,
                    type: antenna.type,
                    lat: String(antenna.lat),
                    lng: String(antenna.lng),
                    firmware: antenna.firmware,
                  })
                }
                aria-label="Modifier"
                className="rounded-lg p-2 text-slate-400 hover:bg-surface-overlay hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {confirmDelete === antenna.id ? (
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => removeAntenna(antenna.id)}
                    disabled={busy}
                    className="rounded-lg bg-status-offline px-2 py-1 text-[11px] font-bold text-white"
                  >
                    Supprimer
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="rounded-lg px-2 py-1 text-[11px] text-slate-400"
                  >
                    Non
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(antenna.id)}
                  aria-label="Supprimer"
                  className="rounded-lg p-2 text-slate-400 hover:bg-status-offline/15 hover:text-status-offline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
          {antennas.length === 0 && (
            <li className="rounded-lg bg-surface-overlay/30 p-4 text-center text-sm text-slate-400">
              Aucune antenne enregistrée.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
