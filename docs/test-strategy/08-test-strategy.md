# Test Strategy & Test Cases
## IoT Project #55 — Energy Monitoring & Smart Power Automation

**Document:** `docs/test-strategy/08-test-strategy.md`
**Version:** 1.0
**Phase:** Week 1 — Architecture (Test Planning)
**Date:** 2026-09-09

---

## 1. Test Strategy Overview

### 1.1 Testing Philosophy

- **Test early, test often** — tests are defined before implementation (TDD intent)
- **Simulation first** — all tests run against Wokwi simulation before hardware
- **Automated where possible** — use MQTT scripts to inject test stimuli
- **Document evidence** — every test result includes screenshot or video

### 1.2 Test Environment

| Component | Tool |
|-----------|------|
| Sensor simulation | Wokwi (browser-based) |
| MQTT testing | MQTT Explorer |
| MQTT injection | `mosquitto_pub` CLI |
| Monitoring | Node-RED debug nodes |
| Evidence | OBS screen recorder / screenshots |

---

## 2. Test Cases

### T01 — Normal Operation

| Field | Value |
|-------|-------|
| **ID** | T01 |
| **Name** | Normal Store Operation |
| **Objective** | Verify that during open hours, relay stays ON and dashboard shows green |
| **Precondition** | System powered, MQTT connected, store status = OPEN |
| **Steps** | 1. Observe telemetry publishing every 2 s<br>2. Verify current reading on dashboard<br>3. Verify relay state = ON<br>4. Verify state = NORMAL<br>5. Verify presence indicator updating |
| **Expected** | All dashboard widgets show correct green/ON state |
| **Pass Criteria** | Telemetry received, relay ON, no alerts |
| **Week** | 8 |

---

### T02 — Auto-Shutdown (RULE 1)

| Field | Value |
|-------|-------|
| **ID** | T02 |
| **Name** | Closed + No Presence + Load ON → Auto OFF |
| **Objective** | Verify RULE 1 fires correctly |
| **Precondition** | System online, mode = AUTO, relay = ON, presence = NONE |
| **Steps** | 1. Inject MQTT: set store_status = CLOSED<br>2. Ensure presence = NONE<br>3. Wait for `AUTO_SHUTDOWN_DELAY` (60 s)<br>4. Observe `cmd/relay` message published with `"command": "OFF"`<br>5. Verify relay turns OFF<br>6. Verify event logged: AUTO_SHUTDOWN<br>7. Verify dashboard shows AUTO_SHUTDOWN state |
| **Expected** | Relay OFF, event logged, dashboard updated |
| **Pass Criteria** | Relay = OFF within delay + 5 s tolerance |
| **Week** | 7 |

---

### T03 — Presence Protects Load (RULE 2)

| Field | Value |
|-------|-------|
| **ID** | T03 |
| **Name** | Closed + Presence → Keep ON |
| **Objective** | Verify RULE 2 prevents auto-shutdown when presence detected |
| **Precondition** | Store = CLOSED, relay = ON |
| **Steps** | 1. Inject MQTT: set store_status = CLOSED<br>2. Simulate PIR trigger (presence = PRESENT)<br>3. Wait longer than AUTO_SHUTDOWN_DELAY<br>4. Observe no `cmd/relay` OFF published<br>5. Verify state = OCCUPIED<br>6. Verify relay remains ON |
| **Expected** | Relay stays ON, state = OCCUPIED |
| **Pass Criteria** | No AUTO_SHUTDOWN event generated |
| **Week** | 7 |

---

### T04 — Abnormal Current Alert (RULE 3)

| Field | Value |
|-------|-------|
| **ID** | T04 |
| **Name** | Current > Threshold → Alert |
| **Objective** | Verify RULE 3 fires on high current |
| **Precondition** | System online, current_threshold = 10.0 A |
| **Steps** | 1. Simulate current = 11.5 A (via Wokwi potentiometer or MQTT inject)<br>2. Observe ABNORMAL_CURRENT event published<br>3. Verify dashboard shows RED alert<br>4. Verify state = ABNORMAL_CURRENT<br>5. Simulate current = 8.0 A (back to normal)<br>6. Verify state returns to previous state |
| **Expected** | Alert fires at > 10A, clears when ≤ 10A |
| **Pass Criteria** | ABNORMAL_CURRENT event within 5 s of threshold breach |
| **Week** | 7 |

---

### T05 — Remote Relay OFF

| Field | Value |
|-------|-------|
| **ID** | T05 |
| **Name** | Dashboard Remote OFF |
| **Objective** | Verify dashboard button turns relay OFF |
| **Precondition** | Relay = ON, system online |
| **Steps** | 1. Click "Relay OFF" button on dashboard<br>2. Observe `cmd/relay` published with `"command": "OFF"`<br>3. Verify ESP32 turns relay OFF<br>4. Verify `relay/state` published with `"state": "OFF"`<br>5. Verify dashboard updates |
| **Expected** | Relay OFF within 500 ms |
| **Pass Criteria** | Relay physically/simulatedly OFF |
| **Week** | 6 |

---

### T06 — Remote Relay ON

