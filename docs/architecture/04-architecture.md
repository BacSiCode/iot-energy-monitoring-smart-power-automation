# 4-Layer System Architecture & Data Flow
## IoT Project #55 — Energy Monitoring & Smart Power Automation

**Document:** `docs/architecture/04-architecture.md`
**Version:** 1.0
**Phase:** Week 1 — Architecture
**Date:** 2026-09-09

---

## 1. Architecture Overview

The system is structured as a **4-layer IoT architecture** following the standard
sensing → network → middleware → application stack.

```
╔══════════════════════════════════════════════════════════════════════╗
║                    LAYER 4 — APPLICATION                            ║
║                                                                      ║
║   ┌──────────────────────────────────────────────────────────────┐  ║
║   │                  Node-RED Dashboard                          │  ║
║   │                                                              │  ║
║   │  [Current Gauge] [Presence] [Store Status] [Relay State]    │  ║
║   │  [Mode/State]    [Event Log] [Relay ON] [Relay OFF]         │  ║
║   │  [AUTO Mode]     [OVERRIDE]  [Threshold Input]              │  ║
║   └──────────────────────────────────────────────────────────────┘  ║
╠══════════════════════════════════════════════════════════════════════╣
║                   LAYER 3 — MIDDLEWARE                              ║
║                                                                      ║
║  ┌─────────────────────┐    ┌──────────────────────────────────┐   ║
║  │  Mosquitto          │    │  Node-RED Engine                 │   ║
║  │  MQTT Broker        │◄──►│                                  │   ║
║  │                     │    │  ┌──────────┐  ┌─────────────┐  │   ║
║  │  Port 1883 (MQTT)   │    │  │ Rules    │  │ Scheduler   │  │   ║
║  │  Port 9001 (WS)     │    │  │ Engine   │  │ (open/close)│  │   ║
║  └─────────────────────┘    │  └──────────┘  └─────────────┘  │   ║
║                             │  ┌──────────┐  ┌─────────────┐  │   ║
║                             │  │ State    │  │ Event       │  │   ║
║                             │  │ Machine  │  │ Logger      │  │   ║
║                             │  └──────────┘  └─────────────┘  │   ║
║                             └──────────────────────────────────┘   ║
╠══════════════════════════════════════════════════════════════════════╣
║                    LAYER 2 — NETWORK                                ║
║                                                                      ║
║            ┌────────────────────────────────────┐                   ║
║            │           ESP32                    │                   ║
║            │                                    │                   ║
║            │  Wi-Fi 802.11 b/g/n               │                   ║
║            │  MQTT Client (PubSubClient)        │                   ║
║            │  JSON Serialisation (ArduinoJson)  │                   ║
║            │  LWT (Last Will & Testament)       │                   ║
║            └────────────────────────────────────┘                   ║
╠══════════════════════════════════════════════════════════════════════╣
║                  LAYER 1 — SENSING / PHYSICAL                       ║
║                                                                      ║
║  ┌──────────────┐  ┌──────────────┐  ┌────────┐  ┌─────────────┐  ║
║  │ ACS712       │  │ HC-SR501     │  │ Relay  │  │ LED / Buzzer│  ║
║  │ Current      │  │ PIR Presence │  │ Module │  │ (Status)    │  ║
║  │ Sensor       │  │ Sensor       │  │        │  │             │  ║
║  │ (Analogue)   │  │ (Digital)    │  │(Output)│  │  (Output)   │  ║
║  └──────────────┘  └──────────────┘  └────────┘  └─────────────┘  ║
║                                                                      ║
║           [Wokwi Simulation — Primary Demonstration]                ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 2. Component Responsibilities

### Layer 1 — Sensing / Physical

| Component | Responsibility |
|-----------|----------------|
| ACS712 | Measures load current (RMS), analogue output → ADC |
| HC-SR501 PIR | Detects human presence, digital output |
| Relay Module | Energises/de-energises controlled load |
| Status LED | Mirrors relay state for visual feedback |
| Buzzer | Audible alert on ABNORMAL_CURRENT |
| Wokwi Sim | Replicates all physical components in browser |

### Layer 2 — Network

| Component | Responsibility |
|-----------|----------------|
| ESP32 | Reads sensors, controls actuators, MQTT client |
| Wi-Fi | Transport medium between ESP32 and broker |
| MQTT Client | Pub/Sub for telemetry uplink and command downlink |
| ArduinoJson | Serialises/deserialises JSON payloads |
| LWT | Publishes OFFLINE status on unexpected disconnect |

### Layer 3 — Middleware

| Component | Responsibility |
|-----------|----------------|
| Mosquitto | MQTT broker — routes all messages |
| Node-RED | Flow-based automation engine |
| Rules Engine | Evaluates RULE 1–4 on incoming telemetry |
| Scheduler | Triggers OPEN/CLOSE transitions at configured times |
| State Machine | Maintains authoritative system state |
| Event Logger | Appends timestamped events to log |

### Layer 4 — Application

| Component | Responsibility |
|-----------|----------------|
| Dashboard UI | Real-time display of all system metrics |
| Control Panel | Remote relay ON/OFF/AUTO/OVERRIDE buttons |
| Event Log Widget | Scrolling display of recent events |
| Threshold Config | Allows dynamic threshold adjustment |

---

## 3. System Data Flow

### 3.1 Uplink Flow (Sensor → Application)

```
ACS712 / PIR Sensor
        │
        ▼ [Analogue/Digital read, every 1-5 s]
   ESP32 Firmware
        │
        ▼ [JSON serialisation]
        │  {"current": 4.2, "presence": "PRESENT", "relay": "ON", ...}
        │
        ▼ [MQTT Publish]
   iot55/device01/telemetry
        │
        ▼ [TCP/IP over Wi-Fi]
   Mosquitto MQTT Broker
        │
        ▼ [Node-RED subscribes]
   Node-RED
        │
        ├─► [State Machine update]
        │
        ├─► [Rules Engine evaluation]
        │       │
        │       ├─ RULE 1 match? → publish cmd/relay = OFF
        │       ├─ RULE 2 match? → do nothing
        │       └─ RULE 3 match? → alert + state = ABNORMAL_CURRENT
        │
        ├─► [Event Logger → append to log]
        │
        └─► [Dashboard update → UI widgets refresh]
