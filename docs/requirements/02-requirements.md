# Functional & Non-Functional Requirements
## IoT Project #55 — Energy Monitoring & Smart Power Automation

**Document:** `docs/requirements/02-requirements.md`
**Version:** 1.0
**Phase:** Week 1 — Architecture
**Date:** 2026-09-09

---

## 1. Functional Requirements

### FR-SENSE — Sensing Layer

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-S01 | The system SHALL read RMS current from the ACS712 sensor at a minimum interval of 1 second. | Must |
| FR-S02 | The system SHALL detect presence/no-presence from a PIR sensor. | Must |
| FR-S03 | The system SHALL de-bounce PIR readings with a configurable hold-time (default 300 s). | Must |
| FR-S04 | The system SHALL control a relay output to energise or de-energise the monitored load. | Must |
| FR-S05 | The system SHALL indicate relay state via an onboard LED. | Should |
| FR-S06 | The system SHALL sound a buzzer for alert events. | Could |

### FR-NET — Network Layer

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-N01 | The ESP32 SHALL connect to Wi-Fi using credentials stored in configuration (not hardcoded). | Must |
| FR-N02 | The ESP32 SHALL publish sensor telemetry to the MQTT broker at a configurable interval. | Must |
| FR-N03 | The ESP32 SHALL subscribe to command topics and execute received commands. | Must |
| FR-N04 | The ESP32 SHALL automatically reconnect to Wi-Fi and MQTT broker after disconnection. | Must |
| FR-N05 | The ESP32 SHALL publish an OFFLINE status message using an MQTT Last Will & Testament. | Must |
| FR-N06 | The ESP32 SHALL ignore and log invalid/malformed MQTT payloads. | Must |

### FR-MIDDLE — Middleware Layer

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-M01 | Node-RED SHALL receive all MQTT telemetry and maintain current system state. | Must |
| FR-M02 | Node-RED SHALL evaluate RULE 1 (closed + no presence + load ON → auto OFF). | Must |
| FR-M03 | Node-RED SHALL evaluate RULE 2 (closed + presence → keep ON). | Must |
| FR-M04 | Node-RED SHALL evaluate RULE 3 (current > threshold → abnormal alert). | Must |
| FR-M05 | Node-RED SHALL implement a scheduler that transitions store status at configured open/close times. | Must |
| FR-M06 | Node-RED SHALL log every automation event with timestamp, type, and state snapshot. | Must |
| FR-M07 | Node-RED SHALL publish relay commands to the ESP32 via MQTT downlink. | Must |
| FR-M08 | Node-RED SHALL respect MANUAL_OVERRIDE mode — automation rules SHALL NOT fire while override is active. | Must |
| FR-M09 | Node-RED SHALL maintain and publish the current state machine state. | Must |
| FR-M10 | Node-RED SHALL send Telegram alerts on ABNORMAL_CURRENT and AUTO_SHUTDOWN events (optional). | Could |

### FR-APP — Application / Dashboard Layer

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-A01 | The dashboard SHALL display real-time current (A) as a gauge or chart. | Must |
| FR-A02 | The dashboard SHALL display presence state (PRESENT / NONE). | Must |
| FR-A03 | The dashboard SHALL display store status (OPEN / CLOSED). | Must |
| FR-A04 | The dashboard SHALL display relay state (ON / OFF). | Must |
| FR-A05 | The dashboard SHALL display the current system mode / state machine state. | Must |
| FR-A06 | The dashboard SHALL display a scrolling event log. | Must |
| FR-A07 | The dashboard SHALL provide buttons: Relay ON / Relay OFF / AUTO / MANUAL OVERRIDE. | Must |
| FR-A08 | The dashboard SHALL provide a configurable threshold input for abnormal current. | Should |
| FR-A09 | The dashboard SHALL display a connection status indicator for the ESP32. | Should |
| FR-A10 | The dashboard SHALL display a historical current chart (last 60 readings). | Should |

---

