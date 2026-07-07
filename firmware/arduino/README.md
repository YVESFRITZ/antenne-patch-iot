# Firmware Arduino — AntennePatch IoT

Guide pour connecter vos antennes Arduino à l'application web.

## Matériel supporté

| Carte | Connexion | Sketch |
|-------|-----------|--------|
| **ESP32** (recommandé) | WiFi | `esp32_antenne_patch/` |
| Arduino UNO + Shield Ethernet | Câble RJ45 | `uno_ethernet_antenne_patch/` |

> **ESP8266** : même principe que ESP32, remplacer `WiFi.h` par `ESP8266WiFi.h`.

## Installation (ESP32)

### 1. Arduino IDE

1. Installer [Arduino IDE 2.x](https://www.arduino.cc/en/software)
2. **Fichier → Préférences → URL cartes** : ajouter
   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
3. **Outils → Type de carte → ESP32 Arduino → ESP32 Dev Module**

### 2. Bibliothèques

Via **Croquis → Inclure une bibliothèque → Gérer les bibliothèques** :

- `ArduinoJson` (v7.x)
- `DHT sensor library` (optionnel, capteur DHT22)

### 3. Configuration

Éditer `config.h` dans le dossier du sketch :

```cpp
#define WIFI_SSID     "MonReseauWiFi"
#define WIFI_PASSWORD "monMotDePasse"
#define SERVER_HOST   "192.168.1.111"   // IP de votre PC (ipconfig)
#define SERVER_PORT   3000
#define ANTENNA_ID    "ant-1"           // ID dans l'application
```

### 4. Flasher

1. Ouvrir `esp32_antenne_patch/esp32_antenne_patch.ino`
2. Brancher l'ESP32 en USB
3. **Téléverser**
4. Ouvrir le **Moniteur série** (115200 baud)

### 5. Vérifier

- L'app doit tourner : `npm run dev`
- Ouvrir http://localhost:3000
- L'antenne `ANT-NORD-01` (ant-1) se met à jour toutes les 10 secondes

## Schéma de câblage (ESP32 + DHT22)

```
ESP32          DHT22
─────          ─────
3.3V    ────   VCC
GND     ────   GND
GPIO 4  ────   DATA

Batterie (diviseur 2 résistances 10kΩ) :
  LiPo(+) ──[10k]── A0 ──[10k]── GND
```

## Payload JSON envoyé

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

## IDs antennes disponibles dans l'app

| ID | Nom | Site |
|----|-----|------|
| ant-1 | ANT-NORD-01 | Campus Nord |
| ant-2 | ANT-NORD-02 | Campus Nord |
| ant-3 | ANT-SUD-01 | Entrepôt Sud |
| ant-4 | ANT-METEO-01 | Station Météo |
| ant-5 | ANT-PORT-01 | Port Fluvial |
| ant-6 | ANT-EDGE-01 | Data Center |

## Dépannage

| Problème | Solution |
|----------|----------|
| HTTP -1 / timeout | Vérifier IP PC, pare-feu Windows, app lancée |
| HTTP 404 | `ANTENNA_ID` incorrect dans config.h |
| WiFi échoue | SSID/mot de passe, portée du signal |
| Données non visibles | Actualiser le dashboard (5s auto) |

## Test sans Arduino (curl)

```bash
curl -X POST http://192.168.1.111:3000/api/telemetry ^
  -H "Content-Type: application/json" ^
  -d "{\"antennaId\":\"ant-1\",\"signalStrength\":90,\"temperature\":25,\"humidity\":50,\"battery\":88,\"connectedDevices\":20}"
```
