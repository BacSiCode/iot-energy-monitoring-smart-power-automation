// IoT Project 55 - Smart Energy Monitoring & Automatic Power Shutdown
// ESP32 edge firmware: sensing, MQTT uplink, command downlink, actuators.
//
// Responsibility split (see docs/architecture/04-architecture.md):
//   - ESP32     : read sensors, drive relay/buzzer/LEDs, validate commands,
//                 enforce override, local fallback when the network is down.
//   - Node-RED  : authoritative state machine, rules, scheduler, event log.
//
// This exact file is also used by the Wokwi simulation
// (simulation/wokwi/sketch.ino is a copy kept in sync by scripts/sync-wokwi.js).

#include <Arduino.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <time.h>

// ---------------------------------------------------------------------------
// Configuration
// Real hardware: copy include/config.example.h to include/config.h (gitignored).
// Without config.h (or in the Wokwi build) the defaults below are used:
// Wokwi virtual Wi-Fi + public HiveMQ broker.
// ---------------------------------------------------------------------------
#if !defined(IOT55_SIMULATION) && __has_include("config.h")
#include "config.h"
#endif

#ifndef WIFI_SSID
#define WIFI_SSID "Wokwi-GUEST"
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif
#ifndef MQTT_HOST
#define MQTT_HOST "broker.hivemq.com"
#endif
#ifndef MQTT_PORT
#define MQTT_PORT 1883
#endif
#ifndef MQTT_USERNAME
#define MQTT_USERNAME ""
#endif
#ifndef MQTT_PASSWORD
#define MQTT_PASSWORD ""
#endif
// Presence is held this long after the last PIR pulse (demo value; production: 300000).
#ifndef PRESENCE_HOLD_MS
#define PRESENCE_HOLD_MS 10000UL
#endif
// After this long without MQTT, the device applies the after-hours rule locally.
#ifndef LOCAL_FALLBACK_AFTER_MS
#define LOCAL_FALLBACK_AFTER_MS 30000UL
#endif

