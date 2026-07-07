"use client";

import { GOOGLE_MAPS_CONFIG } from "@/lib/googleMapsConfig";

interface GoogleMapsEmbedProps {
  lat: number;
  lng: number;
  zoom?: number;
}

export default function GoogleMapsEmbed({ lat, lng, zoom = 15 }: GoogleMapsEmbedProps) {
  const apiKey = GOOGLE_MAPS_CONFIG.apiKey;
  const src = `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${lat},${lng}&zoom=${zoom}&maptype=roadmap`;

  return (
    <iframe
      title="Google Maps"
      src={src}
      width="100%"
      height="100%"
      style={{ border: 0, minHeight: 500, display: "block" }}
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
