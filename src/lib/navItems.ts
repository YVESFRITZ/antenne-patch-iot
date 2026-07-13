import {
  Antenna,
  Bell,
  LayoutDashboard,
  Map,
  Ruler,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  id: string;
  /** Libellé complet (sidebar bureau). */
  label: string;
  /** Libellé court (barre mobile). */
  short: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { id: "dashboard", label: "Tableau de bord", short: "Accueil", icon: LayoutDashboard },
  { id: "map", label: "Carte des sites", short: "Carte", icon: Map },
  { id: "antennas", label: "Antennes", short: "Antennes", icon: Antenna },
  { id: "link", label: "Liaison / Distance", short: "Liaison", icon: Ruler },
  { id: "alerts", label: "Alertes", short: "Alertes", icon: Bell },
  { id: "settings", label: "Paramètres", short: "Réglages", icon: Settings },
];
