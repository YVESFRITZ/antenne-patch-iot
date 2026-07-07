import type { Antenna, Site } from "./types";

// Centre de référence des données démo (Lyon)
const DEMO_REF = { lat: 45.75, lng: 4.83 };

export function shiftSitesToUser(
  sites: Site[],
  antennas: Antenna[],
  userLat: number,
  userLng: number
): { sites: Site[]; antennas: Antenna[] } {
  const dLat = userLat - DEMO_REF.lat;
  const dLng = userLng - DEMO_REF.lng;

  const shiftedSites = sites.map((site) => ({
    ...site,
    lat: site.lat + dLat,
    lng: site.lng + dLng,
  }));

  const shiftedAntennas = antennas.map((antenna) => ({
    ...antenna,
    lat: antenna.lat + dLat,
    lng: antenna.lng + dLng,
  }));

  return { sites: shiftedSites, antennas: shiftedAntennas };
}
