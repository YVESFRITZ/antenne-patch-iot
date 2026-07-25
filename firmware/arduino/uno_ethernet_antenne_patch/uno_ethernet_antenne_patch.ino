/**
 * AntennePatch IoT — Firmware Arduino UNO + Shield Ethernet W5100/W5500
 *
 * Envoie la telemetrie et la position GPS vers l'API AntennePatch
 * (serveur local en HTTP) et/ou sur le port USB.
 *
 * Bibliotheques : ArduinoJson (v7), Ethernet (incluse),
 *                 TinyGPSPlus (si USE_GPS active)
 */

#include <SPI.h>
#include <Ethernet.h>
#include <ArduinoJson.h>
#include "config.h"

#ifdef USE_GPS
#include <SoftwareSerial.h>
#include <TinyGPSPlus.h>
TinyGPSPlus gps;
SoftwareSerial gpsSerial(GPS_RX_PIN, GPS_TX_PIN);
#endif

byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0x01 };
EthernetClient client;

unsigned long lastSend = 0;
bool networkReady = false;

void setup() {
  Serial.begin(9600);
  while (!Serial);

  Serial.println(F("=== AntennePatch IoT — Arduino UNO Ethernet ==="));

  if (String(API_KEY) == "COLLEZ_VOTRE_CLE_API_ICI") {
    Serial.println(F("ATTENTION : cle API non renseignee dans config.h"));
  }

#ifdef USE_GPS
  gpsSerial.begin(GPS_BAUD);
  Serial.println(F("Module GPS initialise"));
#endif

  if (Ethernet.begin(mac) == 0) {
    Serial.println(F("DHCP echoue — mode USB uniquement."));
  } else {
    networkReady = true;
    Serial.print(F("IP : "));
    Serial.println(Ethernet.localIP());
  }
}

#ifdef USE_GPS
/** Alimente le decodeur GPS avec les octets recus. */
void feedGps() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
}
#endif

String buildPayload() {
  JsonDocument doc;
  doc["antennaId"]        = ANTENNA_ID;
  doc["signalStrength"]   = random(50, 95);
  doc["temperature"]      = 22.0 + (random(0, 100) / 50.0);
  doc["humidity"]         = 40.0 + (random(0, 100) / 10.0);
  doc["battery"]          = random(60, 100);
  doc["connectedDevices"] = random(5, 30);

#ifdef USE_GPS
  if (gps.location.isValid()) {
    doc["lat"]        = gps.location.lat();
    doc["lng"]        = gps.location.lng();
    doc["satellites"] = gps.satellites.isValid() ? gps.satellites.value() : 0;
  }
#endif

  String payload;
  serializeJson(doc, payload);
  return payload;
}

bool sendTelemetry(const String &payload) {
  if (!networkReady) return false;

  if (!client.connect(SERVER_HOST, SERVER_PORT)) {
    Serial.println(F("ERREUR : connexion serveur echouee"));
    return false;
  }

  client.print(F("POST /api/telemetry HTTP/1.1\r\n"));
  client.print(F("Host: "));
  client.print(SERVER_HOST);
  client.print(F(":"));
  client.println(SERVER_PORT);
  client.println(F("Content-Type: application/json"));
  client.print(F("x-api-key: "));      // <- authentification du module
  client.println(API_KEY);
  client.print(F("Content-Length: "));
  client.println(payload.length());
  client.println(F("Connection: close"));
  client.println();
  client.print(payload);

  unsigned long timeout = millis();
  while (client.available() == 0) {
    if (millis() - timeout > 5000) {
      Serial.println(F("TIMEOUT"));
      client.stop();
      return false;
    }
  }

  while (client.available()) {
    Serial.write(client.read());
  }
  Serial.println();
  client.stop();
  return true;
}

void loop() {
#ifdef USE_GPS
  feedGps();   // decodage continu des trames GPS
#endif

  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();

    String payload = buildPayload();

#ifdef USB_JSON_OUTPUT
    // Ligne JSON lue par l'onglet "Equipement USB" de l'application
    Serial.println(payload);
#endif

    sendTelemetry(payload);
  }
}