```

### 3.2 Downlink Flow (Application → Actuator)

```
Dashboard Button (or Scheduler or Rule)
        │
        ▼
   Node-RED
        │
        ▼ [JSON command payload]
        │  {"relay": "OFF", "source": "AUTO_RULE1", "timestamp": "..."}
        │
        ▼ [MQTT Publish]
   iot55/device01/cmd/relay
        │
        ▼ [TCP/IP over Wi-Fi]
   Mosquitto MQTT Broker
        │
        ▼ [ESP32 subscribes]
   ESP32 Firmware
        │
        ▼ [Parse JSON, validate command]
        │
        ▼ [digitalWrite to Relay]
   Relay Module → Load ON or OFF
        │
        ▼ [Publish acknowledgement]
   iot55/device01/relay/state
```

### 3.3 Schedule-Triggered Flow

```
Node-RED Scheduler (cron: "0 22 * * *" = 22:00)
        │
        ▼ [Store status → CLOSED]
        │
        ▼ [Inject into Rules Engine]
        │
        ▼ [RULE 1 evaluated with current state snapshot]
        │
        └─► [If match → AUTO_SHUTDOWN sequence]
```

---

## 4. Physical Connection Diagram

```
                    ┌─────────────────────────────────────────┐
                    │           ESP32 Dev Board               │
                    │                                         │
 ACS712 OUT ──────►│ GPIO34 (ADC)    GPIO26 ►─────── Relay IN│
                    │                                         │
 PIR OUT ─────────►│ GPIO27          GPIO2 ►──────── LED     │
                    │                                         │
                    │                GPIO25 ►──────── Buzzer  │
                    │                                         │
 3.3V ─────────────│ 3.3V                                    │
 GND ──────────────│ GND                                     │
                    │                                         │
 USB (5V) ─────────│ VIN                                     │
                    └──────────────┬──────────────────────────┘
                                   │
                              Wi-Fi 802.11
                                   │
                         ┌─────────▼─────────┐
                         │  Wi-Fi Router/AP  │
                         └─────────┬─────────┘
                                   │
                              TCP/IP LAN
                                   │
                    ┌──────────────▼──────────────┐
                    │   PC / Server               │
                    │                             │
                    │  ┌───────────┐ ┌──────────┐ │
                    │  │Mosquitto  │ │Node-RED  │ │
                    │  │:1883      │ │:1880     │ │
                    │  └───────────┘ └──────────┘ │
                    └─────────────────────────────┘
```

---

## 5. Wokwi Simulation Architecture

The Wokwi simulation replicates all physical components:

| Physical | Wokwi Replacement |
|----------|-------------------|
| ACS712 current sensor | Potentiometer (analogue 0–3.3V) |
| HC-SR501 PIR | Push button (momentary HIGH) |
| Relay module | LED (green = ON, off = OFF) |
| Load (fan/light) | Second LED as load indicator |
| Buzzer | Wokwi Buzzer component |
| Status LED | Wokwi LED component |

Wokwi connects to a **real Mosquitto broker** via the Wokwi firmware's Wi-Fi simulation layer, enabling full end-to-end testing from simulation to Node-RED dashboard.

---

*End of Document*
