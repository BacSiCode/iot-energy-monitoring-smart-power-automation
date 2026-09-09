# MQTT Topic Design & Payload Specification
## IoT Project #55 — Energy Monitoring & Smart Power Automation

**Document:** `docs/mqtt/05-mqtt-design.md`
**Version:** 1.0
**Phase:** Week 1 — Architecture
**Date:** 2026-09-09

---

## 1. Namespace Convention

All topics use the following prefix:

```
iot55/device01/
```

Format: `iot55/<project-id>/<device-id>/<category>/<sub-category>`

This allows future expansion to multiple devices (`device02`, `device03`) or
multiple projects without topic collision.

---

## 2. Topic Registry

### 2.1 Uplink Topics (ESP32 → Broker → Node-RED)

| # | Topic | QoS | Retain | Publisher | Subscriber | Purpose |
|---|-------|-----|--------|-----------|-----------|---------|
| U01 | `iot55/device01/telemetry` | 1 | No | ESP32 | Node-RED | Combined sensor data (primary) |
| U02 | `iot55/device01/current` | 1 | Yes | ESP32 | Node-RED, Dashboard | Raw current reading |
| U03 | `iot55/device01/presence` | 1 | Yes | ESP32 | Node-RED, Dashboard | PIR presence state |
| U04 | `iot55/device01/status` | 1 | Yes | ESP32 | Node-RED, Dashboard | Device connectivity/state |
| U05 | `iot55/device01/event` | 1 | No | Node-RED | Dashboard, Logger | Automation events |
| U06 | `iot55/device01/relay/state` | 1 | Yes | ESP32 | Node-RED, Dashboard | Current relay state |

### 2.2 Downlink Topics (Node-RED/Dashboard → Broker → ESP32)

| # | Topic | QoS | Retain | Publisher | Subscriber | Purpose |
|---|-------|-----|--------|-----------|-----------|---------|
| D01 | `iot55/device01/cmd/relay` | 1 | No | Node-RED | ESP32 | Relay ON/OFF command |
| D02 | `iot55/device01/cmd/mode` | 1 | Yes | Node-RED | ESP32 | Mode: AUTO / MANUAL |
| D03 | `iot55/device01/cmd/override` | 1 | Yes | Node-RED | ESP32 | Override: ACTIVE / CLEAR |
| D04 | `iot55/device01/cmd/threshold` | 1 | Yes | Node-RED | ESP32 | Update current threshold |

### 2.3 LWT Topic (Last Will & Testament)

Configured on ESP32 MQTT connect:

| Topic | Payload | QoS | Retain |
|-------|---------|-----|--------|
| `iot55/device01/status` | `{"online": false, "state": "OFFLINE"}` | 1 | Yes |

---

## 3. Payload Specifications

### 3.1 `iot55/device01/telemetry` — Combined Telemetry

**Direction:** ESP32 → Node-RED  
**QoS:** 1  
**Interval:** Every 2 seconds (configurable)

```json
{
  "device_id": "device01",
  "timestamp": "2026-09-09T09:00:00+07:00",
  "current_a": 4.25,
  "current_threshold": 10.0,
  "presence": "PRESENT",
  "relay_state": "ON",
  "state": "NORMAL",
  "uptime_s": 3600,
  "wifi_rssi": -58,
  "firmware_version": "1.0.0"
}
```

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `device_id` | string | — | Device identifier |
| `timestamp` | string | ISO-8601 | Reading timestamp |
| `current_a` | float | Amperes | RMS current (2 decimal places) |
| `current_threshold` | float | Amperes | Active abnormal current threshold |
| `presence` | string | — | `"PRESENT"` or `"NONE"` |
| `relay_state` | string | — | `"ON"` or `"OFF"` |
| `state` | string | — | Current state machine state |
| `uptime_s` | integer | seconds | ESP32 uptime since boot |
| `wifi_rssi` | integer | dBm | Wi-Fi signal strength |
| `firmware_version` | string | — | Firmware semantic version |

---

### 3.2 `iot55/device01/current` — Current Reading

```json
{
  "device_id": "device01",
  "timestamp": "2026-09-09T09:00:00+07:00",
  "value_a": 4.25,
  "threshold_a": 10.0,
  "abnormal": false
}
```

---

### 3.3 `iot55/device01/presence` — Presence State

```json
{
  "device_id": "device01",
  "timestamp": "2026-09-09T09:00:00+07:00",
  "state": "PRESENT",
  "last_detected": "2026-09-09T08:55:00+07:00",
  "hold_timeout_s": 300
}
```

| `state` values | Meaning |
|----------------|---------|
| `"PRESENT"` | PIR HIGH or within hold timeout |
| `"NONE"` | PIR LOW and hold timeout expired |

---

### 3.4 `iot55/device01/status` — Device Status

```json
{
  "device_id": "device01",
  "timestamp": "2026-09-09T09:00:00+07:00",
  "online": true,
  "state": "NORMAL",
  "store_status": "OPEN",
  "mode": "AUTO",
  "override_active": false,
  "ip_address": "192.168.1.105",
  "firmware_version": "1.0.0"
}
```

---

### 3.5 `iot55/device01/event` — Automation Events

