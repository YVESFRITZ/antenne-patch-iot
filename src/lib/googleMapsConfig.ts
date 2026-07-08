export const GOOGLE_MAPS_CONFIG = {
  apiKey:
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    "AIzaSyB0zcm-6bLyktc7syhI8fWyFE_pMOfoSI0",
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
