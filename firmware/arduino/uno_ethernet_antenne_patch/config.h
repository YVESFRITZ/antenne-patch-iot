#ifndef CONFIG_H
#define CONFIG_H

/* =========================================================
   Serveur AntennePatch

   L'Arduino UNO + shield Ethernet ne gere pas le HTTPS :
   il doit viser un serveur local en HTTP (votre PC faisant
   tourner "npm run dev", ou une passerelle sur le reseau).
   Pour envoyer vers l'application en ligne, utilisez l'ESP32.
   ========================================================= */
#define SERVER_HOST "192.168.1.111"
#define SERVER_PORT 3000

/* =========================================================
   Cle API

   Collez ici la cle fournie par l'application.
   NE PAS partager ce fichier publiquement une fois renseignee.
   ========================================================= */
#define API_KEY "COLLEZ_VOTRE_CLE_API_ICI"

/* =========================================================
   Identite du module
   ========================================================= */
#define ANTENNA_ID       "ant-1"
#define SEND_INTERVAL_MS 10000

/* =========================================================
   Module GPS (NEO-6M...)

   Cablage (le shield Ethernet occupe les broches 4, 10-13) :
     GPS VCC -> 5V        GPS GND -> GND
     GPS TX  -> broche 5  GPS RX  -> broche 6
   Commentez USE_GPS si aucun module GPS n'est branche.
   Bibliotheque requise : TinyGPSPlus
   ========================================================= */
#define USE_GPS
#define GPS_RX_PIN 5   // UNO recoit <- TX du GPS
#define GPS_TX_PIN 6   // UNO emet   -> RX du GPS
#define GPS_BAUD   9600

/* =========================================================
   Sortie USB

   Emet la mesure en JSON sur le port USB, pour l'onglet
   "Equipement USB" de l'application (Chrome / Edge).
   Fonctionne meme sans Ethernet.
   ========================================================= */
#define USB_JSON_OUTPUT

#endif
