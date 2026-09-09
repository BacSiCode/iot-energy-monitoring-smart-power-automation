# 10-Week Development Roadmap & Software Stack
## IoT Project #55 — Energy Monitoring & Smart Power Automation

**Document:** `docs/architecture/09-roadmap.md`
**Version:** 1.0
**Phase:** Week 1 — Architecture
**Date:** 2026-09-09

---

## 1. Software Stack

### 1.1 Complete Technology Stack

| Layer | Component | Version | Purpose |
|-------|-----------|---------|---------|
| **Simulation** | Wokwi | Online (latest) | Browser-based IoT simulation |
| **Firmware IDE** | VS Code + PlatformIO | Latest | ESP32 development environment |
| **Firmware Language** | C++ (Arduino framework) | — | ESP32 firmware |
| **Microcontroller** | ESP32 Arduino Core | 2.x | Board support package |
| **MQTT Library** | PubSubClient | 2.8.0 | MQTT client for ESP32 |
| **JSON Library** | ArduinoJson | 7.x | JSON serialisation/deserialisation |
| **Wi-Fi** | ESP32 built-in WiFi | — | Network connectivity |
| **MQTT Broker** | Mosquitto | 2.0.x | Local MQTT broker |
| **Automation** | Node-RED | 3.x | Flow-based automation engine |
| **Dashboard** | node-red-dashboard | 3.x | Web dashboard UI |
| **MQTT Client** | node-red-contrib-mqtt | built-in | Node-RED MQTT nodes |
| **Scheduling** | node-red-contrib-cron-plus | Latest | Advanced cron scheduling |
| **MQTT Debug** | MQTT Explorer | Latest | MQTT debugging GUI |
| **Version Control** | Git + GitHub | — | Source code management |
| **Optional** | Telegram Bot API | — | Push notifications |

### 1.2 Development Machine Setup

```
PC / Laptop:
├── VS Code (with PlatformIO extension)
├── Git
├── Node.js + npm (for Node-RED)
├── Mosquitto (running as local service)
├── Node-RED (npm package)
├── MQTT Explorer
└── Browser (for Wokwi + Node-RED Dashboard)

Network:
└── Wi-Fi router/AP (ESP32 connects here)
    └── All devices on same LAN
```

---

## 2. 10-Week Development Roadmap

### WEEK 1 — Architecture ← **CURRENT**

**Goal:** Complete design documentation. No code.

| Deliverable | Status |
|-------------|--------|
| Problem Statement | ✅ Done |
| Scope | ✅ Done |
| Functional Requirements | ✅ Done |
| Non-Functional Requirements | ✅ Done |
| Use Cases | ✅ Done |
| Sensor/Actuator Specification | ✅ Done |
| BOM | ✅ Done |
| 4-Layer Architecture | ✅ Done |
| System Data Flow | ✅ Done |
| MQTT Topic & Payload Design | ✅ Done |
| State Machine | ✅ Done |
| Automation Rules | ✅ Done |
| Scheduler Design | ✅ Done |
| Dashboard Requirements | ✅ Done |
| Error Scenarios | ✅ Done |
| Software Stack | ✅ Done |
| GitHub Structure | ✅ Done |
| 10-Week Roadmap | ✅ Done |
| Test Strategy | ✅ Done |
| Rubric Mapping | ✅ Done |
| Risks | ✅ Done |
| Definition of Done | ✅ Done |

**Exit Criteria:** All documents complete, GitHub repository initialized, WEEK 1 = PASS.

---

### WEEK 2 — Wokwi Simulation

**Goal:** Working Wokwi circuit with sensor simulation and firmware sketch.

**Tasks:**
- [ ] Create Wokwi `diagram.json` with ESP32, ACS712 (potentiometer), PIR (button), Relay (LED), Buzzer
- [ ] Write minimal ESP32 sketch: read sensors, print to Serial
- [ ] Verify all GPIO connections in simulation
- [ ] Test sensor reading logic (current RMS calculation, PIR debounce)
- [ ] Document simulation setup with screenshots

**Tools:** Wokwi online editor, VS Code

**Exit Criteria:** Simulation runs, sensors readable, relay toggle works.

---

### WEEK 3 — ESP32 Firmware (Core)

**Goal:** Complete firmware with state machine, sensor logic, relay control — no MQTT yet.

**Tasks:**
- [ ] PlatformIO project setup (`platformio.ini`)
- [ ] GPIO configuration and sensor reading functions
- [ ] ACS712 RMS calculation function
- [ ] PIR debounce with hold timeout
- [ ] State machine implementation (FSM struct)
- [ ] Relay control with fail-safe (default OFF)
- [ ] LED status indicator
- [ ] Serial logging of all state transitions
- [ ] Unit test: each sensor function in isolation

**Tools:** PlatformIO, VS Code, Wokwi

**Exit Criteria:** Firmware compiles, sensors read correctly, relay controlled by FSM.