namespace {

// --- Identity --------------------------------------------------------------
constexpr char DEVICE_ID[] = "device01";
constexpr char FIRMWARE_VERSION[] = "2.0.0";

// --- Pins (must match simulation/wokwi/diagram.json) -----------------------
constexpr uint8_t PIR_PIN = 27;          // PIR OUT (HIGH = motion)
constexpr uint8_t CURRENT_PIN = 34;      // ACS712 OUT / potentiometer SIG (ADC1)
constexpr uint8_t STORE_STATE_PIN = 26;  // slide switch (HIGH = CLOSED)
constexpr uint8_t OVERRIDE_BTN_PIN = 14; // push button to GND (INPUT_PULLUP)
constexpr uint8_t RELAY_PIN = 25;        // relay IN (HIGH = load ON)
constexpr uint8_t BUZZER_PIN = 33;       // buzzer +
constexpr uint8_t STATUS_LED_PIN = 4;    // green: network status
constexpr uint8_t ALARM_LED_PIN = 19;    // red: abnormal current

// --- Timing & thresholds ---------------------------------------------------
constexpr unsigned long TELEMETRY_INTERVAL_MS = 2000;
constexpr unsigned long SAMPLE_INTERVAL_MS = 100;
constexpr unsigned long WIFI_RETRY_MS = 10000;
constexpr unsigned long MQTT_RETRY_MS = 5000;
constexpr unsigned long DEBOUNCE_MS = 50;
constexpr uint16_t DEFAULT_THRESHOLD = 700;   // ADC counts (0..4095)
constexpr uint16_t THRESHOLD_HYSTERESIS = 30; // ADC counts
constexpr uint8_t ADC_SAMPLES = 8;
// Linear mapping used for the simulated sensor: 4095 ADC counts = 20 A.
// A real ACS712 needs calibration (zero offset + sensitivity) before use.
constexpr float CURRENT_FULL_SCALE_A = 20.0f;
constexpr size_t EVENT_QUEUE_SIZE = 8;

// --- MQTT topics -----------------------------------------------------------
#define TOPIC_BASE "iot55/device01/"
const char TOPIC_TELEMETRY[] = TOPIC_BASE "telemetry";
const char TOPIC_CURRENT[] = TOPIC_BASE "current";
const char TOPIC_PRESENCE[] = TOPIC_BASE "presence";
const char TOPIC_STATUS[] = TOPIC_BASE "status";
const char TOPIC_EVENT[] = TOPIC_BASE "event";
const char TOPIC_RELAY_STATE[] = TOPIC_BASE "relay/state";
const char TOPIC_CMD_WILDCARD[] = TOPIC_BASE "cmd/#";
const char TOPIC_CMD_RELAY[] = TOPIC_BASE "cmd/relay";
const char TOPIC_CMD_MODE[] = TOPIC_BASE "cmd/mode";
const char TOPIC_CMD_OVERRIDE[] = TOPIC_BASE "cmd/override";
const char TOPIC_CMD_THRESHOLD[] = TOPIC_BASE "cmd/threshold";
const char TOPIC_CMD_ALARM[] = TOPIC_BASE "cmd/alarm";
const char LWT_PAYLOAD[] = "{\"device_id\":\"device01\",\"online\":false,\"state\":\"OFFLINE\"}";

// --- Runtime state ---------------------------------------------------------
struct DeviceState {
  bool relayOn = false;
  String relayChangedBy = "BOOT";
  bool automationEnabled = true;  // mode AUTO / MANUAL (cmd/mode)
  bool overrideActive = false;    // manual override (button or cmd/override)
  String overrideSource = "NONE";
  uint16_t threshold = DEFAULT_THRESHOLD;
  int currentSignal = 0;
  bool pirRaw = false;
  bool presence = false;
  bool storeClosed = false;
  bool alarmActive = false;
  bool alarmAcknowledged = false;
};

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
DeviceState state;

bool telemetryDirty = true;
bool wifiWasConnected = false;
unsigned long lastTelemetryAt = 0;
unsigned long lastSampleAt = 0;
unsigned long lastWifiAttemptAt = 0;
unsigned long lastMqttAttemptAt = 0;
unsigned long mqttDisconnectedSince = 0;
unsigned long lastPresenceAt = 0;
bool presenceSeen = false;
uint32_t mqttConnectCount = 0;

bool buttonLastReading = HIGH;
bool buttonStable = HIGH;
unsigned long buttonChangedAt = 0;

String eventQueue[EVENT_QUEUE_SIZE];
size_t eventQueueCount = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const char* modeName() { return state.automationEnabled ? "AUTO" : "MANUAL"; }
const char* storeName() { return state.storeClosed ? "CLOSED" : "OPEN"; }
bool automationActive() { return state.automationEnabled && !state.overrideActive; }
float toAmps(int signal) { return signal * CURRENT_FULL_SCALE_A / 4095.0f; }

void stamp(JsonDocument& doc) {
  doc["device_id"] = DEVICE_ID;
  const time_t now = time(nullptr);
  if (now > 1700000000) {  // NTP synchronised
    struct tm utc;
    gmtime_r(&now, &utc);
    char iso[25];
    strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", &utc);
    doc["timestamp"] = iso;
  } else {
    doc["timestamp"] = nullptr;
  }
  doc["uptime_ms"] = millis();
}

bool publishJson(const char* topic, JsonDocument& doc, bool retained) {
  if (!mqttClient.connected()) return false;
  char payload[768];
  const size_t length = serializeJson(doc, payload, sizeof(payload));
  return mqttClient.publish(topic, reinterpret_cast<const uint8_t*>(payload), length, retained);
}

// Events raised while offline are queued and flushed after reconnect.
void publishEvent(const char* type, const char* severity, const char* reason, const char* detail = "") {
  JsonDocument doc;
  stamp(doc);
  doc["origin"] = "device";
  doc["event_type"] = type;
  doc["severity"] = severity;
  doc["reason"] = reason;
  if (strlen(detail) > 0) doc["detail"] = detail;
  doc["current_signal"] = state.currentSignal;
  doc["current_a"] = serialized(String(toAmps(state.currentSignal), 2));
  doc["relay"] = state.relayOn;
  Serial.printf("[EVENT] %s (%s) %s %s\n", type, severity, reason, detail);
  if (publishJson(TOPIC_EVENT, doc, false)) return;
  String payload;
  serializeJson(doc, payload);
  if (eventQueueCount == EVENT_QUEUE_SIZE) {  // drop oldest
    for (size_t i = 1; i < EVENT_QUEUE_SIZE; ++i) eventQueue[i - 1] = eventQueue[i];
    --eventQueueCount;
  }
  eventQueue[eventQueueCount++] = payload;
}

void flushEventQueue() {
  for (size_t i = 0; i < eventQueueCount; ++i) mqttClient.publish(TOPIC_EVENT, eventQueue[i].c_str());
  eventQueueCount = 0;
}

// ---------------------------------------------------------------------------
// Uplink
// ---------------------------------------------------------------------------
void publishStatus() {
  JsonDocument doc;
  stamp(doc);
  doc["online"] = true;
  doc["state"] = "ONLINE";
  doc["fw"] = FIRMWARE_VERSION;
  doc["ip"] = WiFi.localIP().toString();
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["mqtt_connects"] = mqttConnectCount;
  doc["mode"] = modeName();
  doc["override_active"] = state.overrideActive;
  doc["threshold_signal"] = state.threshold;
  publishJson(TOPIC_STATUS, doc, true);
}

void publishRelayState() {
  JsonDocument doc;
  stamp(doc);
  doc["state"] = state.relayOn ? "ON" : "OFF";
  doc["changed_by"] = state.relayChangedBy;
  publishJson(TOPIC_RELAY_STATE, doc, true);
}

void publishTelemetry() {
  JsonDocument doc;
  stamp(doc);
  doc["current_signal"] = state.currentSignal;
  doc["current_a"] = serialized(String(toAmps(state.currentSignal), 2));
  doc["threshold_signal"] = state.threshold;
  doc["threshold_a"] = serialized(String(toAmps(state.threshold), 2));
  doc["presence"] = state.presence;
  doc["pir_raw"] = state.pirRaw;
  doc["store_status"] = storeName();
  doc["relay"] = state.relayOn;
  doc["mode"] = modeName();
  doc["override_active"] = state.overrideActive;
  doc["override_source"] = state.overrideSource;
  doc["abnormal_current"] = state.alarmActive;
  doc["alarm_acknowledged"] = state.alarmAcknowledged;
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["fw"] = FIRMWARE_VERSION;
  publishJson(TOPIC_TELEMETRY, doc, false);

  JsonDocument current;
  stamp(current);
  current["current_signal"] = state.currentSignal;
  current["current_a"] = serialized(String(toAmps(state.currentSignal), 2));
  current["threshold_signal"] = state.threshold;
  current["abnormal"] = state.alarmActive;
  publishJson(TOPIC_CURRENT, current, true);

  JsonDocument presence;
  stamp(presence);
  presence["state"] = state.presence ? "PRESENT" : "NONE";
  publishJson(TOPIC_PRESENCE, presence, true);

  Serial.printf("[TEL] store=%s presence=%s current=%d (%.2fA) thr=%u relay=%s mode=%s override=%s alarm=%s mqtt=%s\n",
                storeName(), state.presence ? "YES" : "NO", state.currentSignal, toAmps(state.currentSignal),
                state.threshold, state.relayOn ? "ON" : "OFF", modeName(), state.overrideActive ? "ON" : "OFF",
                state.alarmActive ? (state.alarmAcknowledged ? "ACK" : "ACTIVE") : "NO",
                mqttClient.connected() ? "UP" : "DOWN");
}

// ---------------------------------------------------------------------------
// Actuators
// ---------------------------------------------------------------------------
void setRelay(bool on, const char* changedBy) {
  state.relayOn = on;
  state.relayChangedBy = changedBy;
  digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  Serial.printf("[RELAY] %s by %s\n", on ? "ON" : "OFF", changedBy);
  publishRelayState();
  telemetryDirty = true;
}

void setOverride(bool active, const char* source) {
  if (state.overrideActive == active) return;
  state.overrideActive = active;
  state.overrideSource = active ? source : "NONE";
  Serial.printf("[OVERRIDE] %s by %s\n", active ? "ACTIVE" : "CLEAR", source);
  publishStatus();
  telemetryDirty = true;
}

// Buzzer beeps (200 ms on / 300 ms off) while an unacknowledged alarm is active.
// Status LED: solid = MQTT up, slow blink = Wi-Fi only, fast blink = no Wi-Fi.
void updateIndicators() {
  const unsigned long now = millis();
  const bool beepPhase = (now % 500) < 200;
  if (state.alarmActive && !state.alarmAcknowledged && beepPhase) tone(BUZZER_PIN, 1800);
  else noTone(BUZZER_PIN);

  digitalWrite(ALARM_LED_PIN, state.alarmActive && (state.alarmAcknowledged || beepPhase) ? HIGH : LOW);

  bool statusOn;
  if (mqttClient.connected()) statusOn = true;
  else if (WiFi.status() == WL_CONNECTED) statusOn = (now % 1000) < 500;
  else statusOn = (now % 250) < 125;
  digitalWrite(STATUS_LED_PIN, statusOn ? HIGH : LOW);
}

// ---------------------------------------------------------------------------
// Sensing
// ---------------------------------------------------------------------------
int readCurrentSignal() {
  uint32_t sum = 0;
  for (uint8_t i = 0; i < ADC_SAMPLES; ++i) sum += analogRead(CURRENT_PIN);
  return static_cast<int>(sum / ADC_SAMPLES);
}

void sampleInputs() {
  const unsigned long now = millis();
  state.currentSignal = readCurrentSignal();

  state.pirRaw = digitalRead(PIR_PIN) == HIGH;
  if (state.pirRaw) {
    lastPresenceAt = now;
    presenceSeen = true;
  }
  const bool presence = state.pirRaw || (presenceSeen && now - lastPresenceAt < PRESENCE_HOLD_MS);
  if (presence != state.presence) {
    state.presence = presence;
    telemetryDirty = true;
  }

  const bool storeClosed = digitalRead(STORE_STATE_PIN) == HIGH;
  if (storeClosed != state.storeClosed) {
    state.storeClosed = storeClosed;
    telemetryDirty = true;
  }

  // Alarm with hysteresis so a signal hovering at the threshold does not chatter.
  const int clearLevel = state.threshold > THRESHOLD_HYSTERESIS ? state.threshold - THRESHOLD_HYSTERESIS : 0;
  if (!state.alarmActive && state.currentSignal > state.threshold) {
    state.alarmActive = true;
    state.alarmAcknowledged = false;
    telemetryDirty = true;
  } else if (state.alarmActive && state.currentSignal < clearLevel) {
    state.alarmActive = false;
    state.alarmAcknowledged = false;
    telemetryDirty = true;
  }
}

void pollOverrideButton() {
  const bool reading = digitalRead(OVERRIDE_BTN_PIN);
  if (reading != buttonLastReading) {
    buttonLastReading = reading;
    buttonChangedAt = millis();
  }
  if (millis() - buttonChangedAt > DEBOUNCE_MS && reading != buttonStable) {
    buttonStable = reading;
    if (buttonStable == LOW) setOverride(!state.overrideActive, "LOCAL_BUTTON");
  }
}

// Edge fallback: Node-RED owns the rules, but if the network has been down
// long enough the device still prevents the load running in an empty closed store.
void applyLocalFallback() {
  if (mqttClient.connected() || mqttDisconnectedSince == 0) return;
  if (millis() - mqttDisconnectedSince < LOCAL_FALLBACK_AFTER_MS) return;
  if (automationActive() && state.storeClosed && !state.presence && state.relayOn) {
    setRelay(false, "LOCAL_FALLBACK");
    publishEvent("AUTO_SHUTDOWN", "INFO", "LOCAL_FALLBACK_AFTER_HOURS_NO_PRESENCE", "MQTT unavailable");
  }
}

// ---------------------------------------------------------------------------
// Downlink (command handling)
// ---------------------------------------------------------------------------
void rejectCommand(const char* topic, const char* reason) {
  publishEvent("INVALID_PAYLOAD", "WARNING", reason, topic);
}

void handleRelayCommand(JsonDocument& doc) {
  const char* command = doc["command"] | "";
  String source = doc["source"] | "REMOTE";
  source.toUpperCase();
  if (strcmp(command, "ON") != 0 && strcmp(command, "OFF") != 0) {
    rejectCommand(TOPIC_CMD_RELAY, "RELAY_COMMAND_MUST_BE_ON_OR_OFF");
    return;
  }
  // Rule 5: automation commands must respect MANUAL mode and override.
  if (source.startsWith("AUTO") && !automationActive()) {
    publishEvent("COMMAND_REJECTED", "WARNING", "AUTOMATION_SUSPENDED", source.c_str());
    return;
  }
  setRelay(strcmp(command, "ON") == 0, source.c_str());
}

void handleModeCommand(JsonDocument& doc) {
  const char* mode = doc["mode"] | "";
  if (strcmp(mode, "AUTO") != 0 && strcmp(mode, "MANUAL") != 0) {
    rejectCommand(TOPIC_CMD_MODE, "MODE_MUST_BE_AUTO_OR_MANUAL");
    return;
  }
  state.automationEnabled = strcmp(mode, "AUTO") == 0;
  Serial.printf("[MODE] %s\n", mode);
  publishStatus();
  telemetryDirty = true;
}

void handleOverrideCommand(JsonDocument& doc) {
  const char* value = doc["override"] | "";
  if (strcmp(value, "ACTIVE") != 0 && strcmp(value, "CLEAR") != 0) {
    rejectCommand(TOPIC_CMD_OVERRIDE, "OVERRIDE_MUST_BE_ACTIVE_OR_CLEAR");
    return;
  }
  setOverride(strcmp(value, "ACTIVE") == 0, "REMOTE");
}

void handleThresholdCommand(JsonDocument& doc) {
  if (!doc["threshold_signal"].is<int>()) {
    rejectCommand(TOPIC_CMD_THRESHOLD, "THRESHOLD_MUST_BE_INTEGER");
    return;
  }
  const int value = doc["threshold_signal"].as<int>();
  if (value < 1 || value > 4095) {
    rejectCommand(TOPIC_CMD_THRESHOLD, "THRESHOLD_OUT_OF_RANGE_1_4095");
    return;
  }
  state.threshold = static_cast<uint16_t>(value);
  Serial.printf("[THRESHOLD] %d\n", value);
  publishStatus();
  telemetryDirty = true;
}

void handleAlarmCommand(JsonDocument& doc) {
  const char* action = doc["action"] | "";
  if (strcmp(action, "ACK") != 0) {
    rejectCommand(TOPIC_CMD_ALARM, "ALARM_ACTION_MUST_BE_ACK");
    return;
  }
  if (state.alarmActive) {
    state.alarmAcknowledged = true;
    Serial.println("[ALARM] acknowledged, buzzer silenced");
    telemetryDirty = true;
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (length == 0) return;  // cleared retained message
  JsonDocument doc;
  if (deserializeJson(doc, payload, length) || !doc.is<JsonObject>()) {
    rejectCommand(topic, "MALFORMED_JSON");
    return;
  }
  const char* target = doc["device_id"] | DEVICE_ID;
  if (strcmp(target, DEVICE_ID) != 0) {
    rejectCommand(topic, "DEVICE_ID_MISMATCH");
    return;
  }
  Serial.printf("[CMD] %s\n", topic);
  if (strcmp(topic, TOPIC_CMD_RELAY) == 0) handleRelayCommand(doc);
  else if (strcmp(topic, TOPIC_CMD_MODE) == 0) handleModeCommand(doc);
  else if (strcmp(topic, TOPIC_CMD_OVERRIDE) == 0) handleOverrideCommand(doc);
  else if (strcmp(topic, TOPIC_CMD_THRESHOLD) == 0) handleThresholdCommand(doc);
  else if (strcmp(topic, TOPIC_CMD_ALARM) == 0) handleAlarmCommand(doc);
  else rejectCommand(topic, "UNKNOWN_COMMAND_TOPIC");
}

// ---------------------------------------------------------------------------
// Connectivity (non-blocking)
// ---------------------------------------------------------------------------
void maintainWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      Serial.printf("[WIFI] connected, ip=%s rssi=%d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
      configTime(0, 0, "pool.ntp.org", "time.google.com");
    }
    return;
  }
  if (wifiWasConnected) {
    wifiWasConnected = false;
    Serial.println("[WIFI] lost");
  }
  if (lastWifiAttemptAt != 0 && millis() - lastWifiAttemptAt < WIFI_RETRY_MS) return;
  lastWifiAttemptAt = millis();
  Serial.printf("[WIFI] connecting to %s\n", WIFI_SSID);
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void maintainMqtt() {
  if (mqttClient.connected()) return;
  if (mqttDisconnectedSince == 0) {
    mqttDisconnectedSince = millis();
    if (mqttConnectCount > 0) Serial.println("[MQTT] disconnected");
  }
  if (WiFi.status() != WL_CONNECTED) return;
  if (lastMqttAttemptAt != 0 && millis() - lastMqttAttemptAt < MQTT_RETRY_MS) return;
  lastMqttAttemptAt = millis();

  const String clientId = String(DEVICE_ID) + "-" + String(static_cast<uint32_t>(ESP.getEfuseMac()), HEX);
  const bool useAuth = strlen(MQTT_USERNAME) > 0;
  Serial.printf("[MQTT] connecting to %s:%d as %s\n", MQTT_HOST, MQTT_PORT, clientId.c_str());
  const bool connected = mqttClient.connect(clientId.c_str(), useAuth ? MQTT_USERNAME : nullptr,
                                            useAuth ? MQTT_PASSWORD : nullptr, TOPIC_STATUS, 1, true, LWT_PAYLOAD);
  if (!connected) {
    Serial.printf("[MQTT] failed, state=%d, retry in %lus\n", mqttClient.state(), MQTT_RETRY_MS / 1000);
    return;
  }
  ++mqttConnectCount;
  mqttDisconnectedSince = 0;
  Serial.printf("[MQTT] connected (#%lu)\n", static_cast<unsigned long>(mqttConnectCount));
  mqttClient.subscribe(TOPIC_CMD_WILDCARD, 1);
  publishStatus();
  publishRelayState();
  flushEventQueue();
  telemetryDirty = true;
}

}  // namespace

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(CURRENT_PIN, INPUT);
  pinMode(STORE_STATE_PIN, INPUT);
  pinMode(OVERRIDE_BTN_PIN, INPUT_PULLUP);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(ALARM_LED_PIN, OUTPUT);

  Serial.println();
  Serial.println("==================================================");
  Serial.printf("IoT 55 Smart Energy Monitoring - %s fw %s\n", DEVICE_ID, FIRMWARE_VERSION);
  Serial.println("GPIO: PIR=27 CURRENT=34 STORE=26 OVERRIDE_BTN=14 RELAY=25 BUZZER=33 LED_STATUS=4 LED_ALARM=19");
  Serial.println("Relay starts OFF (fail-safe). Rules run in Node-RED; local fallback after MQTT loss.");
  Serial.println("==================================================");

  setRelay(false, "BOOT");
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(1024);
  mqttClient.setKeepAlive(15);     // broker publishes LWT ~22 s after a silent drop
  mqttClient.setSocketTimeout(5);  // keep reconnect attempts short
  sampleInputs();
}

void loop() {
  maintainWifi();
  maintainMqtt();
  mqttClient.loop();

  const unsigned long now = millis();
  if (now - lastSampleAt >= SAMPLE_INTERVAL_MS) {
    lastSampleAt = now;
    sampleInputs();
  }
  pollOverrideButton();
  applyLocalFallback();
  updateIndicators();

  if (telemetryDirty || now - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) {
    telemetryDirty = false;
    lastTelemetryAt = now;
    publishTelemetry();
  }
  delay(5);
}