## 2. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Telemetry publish interval ≤ 5 s in normal mode. |
| NFR-02 | Performance | Relay response time from MQTT command to physical state change ≤ 500 ms. |
| NFR-03 | Reliability | MQTT reconnect within 10 s after disconnection. |
| NFR-04 | Reliability | System recovers to last known state after ESP32 power cycle. |
| NFR-05 | Security | No credentials hardcoded in firmware or Node-RED flows. |
| NFR-06 | Security | MQTT credentials loaded from environment variables / config files. |
| NFR-07 | Maintainability | All thresholds and schedule configurable without firmware reflash. |
| NFR-08 | Maintainability | Node-RED flows documented with node comments. |
| NFR-09 | Usability | Dashboard renders correctly on 1080p desktop browser. |
| NFR-10 | Portability | Firmware compiles for ESP32 (any variant) via PlatformIO. |
| NFR-11 | Observability | All state transitions logged with ISO-8601 timestamps. |
| NFR-12 | Safety | System defaults to relay OFF (fail-safe) on FAULT or OFFLINE. |

---

## 3. Use Cases

### UC-01: Normal Store Operation

| Field | Value |
|-------|-------|
| **Actor** | Store system (automated) |
| **Trigger** | Store open time reached |
| **Precondition** | System powered, MQTT connected |
| **Flow** | 1. Scheduler sets store status = OPEN<br>2. State transitions to NORMAL<br>3. Relay remains ON<br>4. Dashboard shows green status |
| **Postcondition** | Load energised, monitoring active |

### UC-02: Auto-Shutdown After Closing

| Field | Value |
|-------|-------|
| **Actor** | Store system (automated) |
| **Trigger** | Store close time reached |
| **Precondition** | Store = CLOSED, Presence = NONE, Relay = ON |
| **Flow** | 1. Scheduler sets store status = CLOSED<br>2. RULE 1 evaluates → triggers AUTO_SHUTDOWN<br>3. Node-RED publishes cmd/relay = OFF<br>4. ESP32 turns relay OFF<br>5. Event logged<br>6. Dashboard updated |
| **Postcondition** | Load de-energised, event logged |

### UC-03: Staff Present After Closing

| Field | Value |
|-------|-------|
| **Actor** | Staff member + system |
| **Trigger** | PIR detects presence after close time |
| **Precondition** | Store = CLOSED, Relay = ON |
| **Flow** | 1. PIR triggers PRESENT<br>2. State transitions to OCCUPIED<br>3. RULE 2 fires → load stays ON<br>4. Dashboard shows OCCUPIED state |
| **Postcondition** | Load remains ON while presence detected |

### UC-04: Abnormal Current Alert

| Field | Value |
|-------|-------|
| **Actor** | System |
| **Trigger** | Current reading exceeds configured threshold |
| **Flow** | 1. ESP32 reads current > threshold<br>2. Publishes telemetry<br>3. Node-RED evaluates RULE 3<br>4. State → ABNORMAL_CURRENT<br>5. Alert sent (dashboard + optional Telegram)<br>6. Event logged |
| **Postcondition** | Alert active until current drops below threshold |

### UC-05: Remote Control via Dashboard

| Field | Value |
|-------|-------|
| **Actor** | Store manager (human) |
| **Trigger** | Manager clicks relay ON/OFF button |
| **Flow** | 1. Manager clicks button on dashboard<br>2. Node-RED publishes cmd/relay<br>3. ESP32 subscribes and acts<br>4. Relay state updated<br>5. Dashboard reflects new state |
| **Postcondition** | Relay state matches manager's command |

### UC-06: Manual Override

| Field | Value |
|-------|-------|
| **Actor** | Store manager (human) |
| **Trigger** | Manager activates OVERRIDE mode |
| **Flow** | 1. Manager activates override<br>2. State → MANUAL_OVERRIDE<br>3. All automation rules suspended<br>4. Manager manually controls relay<br>5. Override deactivated → return to AUTO mode |
| **Postcondition** | Automation resumes after override cleared |

### UC-07: MQTT Reconnection

| Field | Value |
|-------|-------|
| **Actor** | System |
| **Trigger** | Wi-Fi or broker connection lost |
| **Flow** | 1. Connection lost detected<br>2. LWT publishes OFFLINE status<br>3. ESP32 attempts reconnect every 5 s<br>4. On success: re-subscribes, publishes current state |
| **Postcondition** | System operational with no manual intervention |

---

*End of Document*