| Field | Value |
|-------|-------|
| **ID** | T06 |
| **Name** | Dashboard Remote ON |
| **Objective** | Verify dashboard button turns relay ON |
| **Precondition** | Relay = OFF, system online |
| **Steps** | 1. Click "Relay ON" button on dashboard<br>2. Observe `cmd/relay` published with `"command": "ON"`<br>3. Verify ESP32 turns relay ON<br>4. Verify dashboard updates to ON |
| **Expected** | Relay ON within 500 ms |
| **Pass Criteria** | Relay physically/simulatedly ON |
| **Week** | 6 |

---

### T07 — Manual Override

| Field | Value |
|-------|-------|
| **ID** | T07 |
| **Name** | Manual Override Suspends Automation |
| **Objective** | Verify override prevents RULE 1 from firing |
| **Precondition** | Store = CLOSED, relay = ON, presence = NONE |
| **Steps** | 1. Activate OVERRIDE from dashboard<br>2. Verify state = MANUAL_OVERRIDE<br>3. Wait for AUTO_SHUTDOWN_DELAY to elapse<br>4. Verify NO auto-shutdown occurs<br>5. Manually turn relay OFF from dashboard<br>6. Clear override<br>7. Verify automation resumes |
| **Expected** | Automation suspended during override |
| **Pass Criteria** | No automated actions while override active |
| **Week** | 7 |

---

### T08 — MQTT Disconnect / Reconnect

| Field | Value |
|-------|-------|
| **ID** | T08 |
| **Name** | ESP32 Reconnects After Network Loss |
| **Objective** | Verify MQTT reconnect without manual intervention |
| **Precondition** | System operational |
| **Steps** | 1. Disconnect Wi-Fi (or stop Mosquitto temporarily)<br>2. Verify LWT publishes `{"online": false, "state": "OFFLINE"}`<br>3. Verify dashboard shows OFFLINE<br>4. Reconnect Wi-Fi / restart Mosquitto<br>5. Verify ESP32 reconnects within 10 s<br>6. Verify telemetry resumes<br>7. Verify dashboard shows ONLINE |
| **Expected** | System recovers automatically |
| **Pass Criteria** | Reconnect within 10 s, telemetry resumes |
| **Week** | 4 |

---

### T09 — Invalid MQTT Payload

| Field | Value |
|-------|-------|
| **ID** | T09 |
| **Name** | Invalid Payload Handled Gracefully |
| **Objective** | Verify system ignores malformed messages without crashing |
| **Precondition** | System operational |
| **Steps** | 1. Publish malformed JSON to `cmd/relay`: `"turn off pls"`<br>2. Publish empty payload to `cmd/relay`<br>3. Publish valid JSON with unknown command: `{"command": "EXPLODE"}`<br>4. Verify ESP32 does NOT crash<br>5. Verify relay state unchanged<br>6. Verify INVALID_PAYLOAD event logged |
| **Expected** | System continues operating, error logged |
| **Pass Criteria** | No crash, no relay state change, error event published |
| **Week** | 4 |

---

### T10 — Full End-to-End Test

| Field | Value |
|-------|-------|
| **ID** | T10 |
| **Name** | Complete System Integration Test |
| **Objective** | Verify all 4 layers work together in a realistic scenario |
| **Precondition** | All layers running: Wokwi + MQTT + Node-RED + Dashboard |
| **Steps** | 1. Start from clean state<br>2. Simulate store OPEN (08:00)<br>3. Verify NORMAL state, relay ON<br>4. Simulate high current → verify ABNORMAL_CURRENT<br>5. Resolve current → verify recovery<br>6. Simulate store CLOSE (22:00)<br>7. Verify AFTER_HOURS state<br>8. Confirm presence = NONE → verify AUTO_SHUTDOWN<br>9. Simulate presence → verify OCCUPIED (load stays OFF from shutdown)<br>10. Remotely turn relay ON manually<br>11. Activate override, confirm automation paused<br>12. Clear override, confirm automation resumes<br>13. Simulate network disconnect → verify offline<br>14. Reconnect → verify recovery |
| **Expected** | All 14 steps pass, events logged, dashboard accurate throughout |
| **Pass Criteria** | All steps complete without manual debugging |
| **Week** | 8 |

---

## 3. Test Execution Matrix

| Test ID | Layer | Phase | Method | Status |
|---------|-------|-------|--------|--------|
| T01 | All | Week 8 | Manual + MQTT Explorer | ⬜ Not started |
| T02 | All | Week 7 | MQTT inject + observation | ⬜ Not started |
| T03 | All | Week 7 | MQTT inject + observation | ⬜ Not started |
| T04 | All | Week 7 | Wokwi pot + observation | ⬜ Not started |
| T05 | L2+L3+L4 | Week 6 | Dashboard click | ⬜ Not started |
| T06 | L2+L3+L4 | Week 6 | Dashboard click | ⬜ Not started |
| T07 | L3+L4 | Week 7 | Dashboard click | ⬜ Not started |
| T08 | L2+L3 | Week 4 | Network kill/restore | ⬜ Not started |
| T09 | L2+L3 | Week 4 | `mosquitto_pub` CLI | ⬜ Not started |
| T10 | All | Week 8 | Full scenario | ⬜ Not started |

---

*End of Document*
