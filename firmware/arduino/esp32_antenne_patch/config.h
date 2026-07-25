#ifndef CONFIG_H
#define CONFIG_H

/* =========================================================
   1. WiFi
   ========================================================= */
#define WIFI_SSID     "VOTRE_WIFI"
#define WIFI_PASSWORD "VOTRE_MOT_DE_PASSE"

/* =========================================================
   2. Serveur AntennePatch

   Par defaut : application en ligne (HTTPS).
   Pour un serveur local, commentez USE_TLS et remplacez
   SERVER_HOST / SERVER_PORT par l'IP de votre PC.
   ========================================================= */
#define USE_TLS
#define SERVER_HOST "antenne-patch-iot.netlify.app"
#define SERVER_PORT 443

// -- Variante serveur local (npm run dev) --
// #undef  USE_TLS
// #define SERVER_HOST "192.168.1.111"
// #define SERVER_PORT 3000

/* =========================================================
   3. Cle API

   Collez ici la cle fournie par l'application.
   Sans elle, le serveur repond 401 (non autorise).
   NE PAS partager ce fichier publiquement une fois la cle
   renseignee.
   ========================================================= */
#define API_KEY "COLLEZ_VOTRE_CLE_API_ICI"

/* =========================================================
   4. Identite du module
   ========================================================= */
#define ANTENNA_ID       "ant-1"
#define SEND_INTERVAL_MS 10000

/* =========================================================
   5. Module GPS (NEO-6M, NEO-7M, u-blox...)

   Cablage type sur ESP32 :
     GPS VCC -> 3V3       GPS GND -> GND
     GPS TX  -> GPIO16    GPS RX  -> GPIO17
   Commentez USE_GPS si aucun module GPS n'est branche.
   Bibliotheque requise : TinyGPSPlus
   ========================================================= */
#define USE_GPS
#define GPS_RX_PIN 16   // ESP32 recoit  <- TX du GPS
#define GPS_TX_PIN 17   // ESP32 emet    -> RX du GPS
#define GPS_BAUD   9600

/* =========================================================
   6. Capteurs
   ========================================================= */
// #define USE_DHT22
// #define DHT_PIN 4
#define BATTERY_PIN A0

/* =========================================================
   7. Balayage radio (antennes reellement captees)

   L'ESP32 scanne les points d'acces WiFi environnants et remonte
   ceux qu'il capte vraiment, avec leur puissance mesuree (RSSI).
   Ces reseaux apparaissent dans l'onglet "Equipement USB".

   Commentez USE_WIFI_SCAN pour desactiver.
   Attention : chaque balayage interrompt brievement la liaison WiFi
   (environ 2 secondes), d'ou un intervalle plus long que l'envoi.
   ========================================================= */
#define USE_WIFI_SCAN
#define SCAN_INTERVAL_MS 60000
#define SCAN_MAX_NETWORKS 15

/* =========================================================
   8. Sortie USB

   Emet aussi la mesure en JSON sur le port USB, pour l'onglet
   "Equipement USB" de l'application (Chrome / Edge).
   Fonctionne meme sans WiFi.
   ========================================================= */
#define USB_JSON_OUTPUT

#endif
