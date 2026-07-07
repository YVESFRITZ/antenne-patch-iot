/**
 * AntennePatch IoT — Firmware ESP32 (Arduino IDE)
 *
 * Envoie la télémétrie vers l'API REST AntennePatch.
 * Compatible : ESP32, ESP32-S3, ESP32-C3
 *
 * Bibliothèques requises (Gestionnaire de bibliothèques Arduino) :
 *   - ArduinoJson (v7)
 *   - DHT sensor library (si USE_DHT22 activé dans config.h)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

#ifdef USE_DHT22
#include <DHT.h>
DHT dht(DHT_PIN, DHT22);
#endif

unsigned long lastSend = 0;
int connectedDevices = 0;

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("=== AntennePatch IoT — ESP32 ===");
  Serial.print("Antenne ID : ");
  Serial.println(ANTENNA_ID);

#ifdef USE_DHT22
  dht.begin();
#endif

  pinMode(BATTERY_PIN, INPUT);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connexion WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Connecté ! IP : ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("ERREUR : WiFi non connecté. Vérifiez config.h");
  }
}

float readTemperature() {
#ifdef USE_DHT22
  float t = dht.readTemperature();
  if (!isnan(t)) return t;
#endif
  // Simulation si pas de capteur
  return 22.0 + (random(0, 100) / 50.0);
}

float readHumidity() {
#ifdef USE_DHT22
  float h = dht.readHumidity();
  if (!isnan(h)) return h;
#endif
  return 40.0 + (random(0, 100) / 10.0);
}

int readBatteryPercent() {
  int raw = analogRead(BATTERY_PIN);
  // ESP32 ADC 12 bits (0-4095), ajuster selon votre diviseur de tension
  // Exemple : batterie LiPo 3.0V-4.2V via diviseur 2:1 → 1.5V-2.1V
  float voltage = (raw / 4095.0) * 3.3 * 2.0;
  int percent = (int)((voltage - 3.0) / (4.2 - 3.0) * 100.0);
  return constrain(percent, 0, 100);
}

int readSignalStrength() {
  if (WiFi.status() != WL_CONNECTED) return 0;
  // RSSI WiFi → pourcentage approximatif (-30 excellent … -90 faible)
  int rssi = WiFi.RSSI();
  int strength = map(rssi, -90, -30, 0, 100);
  return constrain(strength, 0, 100);
}

bool sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi déconnecté, envoi annulé");
    return false;
  }

  float temperature = readTemperature();
  float humidity    = readHumidity();
  int battery       = readBatteryPercent();
  int signal        = readSignalStrength();

  // Simuler des appareils connectés (remplacer par compteur réel LoRa/BLE)
  connectedDevices = random(5, 40);

  JsonDocument doc;
  doc["antennaId"]         = ANTENNA_ID;
  doc["signalStrength"]    = signal;
  doc["temperature"]       = temperature;
  doc["humidity"]          = humidity;
  doc["battery"]           = battery;
  doc["connectedDevices"]  = connectedDevices;

  String payload;
  serializeJson(doc, payload);

  String url = String("http://") + SERVER_HOST + ":" + String(SERVER_PORT) + "/api/telemetry";

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  Serial.print("POST ");
  Serial.println(url);
  Serial.print("Payload : ");
  Serial.println(payload);

  int httpCode = http.POST(payload);
  String response = http.getString();
  http.end();

  if (httpCode == 200) {
    Serial.println("OK — Télémétrie envoyée");
    Serial.println(response);
    return true;
  } else {
    Serial.print("ERREUR HTTP ");
    Serial.println(httpCode);
    Serial.println(response);
    return false;
  }
}

void loop() {
  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    sendTelemetry();
  }
  delay(100);
}