---

### WEEK 4 — Wi-Fi + MQTT Integration

**Goal:** ESP32 publishes telemetry and subscribes to commands via MQTT.

**Tasks:**
- [ ] Wi-Fi connection with credentials from `config.h` (no hardcoding)
- [ ] MQTT client setup (PubSubClient)
- [ ] Publish telemetry to `iot55/device01/telemetry` (JSON, ArduinoJson)
- [ ] Subscribe to all `cmd/*` topics
- [ ] Parse and validate incoming JSON commands
- [ ] Invalid payload handling (log and ignore)
- [ ] MQTT LWT configuration
- [ ] Reconnect logic (Wi-Fi + MQTT, exponential backoff)
- [ ] Test T08 (disconnect/reconnect)
- [ ] Test T09 (invalid payload)
- [ ] Verify with MQTT Explorer

**Tools:** PlatformIO, Mosquitto (local), MQTT Explorer, Wokwi

**Exit Criteria:** Telemetry visible in MQTT Explorer, relay responds to cmd/relay.

---

### WEEK 5 — Node-RED Middleware

**Goal:** Node-RED flow processes telemetry, evaluates rules, manages state.

**Tasks:**
- [ ] Install Node-RED + required nodes
- [ ] MQTT in nodes for all uplink topics
- [ ] MQTT out nodes for all downlink topics
- [ ] State machine implementation in flow context
- [ ] RULE 1: Auto-shutdown logic (with delay)
- [ ] RULE 2: Presence protection
- [ ] RULE 3: Abnormal current alert
- [ ] RULE 4: Command relay + override handling
- [ ] Scheduler (cron inject nodes for open/close times)
- [ ] Event logger (timestamped JSON events)
- [ ] Test rules with `mosquitto_pub` CLI injection
- [ ] Export flow as `flows.json`

**Tools:** Node-RED, Mosquitto, MQTT Explorer

**Exit Criteria:** All 4 rules evaluated correctly, events logged, state machine functional.

---

### WEEK 6 — Dashboard

**Goal:** Complete Node-RED Dashboard with all required widgets.

**Tasks:**
- [ ] Install `node-red-dashboard`
- [ ] Widget W01: Current gauge
- [ ] Widget W02: Presence indicator
- [ ] Widget W03: Store status indicator
- [ ] Widget W04: Relay state indicator
- [ ] Widget W05: FSM state badge
- [ ] Widget W06: Event log (scrolling)
- [ ] Widget W07/W08: Relay ON/OFF buttons
- [ ] Widget W09/W10: AUTO/OVERRIDE buttons
- [ ] Widget W11: Threshold number input
- [ ] Widget W12: Current history chart
- [ ] Widget W13: Connection status indicator
- [ ] Test T05 (Remote OFF), T06 (Remote ON)
- [ ] Dashboard screenshots

**Tools:** Node-RED Dashboard, browser

**Exit Criteria:** All 13 widgets functional, remote control works.

---

### WEEK 7 — Automation & Edge Cases

**Goal:** Full automation, all abnormal scenarios tested.

**Tasks:**
- [ ] End-to-end test RULE 1 (T02)
- [ ] End-to-end test RULE 2 (T03)
- [ ] End-to-end test RULE 3 (T04)
- [ ] End-to-end test RULE 4 / override (T07)
- [ ] Hard safety cutoff (current > 2× threshold → relay OFF)
- [ ] Optional Telegram alerts
- [ ] Buzzer integration (if hardware/Wokwi)
- [ ] Edge case: store closes while relay OFF (no double-off event)
- [ ] Edge case: presence detected during auto-shutdown delay
- [ ] Fix all bugs found during testing

**Exit Criteria:** T02, T03, T04, T07 all PASS.

---

### WEEK 8 — End-to-End Integration

**Goal:** Full system integration across all 4 layers simultaneously.

**Tasks:**
- [ ] Connect Wokwi simulation to real Mosquitto broker
- [ ] Run Node-RED middleware against live simulation
- [ ] Dashboard shows live Wokwi data
- [ ] Execute T01 (normal operation)
- [ ] Execute T10 (full end-to-end scenario)
- [ ] Measure telemetry latency (target < 5 s end-to-end)
- [ ] Measure relay response time (target < 500 ms)
- [ ] Record demo video (first pass)

**Exit Criteria:** T01 and T10 PASS, latency targets met.

---

### WEEK 9 — Testing & Documentation

**Goal:** Complete test execution, final documentation.

**Tasks:**
- [ ] Execute all T01–T10 test cases
- [ ] Document all test results with screenshots
- [ ] Write final README updates
- [ ] Create system diagram (clean version)
- [ ] Write final report (if required by course)
- [ ] Code cleanup and comments
- [ ] `git tag v1.0.0`
- [ ] Final commit push

**Exit Criteria:** All 10 tests documented with PASS/FAIL results.

---

