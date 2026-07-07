export const GOOGLE_MAPS_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  scriptId: "antenne-patch-google-maps",
  language: "fr",
  region: "FR",
  version: "weekly" as const,
  libraries: [] as const,
};

export const MAP_DEFAULTS = {
  zoom: 15,
  zoomWithMarkers: 14,
  minHeight: 450,
};
