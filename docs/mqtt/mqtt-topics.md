# MQTT — đặc tả topic & payload (bản triển khai)

Namespace: `iot55/device01/`. MQTT 3.1.1, QoS 1 cho subscribe/lệnh. Mọi payload là JSON UTF-8.
Thiết kế ban đầu (Week 1): [05-mqtt-design.md](05-mqtt-design.md). Tài liệu này là **nguồn sự thật** cho code hiện tại.

Trường chung do thiết bị gửi: `device_id`, `timestamp` (ISO-8601 UTC khi đã đồng bộ NTP, ngược lại `null`), `uptime_ms`.

## Uplink (ESP32 → broker)

### `telemetry` — 2 s/lần và ngay khi có thay đổi, không retained
```json
{
  "device_id": "device01", "timestamp": "2026-10-09T11:21:13Z", "uptime_ms": 532100,
  "current_signal": 350, "current_a": 1.71, "threshold_signal": 700, "threshold_a": 3.42,
  "presence": false, "pir_raw": false, "store_status": "OPEN", "relay": true,
  "mode": "AUTO", "override_active": false, "override_source": "NONE",
  "abnormal_current": false, "alarm_acknowledged": false, "wifi_rssi": -55, "fw": "2.0.0"
}
```
Node-RED bắt buộc: `device_id == "device01"`, `current_signal` nguyên 0..4095, `presence`/`relay` boolean, `store_status` ∈ {OPEN, CLOSED}.

### `current` (retained)
`{ device_id, timestamp, uptime_ms, current_signal, current_a, threshold_signal, abnormal }`

### `presence` (retained)
`{ device_id, timestamp, uptime_ms, state: "PRESENT" | "NONE" }`

### `status` (retained) + LWT
Khi kết nối: `{ device_id, timestamp, online: true, state: "ONLINE", fw, ip, wifi_rssi, mqtt_connects, mode, override_active, threshold_signal }`
LWT (broker tự gửi khi thiết bị mất kết nối, keepalive 15 s): `{"device_id":"device01","online":false,"state":"OFFLINE"}`

### `relay/state` (retained) — phản hồi sau mỗi lần đổi relay
`{ device_id, timestamp, uptime_ms, state: "ON" | "OFF", changed_by: "BOOT" | "DASHBOARD" | "AUTO_RULE1" | "AUTO_RESTORE" | "SAFETY_CUTOFF" | "LOCAL_FALLBACK" }`

### `event` (không retained) — event log có cấu trúc
```json
{
  "timestamp": "2026-10-09T11:21:13.120Z", "timestamp_ms": 1791544873120,
  "device_id": "device01", "origin": "middleware",
  "event_type": "AUTO_SHUTDOWN", "severity": "INFO", "reason": "AFTER_HOURS_NO_PRESENCE",
  "current_a": 1.71, "current_signal": 350, "state": "AFTER_HOURS"
}
```
`origin`: `device` (ESP32) hoặc `middleware` (Node-RED). `severity`: DEBUG, INFO, WARNING, ERROR, CRITICAL.

| Event | Origin | Khi nào |
|---|---|---|
| DEVICE_ONLINE / DEVICE_OFFLINE | middleware | status online / LWT hoặc heartbeat timeout |
| PRESENCE_DETECTED / PRESENCE_CLEARED | middleware | presence đổi |
| STORE_CLOSED / STORE_OPENED | middleware | store đổi (switch hoặc lịch) |
| AUTO_SHUTDOWN | middleware / device | rule 1 / fallback cục bộ khi mất MQTT |
| SHUTDOWN_CANCELLED | middleware | có người trong lúc đếm ngược |
| AUTO_RESTORE | middleware | mở cửa sau AUTO_SHUTDOWN |
| ABNORMAL_CURRENT / CURRENT_NORMAL | middleware | vượt ngưỡng / về dưới ngưỡng − 30 |
| SAFETY_CUTOFF | middleware | quá dòng khi `SAFETY_MODE=CUTOFF` |
| ALERT_ACKNOWLEDGED | middleware | ACK từ dashboard |
| MANUAL_OVERRIDE / OVERRIDE_CLEARED | middleware | override đổi (lý do = nguồn: LOCAL_BUTTON/REMOTE) |
| AUTOMATION_ENABLED / AUTOMATION_DISABLED | middleware | mode đổi |
| REMOTE_COMMAND | middleware | lệnh hợp lệ từ dashboard |
| RELAY_ON / RELAY_OFF | middleware | xác nhận từ `relay/state` |
| FAULT / FAULT_CLEARED | middleware | relay không phản hồi lệnh trong 10 s / đã phản hồi |
| INVALID_PAYLOAD | cả hai | JSON lỗi, sai schema, sai device_id |
| COMMAND_REJECTED | device | lệnh `AUTO_*` khi MANUAL/override |
| STATE_CHANGED | middleware | chuyển trạng thái FSM (DEBUG) |

### `system/state` (retained, Node-RED → )
Ảnh chụp trạng thái FSM: `{ online, state, store_status, store_switch, schedule_status, presence, relay, mode, override_active, current_signal, current_a, threshold_signal, alarm, fault, countdown_ms }`.

## Downlink (→ ESP32)

Trường tuỳ chọn ở mọi lệnh: `device_id` (nếu có phải là `device01`), `source`, `timestamp_ms`.

| Topic | Payload | Retained | Validate trên ESP32 |
|---|---|---|---|
| `cmd/relay` | `{"command":"ON"\|"OFF","source":"DASHBOARD"}` | không | `source` bắt đầu `AUTO` bị từ chối khi MANUAL/override |
| `cmd/mode` | `{"mode":"AUTO"\|"MANUAL"}` | **có** (khôi phục sau reboot) | |
| `cmd/override` | `{"override":"ACTIVE"\|"CLEAR"}` | không | |
| `cmd/threshold` | `{"threshold_signal": 900}` | **có** | số nguyên 1..4095 |
| `cmd/alarm` | `{"action":"ACK"}` | không | |

Lệnh sai → ESP32 không thay đổi trạng thái và phát `event` `INVALID_PAYLOAD` với `reason` cụ thể (vd. `RELAY_COMMAND_MUST_BE_ON_OR_OFF`).

## Thử bằng tay
```powershell
docker exec iot55-mosquitto mosquitto_sub -t 'iot55/device01/#' -v
docker exec iot55-mosquitto mosquitto_pub -t iot55/device01/cmd/relay -m '{"command":"OFF","source":"TEST"}'
docker exec iot55-mosquitto mosquitto_pub -t iot55/device01/cmd/relay -m 'not-json'
```
