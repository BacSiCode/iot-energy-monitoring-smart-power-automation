# Node-RED middleware — IoT 55

## Cấu trúc
```
src/state-engine.js   validate · FSM · rule 1-5 · scheduler · heartbeat · FAULT · event log · HTTP command
src/api-state.js      GET /api/state
src/api-command.js    POST /api/command → state engine
flows.json            SINH TỰ ĐỘNG bởi scripts/build-flows.js (không sửa tay)
settings.js           cấu hình, secrets lấy từ biến môi trường
```
Sau khi sửa `src/*.js`: `npm run build` rồi `docker compose restart nodered`. `npm test` chạy đúng mã nguồn này.

## Flow
```
mqtt in telemetry ┐
mqtt in status    ├─► State engine ─┬─► out 1: cmd/*            (mqtt out, qos/retain theo từng msg)
mqtt in event     │   (function,     ├─► out 2: event            (mqtt out + debug)
mqtt in relay/state┘   4 outputs)    ├─► out 3: system/state     (mqtt out, retained)
inject tick 5 s ──────►              └─► out 4: HTTP response
POST /api/command ──► To state engine ─┘
GET  /api/state   ──► Read state ──► HTTP response
catch ──► debug (lỗi runtime)
```
Node-RED không subscribe `cmd/*` (tránh vòng lặp); event do chính nó phát (`origin: middleware`) bị bỏ qua khi nhận lại.

## Biến môi trường
| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `MQTT_HOST`, `MQTT_PORT` | `mosquitto`, `1883` | broker (dùng trong mqtt-broker node qua `${MQTT_HOST}`) |
| `STORE_STATUS_SOURCE` | `SWITCH` | `SWITCH` = công tắc trên mạch, `SCHEDULE` = theo giờ |
| `STORE_OPEN_TIME`, `STORE_CLOSE_TIME` | `08:00`, `22:00` | lịch (hỗ trợ qua nửa đêm), múi giờ `TZ` |
| `AUTO_SHUTDOWN_DELAY_SECONDS` | `10` | debounce rule 1 |
| `DEVICE_TIMEOUT_SECONDS` | `15` | không có tin nhắn → OFFLINE |
| `SAFETY_MODE` | `ALERT_ONLY` | `CUTOFF` = tự ngắt relay khi quá dòng |

## HTTP API
| Method | Path | Body | Trả về |
|---|---|---|---|
| GET | `/api/state` | — | toàn bộ trạng thái, `events` (100), `history` (60), `config`, `countdownMs` |
| POST | `/api/command` | `{"command":"RELAY_ON"}` … | `202` accepted · `400` sai lệnh/giá trị · `409` không có alarm để ACK · `503` thiết bị offline |

Lệnh: `RELAY_ON`, `RELAY_OFF`, `MODE_AUTO`, `MODE_MANUAL`, `OVERRIDE_ON`, `OVERRIDE_OFF`, `ACK_ALARM`, `SET_THRESHOLD` (`value` 1..4095).
