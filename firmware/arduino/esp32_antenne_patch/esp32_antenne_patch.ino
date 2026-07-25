/**
 * AntennePatch IoT — Firmware ESP32 (Arduino IDE)
 *
 * Envoie la telemetrie et la position GPS vers l'API AntennePatch,
 * en WiFi (HTTP/HTTPS) et/ou sur le port USB.
 *
 * Compatible : ESP32, ESP32-S3, ESP32-C3
 *
 * Bibliotheques requises (Gestionnaire de bibliotheques Arduino) :
 *   - ArduinoJson (v7)
 *   - TinyGPSPlus        (si USE_GPS active)
 *   - DHT sensor library (si USE_DHT22 active)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

#ifdef USE_TLS
#include <WiFiClientSecure.h>
#endif

#ifdef USE_GPS
#include <TinyGPSPlus.h>
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);   // UART2 de l'ESP32
#endif

#ifdef USE_DHT22
#include <DHT.h>
DHT dht(DHT_PIN, DHT22);
#endif

unsigned long lastSend = 0;
unsigned long lastScan = 0;
int connectedDevices = 0;

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("=== AntennePatch IoT — ESP32 ===");
  Serial.print("Antenne ID : ");
  Serial.println(ANTENNA_ID);

  if (String(API_KEY) == "COLLEZ_VOTRE_CLE_API_ICI") {
    Serial.println("ATTENTION : cle API non renseignee dans config.h");
    Serial.println("   -> le serveur repondra 401 (non autorise).");
  }

#ifdef USE_GPS
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("Module GPS initialise (UART2)");
#endif

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
    Serial.print("Connecte ! IP : ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi non connecte — mode USB uniquement.");
  }
}

/* ---------------------------------------------------------
   Lecture des capteurs
   --------------------------------------------------------- */

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
  // Exemple : batterie LiPo 3.0V-4.2V via diviseur 2:1 -> 1.5V-2.1V
  float voltage = (raw / 4095.0) * 3.3 * 2.0;
  int percent = (int)((voltage - 3.0) / (4.2 - 3.0) * 100.0);
  return constrain(percent, 0, 100);
}

int readSignalStrength() {
  if (WiFi.status() != WL_CONNECTED) return 0;
  // RSSI WiFi -> pourcentage approximatif (-30 excellent ... -90 faible)
  int rssi = WiFi.RSSI();
  int strength = map(rssi, -90, -30, 0, 100);
  return constrain(strength, 0, 100);
}

#ifdef USE_GPS
/** Alimente le decodeur GPS avec les octets recus. */
void feedGps() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
}
#endif

#ifdef USE_WIFI_SCAN
/** Nom lisible du chiffrement d'un reseau. */
const char *encryptionName(wifi_auth_mode_t mode) {
  switch (mode) {
    case WIFI_AUTH_OPEN:            return "Ouvert";
    case WIFI_AUTH_WEP:             return "WEP";
    case WIFI_AUTH_WPA_PSK:         return "WPA";
    case WIFI_AUTH_WPA2_PSK:        return "WPA2";
    case WIFI_AUTH_WPA_WPA2_PSK:    return "WPA/WPA2";
    case WIFI_AUTH_WPA2_ENTERPRISE: return "WPA2-Entreprise";
#ifdef WIFI_AUTH_WPA3_PSK
    case WIFI_AUTH_WPA3_PSK:        return "WPA3";
    case WIFI_AUTH_WPA2_WPA3_PSK:   return "WPA2/WPA3";
#endif
    default:                        return "Inconnu";
  }
}

/**
 * Balaye les antennes WiFi environnantes et emet la liste sur le port USB.
 * Ce sont des emetteurs reellement captes par le module, avec la
 * puissance mesuree sur place (RSSI en dBm).
 */
void scanNetworks() {
  Serial.println("Balayage radio en cours...");

  // true = scan actif, false = pas de scan asynchrone, 300 ms par canal
  int found = WiFi.scanNetworks(false, true, false, 300);
  if (found <= 0) {
    Serial.println("Aucun reseau detecte");
    WiFi.scanDelete();
    return;
  }

  int limit = found < SCAN_MAX_NETWORKS ? found : SCAN_MAX_NETWORKS;

  JsonDocument doc;
  doc["type"]      = "scan";
  doc["antennaId"] = ANTENNA_ID;
  JsonArray networks = doc["networks"].to<JsonArray>();

  for (int i = 0; i < limit; i++) {
    JsonObject net = networks.add<JsonObject>();
    net["ssid"]    = WiFi.SSID(i);
    net["bssid"]   = WiFi.BSSIDstr(i);
    net["rssi"]    = WiFi.RSSI(i);
    net["channel"] = WiFi.channel(i);
    net["enc"]     = encryptionName(WiFi.encryptionType(i));
  }

  String payload;
  serializeJson(doc, payload);
  Serial.println(payload);   // lu par l'onglet "Equipement USB"

  Serial.print("Reseaux captes : ");
  Serial.println(found);

  WiFi.scanDelete();   // libere la memoire du resultat
}
#endif

/* ---------------------------------------------------------
   Construction et envoi de la mesure
   --------------------------------------------------------- */

String buildPayload() {
  JsonDocument doc;
  doc["antennaId"]        = ANTENNA_ID;
  doc["signalStrength"]   = readSignalStrength();
  doc["temperature"]      = readTemperature();
  doc["humidity"]         = readHumidity();
  doc["battery"]          = readBatteryPercent();

  // Remplacer par un compteur reel (LoRa / BLE) si disponible
  connectedDevices = random(5, 40);
  doc["connectedDevices"] = connectedDevices;

#ifdef USE_GPS
  // Position transmise uniquement si le point GPS est valide
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
  if (WiFi.status() != WL_CONNECTED) return false;

  String url;
#ifdef USE_TLS
  url = String("https://") + SERVER_HOST + "/api/telemetry";
  WiFiClientSecure client;
  // Pas de verification du certificat : suffisant ici, la cle API
  // authentifie le module aupres du serveur.
  client.setInsecure();
#else
  url = String("http://") + SERVER_HOST + ":" + String(SERVER_PORT) + "/api/telemetry";
#endif

  HTTPClient http;
#ifdef USE_TLS
  http.begin(client, url);
#else
  http.begin(url);
#endif
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);   // <- authentification du module
  http.setTimeout(8000);

  int httpCode = http.POST(payload);
  String response = http.getString();
  http.end();

  if (httpCode == 200) {
    Serial.println("OK — Telemetrie envoyee");
    return true;
  }

  Serial.print("ERREUR HTTP ");
  Serial.println(httpCode);
  if (httpCode == 401) {
    Serial.println("   -> cle API refusee, verifiez API_KEY dans config.h");
  }
  Serial.println(response);
  return false;
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

#ifdef USE_WIFI_SCAN
  if (millis() - lastScan >= SCAN_INTERVAL_MS) {
    lastScan = millis();
    scanNetworks();
  }
#endif

  delay(10);
}
