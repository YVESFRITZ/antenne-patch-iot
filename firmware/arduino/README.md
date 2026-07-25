# Firmware Arduino — AntennePatch IoT

Guide pour connecter vos antennes Arduino à l'application web.

## Matériel supporté

| Carte | Connexion | Sketch |
|-------|-----------|--------|
| **ESP32** (recommandé) | WiFi + USB | `esp32_antenne_patch/` |
| Arduino UNO + Shield Ethernet | RJ45 + USB | `uno_ethernet_antenne_patch/` |

> **ESP8266** : même principe que ESP32, remplacer `WiFi.h` par `ESP8266WiFi.h`.

## Deux façons de connecter le module

| Mode | Principe | Prérequis |
|------|----------|-----------|
| **WiFi (à distance)** | Le module envoie lui-même vers l'application en ligne | ESP32 + clé API |
| **USB (local)** | Le module est branché sur le PC, le navigateur lit le port série | Chrome ou Edge sur ordinateur |

Les deux modes peuvent fonctionner en même temps.

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

- `ArduinoJson` (v7.x) — obligatoire
- `TinyGPSPlus` — si module GPS
- `DHT sensor library` — si capteur DHT22

### 3. Configuration

Éditer `config.h` dans le dossier du sketch :

```cpp
#define WIFI_SSID     "MonReseauWiFi"
#define WIFI_PASSWORD "monMotDePasse"

// Application en ligne (HTTPS)
#define USE_TLS
#define SERVER_HOST   "antenne-patch-iot.netlify.app"
#define SERVER_PORT   443

#define API_KEY       "apk_..."         // clé fournie par l'application
#define ANTENNA_ID    "ant-1"           // ID dans l'application
```

Pour viser un serveur local (`npm run dev`), commenter `USE_TLS` et mettre
l'IP du PC dans `SERVER_HOST` avec le port `3000`.

> **La clé API est obligatoire** dès qu'elle est configurée côté serveur
> (variable d'environnement `ANTENNE_API_KEY`). Sans elle, l'API répond `401`.
> Ne publiez jamais un `config.h` contenant votre clé.

### 4. Flasher

1. Ouvrir `esp32_antenne_patch/esp32_antenne_patch.ino`
2. Brancher l'ESP32 en USB
3. **Téléverser**
4. Ouvrir le **Moniteur série** (115200 baud)

### 5. Vérifier

- **En ligne** : ouvrir https://antenne-patch-iot.netlify.app — l'antenne
  `ant-1` se met à jour toutes les 10 secondes.
- **En USB** : onglet **Équipement USB** → *Connecter l'équipement USB*,
  choisir le port de la carte. Fermer le Moniteur série d'Arduino IDE avant
  (un seul logiciel à la fois peut ouvrir le port).

## Module GPS (NEO-6M / u-blox)

La position réelle du module remplace automatiquement les coordonnées de
l'antenne sur la carte.

### Câblage ESP32

```
ESP32           GPS NEO-6M
─────           ──────────
3.3V     ────   VCC
GND      ────   GND
GPIO 16  ────   TX          (ESP32 reçoit)
GPIO 17  ────   RX          (ESP32 émet)
```

### Câblage Arduino UNO

Le shield Ethernet occupe les broches 4 et 10–13 :

```
UNO             GPS NEO-6M
─────           ──────────
5V       ────   VCC
GND      ────   GND
Broche 5 ────   TX
Broche 6 ────   RX
```

### Configuration

```cpp
#define USE_GPS
#define GPS_RX_PIN 16   // ESP32 <- TX du GPS
#define GPS_TX_PIN 17   // ESP32 -> RX du GPS
#define GPS_BAUD   9600
```

> Première acquisition (cold start) : **1 à 5 minutes en extérieur**, avec vue
> dégagée du ciel. La LED du module clignote une fois le point fixé. Tant que
> la position n'est pas valide, aucune coordonnée n'est envoyée (l'antenne
> garde sa position précédente).

## Balayage radio — antennes réellement captées

L'ESP32 scanne les points d'accès WiFi environnants et remonte **ceux
qu'il capte vraiment**, avec la puissance mesurée sur place. Ces réseaux
s'affichent dans l'onglet **Équipement USB** de l'application.

À distinguer des antennes affichées sur la carte : celles-ci viennent
d'OpenStreetMap (base cartographique), alors que le balayage détecte des
émetteurs physiquement présents autour du module.

```cpp
#define USE_WIFI_SCAN
#define SCAN_INTERVAL_MS  60000   // un balayage par minute
#define SCAN_MAX_NETWORKS 15      // réseaux transmis, du plus fort au plus faible
```

Trame émise sur le port USB :

```json
{"type":"scan","antennaId":"ant-1","networks":[
  {"ssid":"MonWiFi","bssid":"aa:bb:cc:dd:ee:01","rssi":-45,"channel":6,"enc":"WPA2"}
]}
```

`rssi` est la puissance reçue en dBm : −45 est excellent, −70 correct,
−85 très faible. L'application en déduit une distance approximative
(ordre de grandeur uniquement : murs et obstacles la faussent).

> Chaque balayage interrompt brièvement la liaison WiFi (~2 s). Gardez un
> intervalle d'au moins 30 s, ou commentez `USE_WIFI_SCAN` si le module
> doit émettre en continu.

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
  "connectedDevices": 34,
  "lat": 5.35995,
  "lng": -4.00826,
  "satellites": 9
}
```

`lat`, `lng` et `satellites` ne sont présents que si le GPS a un point valide.
La même ligne JSON est écrite sur le port USB (option `USB_JSON_OUTPUT`).

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
| **HTTP 401** | Clé API absente ou incorrecte dans `config.h` |
| HTTP -1 / timeout | Vérifier le WiFi, le pare-feu, `USE_TLS` cohérent avec le port |
| HTTP 404 | `ANTENNA_ID` incorrect dans `config.h` |
| WiFi échoue | SSID/mot de passe, portée du signal (2.4 GHz uniquement) |
| Port USB introuvable | Installer le pilote CP2102 / CH340 ; fermer le Moniteur série |
| Bouton USB grisé | Web Serial nécessite Chrome/Edge sur ordinateur (pas mobile) |
| GPS sans position | Sortir en extérieur, attendre 1–5 min, vérifier TX/RX croisés |
| Données non visibles | Actualiser le dashboard (5 s auto) |

## Test sans Arduino (curl)

```bash
curl -X POST https://antenne-patch-iot.netlify.app/api/telemetry ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: VOTRE_CLE_API" ^
  -d "{\"antennaId\":\"ant-1\",\"signalStrength\":90,\"temperature\":25,\"lat\":5.35995,\"lng\":-4.00826}"
```
