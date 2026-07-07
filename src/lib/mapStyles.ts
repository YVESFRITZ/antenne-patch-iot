export const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0f1419" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f1419" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b9cb3" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#00d4aa" }],
  },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2332" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#243044" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a2332" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1a2332" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0e14" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
];

export const DEFAULT_CENTER = { lat: 48.8566, lng: 2.3522 };