```json
{
  "device_id": "device01",
  "timestamp": "2026-09-09T22:05:30+07:00",
  "event_type": "AUTO_SHUTDOWN",
  "severity": "INFO",
  "description": "Store closed, no presence detected. Relay turned OFF.",
  "trigger_rule": "RULE_1",
  "state_before": "AFTER_HOURS",
  "state_after": "AUTO_SHUTDOWN",
  "relay_action": "OFF",
  "current_a": 2.1,
  "presence": "NONE"
}
```

**Event Type Values:**

| `event_type` | Trigger | Severity |
|--------------|---------|----------|
| `AUTO_SHUTDOWN` | RULE 1 fired | INFO |
| `ABNORMAL_CURRENT` | RULE 3 fired | WARNING |
| `STORE_OPENED` | Scheduler | INFO |
| `STORE_CLOSED` | Scheduler | INFO |
| `RELAY_ON` | Command/Auto | INFO |
| `RELAY_OFF` | Command/Auto | INFO |
| `OVERRIDE_ACTIVE` | Dashboard | INFO |
| `OVERRIDE_CLEARED` | Dashboard | INFO |
| `MQTT_RECONNECTED` | ESP32 | INFO |
| `FAULT` | System error | ERROR |
| `OFFLINE` | LWT | ERROR |

---

### 3.6 `iot55/device01/relay/state` — Relay State Feedback

```json
{
  "device_id": "device01",
  "timestamp": "2026-09-09T22:05:31+07:00",
  "state": "OFF",
  "changed_by": "AUTO_RULE1",
  "previous_state": "ON"
}
```

---

### 3.7 `iot55/device01/cmd/relay` — Relay Command (Downlink)

```json
{
  "command": "OFF",
  "source": "DASHBOARD",
  "timestamp": "2026-09-09T22:05:29+07:00",
  "correlation_id": "cmd-20260909-220529-001"
}
```

| `command` values | Meaning |
|-----------------|---------|
| `"ON"` | Turn relay ON |
| `"OFF"` | Turn relay OFF |

| `source` values | Meaning |
|-----------------|---------|
| `"DASHBOARD"` | Manual user click |
| `"AUTO_RULE1"` | RULE 1 automation |
| `"AUTO_RULE3"` | RULE 3 safety action |
| `"SCHEDULER"` | Time-based trigger |
| `"OVERRIDE"` | Manual override |

---

### 3.8 `iot55/device01/cmd/mode` — Mode Command (Downlink)

```json
{
  "mode": "AUTO",
  "source": "DASHBOARD",
  "timestamp": "2026-09-09T09:00:00+07:00"
}
```

| `mode` values | Meaning |
|---------------|---------|
| `"AUTO"` | Automation rules active |
| `"MANUAL"` | Automation suspended, manual control only |

---

### 3.9 `iot55/device01/cmd/override` — Override Command (Downlink)

```json
{
  "override": "ACTIVE",
  "duration_s": 1800,
  "source": "DASHBOARD",
  "timestamp": "2026-09-09T09:00:00+07:00"
}
```

| `override` values | Meaning |
|-------------------|---------|
| `"ACTIVE"` | Activate manual override |
| `"CLEAR"` | Clear manual override, return to AUTO |

---

### 3.10 `iot55/device01/cmd/threshold` — Threshold Update (Downlink)

```json
{
  "current_threshold_a": 12.5,
  "source": "DASHBOARD",
  "timestamp": "2026-09-09T09:00:00+07:00"
}
```

---

## 4. Invalid Payload Handling

When ESP32 or Node-RED receives a message it cannot parse:

1. **Log** the raw payload to event log with `event_type: "INVALID_PAYLOAD"`
2. **Ignore** — do not execute any action
3. **Do NOT crash** — continue normal operation
4. **Increment** an invalid payload counter (observable on dashboard)

Example invalid payload event:
```json
{
  "event_type": "INVALID_PAYLOAD",
  "topic": "iot55/device01/cmd/relay",
  "raw_payload": "turn it off plz",
  "error": "JSON parse failed",
  "timestamp": "2026-09-09T09:00:00+07:00"
}
```

---

## 5. QoS Strategy

| QoS Level | Used For | Reason |
|-----------|----------|--------|
| QoS 0 | Non-critical telemetry | Low overhead, acceptable data loss |
| QoS 1 | Commands, events, status | At-least-once delivery required |
| QoS 2 | Not used | Over-engineering for this scale |

---

## 6. Topic Retain Policy

| Topic | Retain | Reason |
|-------|--------|--------|
| `telemetry` | No | High frequency, no value in last retained |
| `current` | Yes | Dashboard sees latest on subscribe |
| `presence` | Yes | Dashboard sees latest on subscribe |
| `status` | Yes | Critical for offline detection |
| `relay/state` | Yes | Always know last relay state |
| `event` | No | Events are fire-and-forget |
| `cmd/*` | No (except mode, override, threshold) | Commands are transient |
| `cmd/mode` | Yes | ESP32 needs to know mode on reconnect |
| `cmd/override` | Yes | ESP32 needs to know override on reconnect |
| `cmd/threshold` | Yes | ESP32 needs threshold on reconnect |

---

*End of Document*
