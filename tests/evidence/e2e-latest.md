# E2E test evidence

Run: 2026-10-09T11:26:33.375Z | broker mqtt://localhost:1883 | API http://localhost:8080
Stack: Mosquitto + Node-RED + nginx (docker compose) with scripts/lib/virtual-device.js as the device.

| ID | Scenario | Result | Time | Evidence |
|---|---|---|---|---|
| TEST-01 | Normal operation | PASS | 0.3s | state=NORMAL relay=ON current=1.71A |
| TEST-02 | Closed + no presence + load ON -> auto shutdown | PASS | 10.9s | relay OFF on device after 10.9s (changed_by=AUTO_RULE1) |
| TEST-02b | Store opens after auto shutdown -> auto restore | PASS | 0.0s | relay ON on device (changed_by=AUTO_RESTORE) |
| TEST-03 | Closed + presence -> no shutdown | PASS | 14.3s | relay stayed ON for 14s while OCCUPIED |
| TEST-04 | Abnormal current -> alert -> ACK -> recovery | PASS | 0.3s | ABNORMAL_CURRENT, ALERT_ACKNOWLEDGED (buzzer silenced on device), CURRENT_NORMAL |
| TEST-05 | Remote relay OFF | PASS | 0.0s | HTTP 202, device relay OFF, relay/state confirmed |
| TEST-06 | Remote relay ON | PASS | 0.0s | HTTP 202, device relay ON, relay/state confirmed |
| TEST-07 | Manual override suspends auto shutdown | PASS | 14.1s | relay stayed ON for 14s with store CLOSED under override |
| TEST-08 | MQTT disconnect -> OFFLINE -> reconnect -> ONLINE | PASS | 0.1s | offline reason=LWT_OFFLINE, command while offline -> HTTP 503, recovered online |
| TEST-09 | Invalid payloads are rejected | PASS | 0.3s | malformed telemetry, bad relay command and bad threshold rejected; relay unchanged |
| TEST-10 | End-to-end threshold round trip (API -> MQTT -> device -> telemetry -> API) | PASS | 0.1s | device threshold=700, API threshold=900 |

**11/11 passed**
