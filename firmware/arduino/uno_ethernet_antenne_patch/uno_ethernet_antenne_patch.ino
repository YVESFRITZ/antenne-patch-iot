/**
 * AntennePatch IoT — Firmware Arduino UNO + Shield Ethernet W5100/W5500
 *
 * Pour Arduino UNO R3 avec shield Ethernet.
 * Bibliothèques : ArduinoJson (v7), Ethernet (incluse)
 */

#include <SPI.h>
#include <Ethernet.h>
#include <ArduinoJson.h>
#include "config.h"

byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0x01 };
EthernetClient client;

unsigned long lastSend = 0;

void setup() {
  Serial.begin(9600);
  while (!Serial);

  Serial.println("=== AntennePatch IoT — Arduino UNO Ethernet ===");

  if (Ethernet.begin(mac) == 0) {
    Serial.println("ERREUR : DHCP échoué. Vérifiez le câble Ethernet.");
    while (true) delay(1000);
  }

  Serial.print("IP : ");
  Serial.println(Ethernet.localIP());
}

bool sendTelemetry() {
  float temperature = 22.0 + (random(0, 100) / 50.0);
  float humidity    = 40.0 + (random(0, 100) / 10.0);
  int battery       = random(60, 100);
  int signal        = random(50, 95);
  int devices       = random(5, 30);

  JsonDocument doc;
  doc["antennaId"]        = ANTENNA_ID;
  doc["signalStrength"]   = signal;
  doc["temperature"]      = temperature;
  doc["humidity"]         = humidity;
  doc["battery"]          = battery;
  doc["connectedDevices"] = devices;

  String payload;
  serializeJson(doc, payload);

  Serial.print("Connexion à ");
  Serial.print(SERVER_HOST);
  Serial.print(":");
  Serial.println(SERVER_PORT);

  if (!client.connect(SERVER_HOST, SERVER_PORT)) {
    Serial.println("ERREUR : connexion serveur échouée");
    return false;
  }

  client.print("POST /api/telemetry HTTP/1.1\r\n");
  client.print("Host: ");
  client.print(SERVER_HOST);
  client.print(":");
  client.println(SERVER_PORT);
  client.println("Content-Type: application/json");
  client.print("Content-Length: ");
  client.println(payload.length());
  client.println("Connection: close");
  client.println();
  client.print(payload);

  unsigned long timeout = millis();
  while (client.available() == 0) {
    if (millis() - timeout > 5000) {
      Serial.println("TIMEOUT");
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
  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    sendTelemetry();
  }
}
