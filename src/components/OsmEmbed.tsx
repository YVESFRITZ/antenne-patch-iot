"use client";

interface OsmEmbedProps {
  lat: number;
  lng: number;
  zoom?: number;
}

export default function OsmEmbed({ lat, lng, zoom = 14 }: OsmEmbedProps) {
  const delta = 0.02;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`;

  return (
    <iframe
      title="Carte OpenStreetMap"
      src={src}
      width="100%"
      height="100%"
      style={{ border: 0, minHeight: 500, display: "block", background: "#1a2332" }}
      loading="lazy"
    />
  );
}
