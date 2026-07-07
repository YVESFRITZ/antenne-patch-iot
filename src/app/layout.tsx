import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AntennePatch IoT — Supervision des sites",
  description:
    "Plateforme de gestion IoT avec localisation et communication antennes en temps réel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
