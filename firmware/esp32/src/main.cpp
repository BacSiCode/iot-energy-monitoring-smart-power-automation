#include <Arduino.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>

#if __has_include("config.h")
#include "config.h"
#else
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#define MQTT_HOST ""
#define MQTT_PORT 1883
#define MQTT_USERNAME ""
#define MQTT_PASSWORD ""
#endif

namespace {
constexpr char DEVICE_ID[] = "device01";
constexpr char FIRMWARE_VERSION[] = "1.0.0";
constexpr uint8_t PIR_PIN = 27;
constexpr uint8_t CURRENT_PIN = 34;
constexpr uint8_t STORE_STATE_PIN = 26;
constexpr uint8_t RELAY_PIN = 25;
constexpr uint8_t BUZZER_PIN = 33;
constexpr uint16_t DEFAULT_THRESHOLD = 700;
constexpr unsigned long TELEMETRY_INTERVAL_MS = 2000;
constexpr unsigned long RECONNECT_INTERVAL_MS = 5000;
constexpr unsigned long PRESENCE_HOLD_MS = 300000;

const char* const TOPIC_TELEMETRY = "iot55/device01/telemetry";
const char* const TOPIC_CURRENT = "iot55/device01/current";
const char* const TOPIC_PRESENCE = "iot55/device01/presence";
const char* const TOPIC_STATUS = "iot55/device01/status";
const char* const TOPIC_EVENT = "iot55/device01/event";
const char* const TOPIC_RELAY_STATE = "iot55/device01/relay/state";
const char* const TOPIC_CMD_RELAY = "iot55/device01/cmd/relay";
const char* const TOPIC_CMD_MODE = "iot55/device01/cmd/mode";
const char* const TOPIC_CMD_OVERRIDE = "iot55/device01/cmd/override";
const char* const TOPIC_CMD_THRESHOLD = "iot55/device01/cmd/threshold";

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
bool relayOn = false;
bool overrideActive = false;
String mode = "AUTO";
uint16_t currentThreshold = DEFAULT_THRESHOLD;
unsigned long lastTelemetryAt = 0;
unsigned long lastReconnectAt = 0;
unsigned long lastPresenceAt = 0;

void publishJson(const char* topic, JsonDocument& document, bool retained = false) {
  char payload[1024];
  serializeJson(document, payload, sizeof(payload));
  mqttClient.publish(topic, payload, retained);
}

void publishEvent(const char* eventType, const char* description) {
  JsonDocument document;
  document["device_id"] = DEVICE_ID;
  document["timestamp_ms"] = millis();
  document["event_type"] = eventType;
  document["severity"] = strcmp(eventType, "ABNORMAL_CURRENT") == 0 ? "WARNING" : "INFO";
  document["description"] = description;
  publishJson(TOPIC_EVENT, document);
}

void publishRelayState(const char* changedBy) {
  JsonDocument document;
  document["device_id"] = DEVICE_ID;
  document["timestamp_ms"] = millis();
  document["state"] = relayOn ? "ON" : "OFF";
  document["mode"] = mode;
  document["changed_by"] = changedBy;
  publishJson(TOPIC_RELAY_STATE, document, true);
}

void setRelay(bool enabled, const char* changedBy) {
  relayOn = enabled;
  digitalWrite(RELAY_PIN, relayOn ? HIGH : LOW);
  publishRelayState(changedBy);
}

void publishStatus(bool online) {
  JsonDocument document;
  document["device_id"] = DEVICE_ID;
  document["timestamp_ms"] = millis();
  document["online"] = online;
  document["store_status"] = digitalRead(STORE_STATE_PIN) == HIGH ? "CLOSED" : "OPEN";
  document["relay"] = relayOn ? "ON" : "OFF";
  document["mode"] = mode;
  document["override_active"] = overrideActive;
  document["wifi_rssi"] = WiFi.RSSI();
  publishJson(TOPIC_STATUS, document, true);
}

void publishTelemetry() {
  const int currentSignal = analogRead(CURRENT_PIN);
  const bool rawPresence = digitalRead(PIR_PIN) == HIGH;
  if (rawPresence) lastPresenceAt = millis();
  const bool presence = rawPresence || (lastPresenceAt != 0 && millis() - lastPresenceAt < PRESENCE_HOLD_MS);
  const bool storeClosed = digitalRead(STORE_STATE_PIN) == HIGH;
  const bool abnormal = currentSignal > currentThreshold;

  JsonDocument telemetry;
  telemetry["device_id"] = DEVICE_ID;
  telemetry["timestamp_ms"] = millis();
  telemetry["current_signal"] = currentSignal;
  telemetry["current_threshold_signal"] = currentThreshold;
  telemetry["presence"] = presence;
  telemetry["store_status"] = storeClosed ? "CLOSED" : "OPEN";
  telemetry["relay"] = relayOn;
  telemetry["mode"] = mode;
  telemetry["override_active"] = overrideActive;
  telemetry["abnormal_current"] = abnormal;
  telemetry["uptime_s"] = millis() / 1000;
  telemetry["wifi_rssi"] = WiFi.RSSI();
  publishJson(TOPIC_TELEMETRY, telemetry);

  JsonDocument current;
  current["device_id"] = DEVICE_ID;
  current["timestamp_ms"] = millis();
  current["current_signal"] = currentSignal;
  current["threshold_signal"] = currentThreshold;
  current["abnormal"] = abnormal;
  publishJson(TOPIC_CURRENT, current, true);

  JsonDocument presenceMessage;
  presenceMessage["device_id"] = DEVICE_ID;
  presenceMessage["timestamp_ms"] = millis();
  presenceMessage["state"] = presence ? "PRESENT" : "NONE";
  publishJson(TOPIC_PRESENCE, presenceMessage, true);
  if (abnormal) tone(BUZZER_PIN, 1800, 150); else noTone(BUZZER_PIN);
}

bool parseCommand(JsonDocument& document, const byte* payload, unsigned int length) {
  DeserializationError error = deserializeJson(document, payload, length);
  if (error) {
    publishEvent("INVALID_PAYLOAD", "Command JSON could not be parsed");
    return false;
  }
  return true;
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  JsonDocument document;
  if (!parseCommand(document, payload, length)) return;
  const String topicName(topic);

  if (topicName == TOPIC_CMD_RELAY) {
    const char* command = document["command"] | "";
    if (strcmp(command, "ON") != 0 && strcmp(command, "OFF") != 0) {
      publishEvent("INVALID_PAYLOAD", "Unsupported relay command");
      return;
    }
    setRelay(strcmp(command, "ON") == 0, document["source"] | "REMOTE");
    publishEvent(strcmp(command, "ON") == 0 ? "REMOTE_ON" : "REMOTE_OFF", "Relay changed by MQTT command");
  } else if (topicName == TOPIC_CMD_MODE) {
    const char* requestedMode = document["mode"] | "";
    if (strcmp(requestedMode, "AUTO") != 0 && strcmp(requestedMode, "MANUAL") != 0) {
      publishEvent("INVALID_PAYLOAD", "Unsupported mode");
      return;
    }
    mode = requestedMode;
    publishStatus(true);
  } else if (topicName == TOPIC_CMD_OVERRIDE) {
    const char* requestedOverride = document["override"] | "";
    if (strcmp(requestedOverride, "ACTIVE") != 0 && strcmp(requestedOverride, "CLEAR") != 0) {
      publishEvent("INVALID_PAYLOAD", "Unsupported override command");
      return;
    }
    overrideActive = strcmp(requestedOverride, "ACTIVE") == 0;
    mode = overrideActive ? "MANUAL" : "AUTO";
    publishEvent(overrideActive ? "MANUAL_OVERRIDE" : "OVERRIDE_CLEARED", "Override state changed");
    publishStatus(true);
  } else if (topicName == TOPIC_CMD_THRESHOLD) {
    const int requestedThreshold = document["threshold_signal"] | 0;
    if (requestedThreshold < 1 || requestedThreshold > 4095) {
      publishEvent("INVALID_PAYLOAD", "Threshold must be between 1 and 4095");
      return;
    }
    currentThreshold = requestedThreshold;
    publishStatus(true);
  }
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED || strlen(WIFI_SSID) == 0) return;
  Serial.print("WiFi connecting");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (uint8_t attempt = 0; attempt < 20 && WiFi.status() != WL_CONNECTED; ++attempt) {
    delay(250);
    Serial.print('.');
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " failed");
}

void connectMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqttClient.connected() || strlen(MQTT_HOST) == 0) return;
  if (millis() - lastReconnectAt < RECONNECT_INTERVAL_MS) return;
  lastReconnectAt = millis();
  Serial.println("MQTT connecting...");
  String clientId = String(DEVICE_ID) + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  const bool connected = mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD,
                                            TOPIC_STATUS, 1, true,
                                            "{\"device_id\":\"device01\",\"online\":false,\"state\":\"OFFLINE\"}");
  if (!connected) {
    Serial.printf("MQTT failed, state=%d\n", mqttClient.state());
    return;
  }
  Serial.println("MQTT connected");
  mqttClient.subscribe(TOPIC_CMD_RELAY);
  mqttClient.subscribe(TOPIC_CMD_MODE);
  mqttClient.subscribe(TOPIC_CMD_OVERRIDE);
  mqttClient.subscribe(TOPIC_CMD_THRESHOLD);
  publishEvent("DEVICE_ONLINE", "MQTT connected");
  publishStatus(true);
}
}

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(CURRENT_PIN, INPUT);
  pinMode(STORE_STATE_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  setRelay(false, "BOOT");
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  connectWifi();
}

void loop() {
  connectWifi();
  connectMqtt();
  if (mqttClient.connected()) mqttClient.loop();
  if (millis() - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryAt = millis();
    publishTelemetry();
  }
  delay(10);
}