### WEEK 10 — Final Demo

**Goal:** Polished demo, all deliverables submitted.

**Tasks:**
- [ ] Record final demo video (5–10 min)
- [ ] Prepare demo script
- [ ] Final GitHub repository cleanup
- [ ] Verify all rubric items covered
- [ ] Submit

**Exit Criteria:** Demo recorded, repository public, submission complete.

---

## 3. GitHub Repository Structure

```
iot-energy-monitoring-smart-power-automation/
│
├── README.md                           ← Project overview
├── .gitignore                          ← Git ignores
├── .env.example                        ← Environment template
│
├── docs/
│   ├── architecture/
│   │   ├── 04-architecture.md          ← 4-layer architecture ✅ (Week 1)
│   │   └── 07-automation-rules.md      ← Rules & scheduler ✅ (Week 1)
│   ├── requirements/
│   │   ├── 01-problem-statement.md     ← Problem & scope ✅ (Week 1)
│   │   └── 02-requirements.md          ← FR, NFR, Use Cases ✅ (Week 1)
│   ├── mqtt/
│   │   └── 05-mqtt-design.md           ← MQTT topics & payloads ✅ (Week 1)
│   ├── state-machine/
│   │   └── 06-state-machine.md         ← State machine ✅ (Week 1)
│   ├── bom/
│   │   └── 03-hardware-spec.md         ← BOM & pinout ✅ (Week 1)
│   └── test-strategy/
│       └── 08-test-strategy.md         ← Test plan ✅ (Week 1)
│
├── simulation/
│   └── wokwi/
│       ├── diagram.json                ← Week 2
│       ├── sketch.ino                  ← Week 2
│       └── README.md                   ← Week 2
│
├── firmware/
│   └── esp32/
│       ├── platformio.ini              ← Week 3
│       ├── src/
│       │   ├── main.cpp                ← Week 3
│       │   ├── sensors.cpp             ← Week 3
│       │   ├── relay.cpp               ← Week 3
│       │   ├── state_machine.cpp       ← Week 3
│       │   └── mqtt_client.cpp         ← Week 4
│       ├── include/
│       │   ├── config.h                ← Week 3 (no credentials)
│       │   ├── sensors.h               ← Week 3
│       │   ├── relay.h                 ← Week 3
│       │   ├── state_machine.h         ← Week 3
│       │   └── mqtt_client.h           ← Week 4
│       └── lib/                        ← PlatformIO libraries
│
├── middleware/
│   ├── node-red/
│   │   ├── flows.json                  ← Week 5
│   │   └── README.md                   ← Week 5
│   └── mosquitto/
│       └── mosquitto.conf              ← Week 4
│
├── dashboard/
│   └── README.md                       ← Week 6
│
├── tests/
│   ├── test_results.md                 ← Week 9
│   └── inject_test.sh                  ← Week 9 (MQTT inject scripts)
│
├── screenshots/                        ← Week 6+
└── videos/                             ← Week 10
```

---

## 4. Rubric Mapping

| Rubric Item | Max Score | Our Approach | Target |
|-------------|-----------|-------------|--------|
| Simulation & Embedded | 20 | Wokwi primary demo + PlatformIO firmware | 20/20 |
| 4-Layer Architecture | 25 | Full 4-layer: Physical/Network/Middleware/App | 25/25 |
| Automation | 20 | 4 rules + scheduler + state machine | 20/20 |
| Application/Integration | 15 | Node-RED Dashboard + full MQTT flow | 15/15 |
| Demo/Stability | 10 | Rehearsed demo video + stable Wokwi | 10/10 |
| Report/Deliverables | 10 | Full doc set (Weeks 1–9) | 10/10 |
| Hardware bonus | +5 | Physical prototype with DC load | +5 |
| **TOTAL** | **105** | | **105/100** |

---

## 5. Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|-----------|
| R01 | Wokwi simulation doesn't connect to real MQTT | Medium | High | Use Wokwi's MQTT bridge or local broker IP |
| R02 | ESP32 ADC noise from ACS712 | High | Medium | Software averaging, voltage divider |
| R03 | Node-RED crashes lose state | Low | Medium | Persistent context storage |
| R04 | PIR false positives prevent auto-shutdown | Medium | Medium | Configurable hold timeout |
| R05 | MQTT QoS 1 message duplication | Low | Low | Idempotent command handling |
| R06 | Time drift / wrong timezone in scheduler | Low | High | Always use ISO-8601 + timezone in timestamps |
| R07 | Dashboard browser compatibility | Low | Low | Test on Chrome + Firefox |
| R08 | Hardware not available for Week 10 | Medium | Low | Simulation is primary — hardware is bonus |
| R09 | Mosquitto config issues on Windows | Medium | Medium | Use Docker or WSL for Mosquitto |
| R10 | Git merge conflicts if team | Low | Low | Feature branches + PR workflow |

---

*End of Document*
