# AntennePatch IoT

Plateforme de supervision IoT avec **localisation géographique** et **communication antennes** en temps réel.

## Fonctionnalités

- Carte interactive **Google Maps** avec votre position GPS en temps réel
- Tableau de bord temps réel (signal, température, humidité, batterie)
- Alertes automatiques (hors ligne, batterie faible, signal faible, température)
- API REST pour recevoir les données des antennes
- Simulateur de télémétrie intégré (données live toutes les 5s)
- Interface moderne dark mode

## Google Maps

1. Créez une clé API sur [Google Cloud Console](https://console.cloud.google.com/google/maps-apis)
2. Activez **Maps JavaScript API**
3. Copiez `.env.local.example` vers `.env.local` et ajoutez votre clé :

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=votre_cle
```

4. Relancez `npm run dev` — la carte se centre automatiquement sur **votre position actuelle**

## Démarrage

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## Arduino

Firmware prêt dans `firmware/arduino/` :

| Carte | Dossier |
|-------|---------|
| **ESP32** (WiFi, recommandé) | `esp32_antenne_patch/` |
| Arduino UNO + Ethernet | `uno_ethernet_antenne_patch/` |

1. Éditer `config.h` (WiFi, IP du PC, `ANTENNA_ID`)
2. Installer la bibliothèque **ArduinoJson** dans l'IDE Arduino
3. Flasher l'ESP32 → les données apparaissent sur le dashboard

Guide complet : [firmware/arduino/README.md](firmware/arduino/README.md)

## API Antenne

Envoyer des données depuis une antenne (ESP32, gateway LoRa, etc.) :

```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "antennaId": "ant-1",
    "signalStrength": 85,
    "temperature": 24.5,
    "humidity": 45,
    "battery": 92,
    "connectedDevices": 34
  }'
```

## Architecture

```
[Antennes / Capteurs] → HTTP POST / MQTT Bridge
         ↓
[API Next.js] → Store en mémoire (→ PostgreSQL en prod)
         ↓
[Dashboard React] ← Polling 5s ← Carte Leaflet
```

## Prochaines étapes

- [ ] Broker MQTT (Mosquitto) pour communication bidirectionnelle
- [ ] Base PostgreSQL + TimescaleDB pour historique
- [ ] Authentification (admin / opérateur)
- [ ] Notifications push / email
- [ ] Support multilingue (FR/EN)
