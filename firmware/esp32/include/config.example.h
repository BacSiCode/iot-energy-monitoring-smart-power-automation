#pragma once

// Real-hardware configuration template.
// Copy to include/config.h (gitignored) and fill in local values.
// NEVER commit config.h - it contains credentials.
// Without config.h the firmware uses Wokwi defaults (Wokwi-GUEST + broker.hivemq.com).

#define WIFI_SSID "your-wifi-ssid"
#define WIFI_PASSWORD "your-wifi-password"

// IP of the machine running Mosquitto (docker compose), e.g. 192.168.1.10
#define MQTT_HOST "192.168.1.10"
#define MQTT_PORT 1883
#define MQTT_USERNAME ""
#define MQTT_PASSWORD ""

// Production-like timing (the firmware defaults are shortened for demos).
#define PRESENCE_HOLD_MS 300000UL
#define LOCAL_FALLBACK_AFTER_MS 60000UL
