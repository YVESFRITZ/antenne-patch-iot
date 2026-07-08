# AntennePatch IoT — Guide complet

**Plateforme de supervision IoT avec localisation GPS et communication antennes en temps réel.**

---

## 1. Présentation

**AntennePatch IoT** est une application web professionnelle conçue pour superviser des sites IoT équipés d'antennes de communication. Elle permet de visualiser sur une carte la position des sites, le statut des antennes, la télémétrie en direct et les alertes automatiques.

### Public cible
- Techniciens terrain
- Administrateurs réseau IoT
- Responsables de sites industriels, logistiques ou campus

---

## 2. Atouts principaux

| Atout | Description |
|-------|-------------|
| **Carte interactive** | OpenStreetMap + Google Maps avec votre position GPS en temps réel |
| **Temps réel** | Données actualisées toutes les 5 secondes |
| **Multi-antennes** | Suivi simultané de plusieurs antennes (LoRa, 4G, WiFi, Satellite) |
| **Alertes intelligentes** | Détection automatique : hors ligne, batterie faible, signal faible, température |
| **Compatible Arduino** | Firmware ESP32 prêt à l'emploi |
| **API REST** | Vos antennes envoient des données via HTTP POST |
| **Interface moderne** | Design dark mode professionnel, responsive |
| **Géolocalisation** | GPS navigateur + secours par IP si GPS refusé |

---

## 3. Fonctionnalités détaillées

### 3.1 Tableau de bord
- Statistiques globales : sites, antennes, en ligne, alertes, signal moyen
- Carte avec marqueurs colorés selon le statut
- Panneau détail antenne au clic
- Alertes récentes avec acquittement

### 3.2 Carte des sites
- **Marqueur bleu** : votre position actuelle
- **Marqueurs colorés** : antennes (vert = en ligne, orange = alerte, rouge = hors ligne)
- Boutons **GPS** et changement de vue (OpenStreetMap / Google Maps)
- Coordonnées affichées en bas de carte

### 3.3 Gestion des antennes
- Liste complète avec recherche
- Signal, batterie, température, humidité, appareils connectés
- Graphique historique signal 24h

### 3.4 Centre d'alertes
- Alertes critiques, warnings et infos
- Acquittement en un clic
- Compteur dans la barre latérale

### 3.5 Paramètres & API
- Documentation connexion Arduino
- Endpoint API REST pour télémétrie

---

## 4. Comment utiliser l'application

### Accès en ligne
**URL :** https://antenne-patch-iot.netlify.app

### Accès local
```bash
npm install
npm run dev
```
Ouvrir http://localhost:3000

### Première utilisation
1. Ouvrez l'application dans Chrome ou Edge
2. **Autorisez la géolocalisation** quand le navigateur le demande
3. La carte se centre sur votre position
4. Cliquez sur une antenne pour voir ses détails
5. Utilisez la barre latérale pour naviguer entre les sections

### Navigation
| Onglet | Action |
|--------|--------|
| **Tableau de bord** | Vue d'ensemble + carte + alertes |
| **Carte des sites** | Carte plein écran |
| **Antennes** | Liste et recherche |
| **Alertes** | Toutes les alertes actives |
| **Paramètres** | API et Arduino |

---

## 5. Connecter une antenne Arduino (ESP32)

### Matériel
- ESP32 avec WiFi
- Optionnel : capteur DHT22, diviseur de tension pour batterie

### Configuration
1. Ouvrir `firmware/arduino/esp32_antenne_patch/` dans Arduino IDE
2. Éditer `config.h` :
```cpp
#define WIFI_SSID     "VotreWiFi"
#define WIFI_PASSWORD "motdepasse"
#define SERVER_HOST   "antenne-patch-iot.netlify.app"
#define ANTENNA_ID    "ant-1"
```
3. Installer la bibliothèque **ArduinoJson**
4. Flasher l'ESP32

### Données envoyées (JSON)
```json
{
  "antennaId": "ant-1",
  "signalStrength": 85,
  "temperature": 24.5,
  "humidity": 45,
  "battery": 92,
  "connectedDevices": 34
}
```

### Test manuel (curl)
```bash
curl -X POST https://antenne-patch-iot.netlify.app/api/telemetry \
  -H "Content-Type: application/json" \
  -d "{\"antennaId\":\"ant-1\",\"signalStrength\":90,\"temperature\":25,\"humidity\":50,\"battery\":88,\"connectedDevices\":20}"
```

---

## 6. Google Maps — Configuration clé API

### Clé API utilisée
```
AIzaSyB0zcm-6bLyktc7syhI8fWyFE_pMOfoSI0
```
*(Projet Google Cloud : ice-tech7)*

### Sur Netlify
Variable d'environnement configurée :
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyB0zcm-6bLyktc7syhI8fWyFE_pMOfoSI0
```

### Autoriser le domaine Netlify (obligatoire pour Google Maps)
1. [Google Cloud Console → Credentials](https://console.cloud.google.com/google/maps-apis/credentials)
2. Projet **ice-tech7** → clé API
3. **Restrictions HTTP** → ajouter :
   - `https://antenne-patch-iot.netlify.app/*`
   - `http://localhost:3000/*`
4. Activer **Maps JavaScript API**

> Si Google Maps ne s'affiche pas, utilisez **OpenStreetMap** (bouton en haut à droite de la carte) — fonctionne sans clé.

---

## 7. Déploiement Netlify

| Paramètre | Valeur |
|-----------|--------|
| Site | https://antenne-patch-iot.netlify.app |
| Admin | https://app.netlify.com/projects/antenne-patch-iot |
| GitHub | https://github.com/YVESFRITZ/antenne-patch-iot |
| Build | `npm run build` |
| Plugin | `@netlify/plugin-nextjs` |

### Redéployer
```bash
netlify deploy --prod
```

---

## 8. Architecture technique

```
[Antennes ESP32 / Arduino]
        ↓ HTTP POST
[API Next.js / Netlify Functions]
        ↓
[Store télémétrie + simulateur]
        ↓
[Dashboard React]
        ↓
[Carte OSM / Google Maps + graphiques]
```

### Stack
- **Frontend** : Next.js 15, React 19, Tailwind CSS
- **Carte** : OpenStreetMap, Google Maps (@vis.gl)
- **Graphiques** : Recharts
- **Backend** : API Routes Next.js
- **Hébergement** : Netlify

---

## 9. IDs antennes disponibles

| ID | Nom | Type |
|----|-----|------|
| ant-1 | ANT-NORD-01 | LoRa |
| ant-2 | ANT-NORD-02 | WiFi |
| ant-3 | ANT-SUD-01 | 4G |
| ant-4 | ANT-METEO-01 | LoRa |
| ant-5 | ANT-PORT-01 | Satellite |
| ant-6 | ANT-EDGE-01 | WiFi |

---

## 10. Dépannage

| Problème | Solution |
|----------|----------|
| Carte blanche | Ctrl+F5, autoriser géolocalisation, essayer OpenStreetMap |
| Google Maps gris | Autoriser domaine Netlify dans Google Cloud |
| GPS refusé | Cliquer **GPS** ou autoriser dans paramètres navigateur |
| Antenne hors ligne | Vérifier alimentation et connexion WiFi ESP32 |
| API 404 | Redéployer sur Netlify |

---

## 11. Contact & support

- **Projet** : AntennePatch IoT
- **GitHub** : https://github.com/YVESFRITZ/antenne-patch-iot
- **Site live** : https://antenne-patch-iot.netlify.app

---

*Document généré pour AntennePatch IoT — Supervision antennes & sites IoT*
