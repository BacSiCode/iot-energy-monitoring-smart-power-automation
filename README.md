# IoT Project #55 — Energy Monitoring & Smart Power Automation System

> **Academic IoT Project | 4-Layer Architecture | ESP32 + MQTT + Node-RED**

[![Week](https://img.shields.io/badge/Week-1%20Architecture-blue)](docs/architecture/)
[![Status](https://img.shields.io/badge/Status-In%20Progress-yellow)](docs/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 📋 Project Overview

**Problem:** Retail stores waste significant electricity after closing hours — lights, fans, and other loads remain energised unnecessarily, increasing costs and carbon footprint.

**Solution:** An IoT-based system that:
- Continuously monitors electrical current drawn by store loads
- Detects human presence via PIR sensor
- Knows the store schedule (open / closed)
- Automatically shuts off loads when the store is closed **and** no presence is detected
- Provides a real-time dashboard and remote control interface
- Logs every automation event for audit and analysis

---

## 🏗️ 4-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4 — APPLICATION                                      │
│  Node-RED Dashboard · Remote Control · Alerts · Event Log   │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3 — MIDDLEWARE                                       │
│  Mosquitto MQTT Broker · Node-RED Engine                    │
│  Rules · Scheduler · State Machine · Event Logger           │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2 — NETWORK                                          │
│  ESP32 · Wi-Fi · MQTT Pub/Sub · JSON Payloads               │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1 — SENSING / PHYSICAL                               │
│  ACS712 Current Sensor · PIR Sensor · Relay · Buzzer/LED    │
│  Wokwi Simulation (primary) · Physical prototype (optional) │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
iot-energy-monitoring-smart-power-automation/
├── docs/
│   ├── architecture/          # System architecture documents
│   ├── requirements/          # FR, NFR, Use Cases, BOM
│   ├── mqtt/                  # MQTT topic & payload specs
│   ├── state-machine/         # State machine design
│   └── test-strategy/         # Test plan & test cases
├── simulation/wokwi/          # Wokwi diagram.json + sketch (Week 2)
├── firmware/esp32/            # PlatformIO project (Week 3–4)
├── middleware/
│   ├── node-red/              # Node-RED flows (Week 5)
│   └── mosquitto/             # Mosquitto config
├── dashboard/                 # Dashboard config & screenshots (Week 6)
├── tests/                     # Test scripts (Week 9)
├── screenshots/
├── videos/
├── .env.example
├── .gitignore
└── README.md
```

---

## 🔗 MQTT Namespace: `iot55/device01/`

| Direction | Topic | Purpose |
|-----------|-------|---------|
| Uplink | `iot55/device01/telemetry` | Combined sensor telemetry |
| Uplink | `iot55/device01/current` | Current reading |
| Uplink | `iot55/device01/presence` | PIR presence state |
| Uplink | `iot55/device01/status` | Device status |
| Uplink | `iot55/device01/event` | Automation events |
| Uplink | `iot55/device01/relay/state` | Relay state feedback |
| Downlink | `iot55/device01/cmd/relay` | Relay command |
| Downlink | `iot55/device01/cmd/mode` | Mode command |
| Downlink | `iot55/device01/cmd/override` | Override command |
| Downlink | `iot55/device01/cmd/threshold` | Threshold update |

---

## ⚙️ States: OFFLINE · NORMAL · AFTER_HOURS · OCCUPIED · AUTO_SHUTDOWN · ABNORMAL_CURRENT · MANUAL_OVERRIDE · FAULT

---

## 🗓️ Roadmap

| Week | Phase | Status |
|------|-------|--------|
| **1** | **Architecture** | ✅ **DONE** |
| 2 | Wokwi Simulation | ⬜ |
| 3 | ESP32 Firmware | ⬜ |
| 4 | Wi-Fi + MQTT | ⬜ |
| 5 | Node-RED Middleware | ⬜ |
| 6 | Dashboard | ⬜ |
| 7 | Automation + Edge Cases | ⬜ |
| 8 | End-to-End Integration | ⬜ |
| 9 | Testing + Documentation | ⬜ |
| 10 | Final Demo | ⬜ |

---

## 📚 Documentation Index

- [Problem Statement](docs/requirements/01-problem-statement.md)
- [Requirements & Use Cases](docs/requirements/02-requirements.md)
- [Hardware Spec & BOM](docs/bom/03-hardware-spec.md)
- [4-Layer Architecture](docs/architecture/04-architecture.md)
- [MQTT Design](docs/mqtt/05-mqtt-design.md)
- [State Machine](docs/state-machine/06-state-machine.md)
- [Automation Rules & Scheduler](docs/architecture/07-automation-rules.md)
- [Test Strategy](docs/test-strategy/08-test-strategy.md)
- [Roadmap & Rubric](docs/architecture/09-roadmap.md)

---

*IoT Project #55 | Academic | Week 1 Architecture Complete*
