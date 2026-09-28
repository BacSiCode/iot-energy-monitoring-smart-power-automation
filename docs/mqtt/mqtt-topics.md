# MQTT Topics thực tế

Prefix: `iot55/device01/`.

| Topic | Publisher | Payload chính |
|---|---|---|
| `telemetry` | ESP32 | `device_id`, `current_signal`, `presence`, `store_status`, `relay`, `mode` |
| `current` | ESP32 | `current_signal`, `threshold_signal`, `abnormal` |
| `presence` | ESP32 | `state`: `PRESENT` hoặc `NONE` |
| `status` | ESP32/Node-RED | `online`, `store_status`, `state`, `mode` |
| `event` | ESP32/Node-RED | `event_type`, `severity`, `description` |
| `relay/state` | ESP32 | `state`: `ON` hoặc `OFF` |
| `cmd/relay` | Node-RED | `command`: `ON` hoặc `OFF` |
| `cmd/mode` | Node-RED | `mode`: `AUTO` hoặc `MANUAL` |
| `cmd/override` | Node-RED | `override`: `ACTIVE` hoặc `CLEAR` |
| `cmd/threshold` | Node-RED | `threshold_signal`: integer 1..4095 |

ESP32 đặt LWT retained trên `status` với `online=false` và `state=OFFLINE`. Payload lạ hoặc command ngoài danh sách hợp lệ bị bỏ qua và phát event `INVALID_PAYLOAD`.