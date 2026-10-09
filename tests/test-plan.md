# Kế hoạch & kết quả kiểm thử — IoT 55

## Các tầng kiểm thử

| Tầng | Lệnh | Phạm vi | Kết quả gần nhất |
|---|---|---|---|
| Build firmware | `pio run` (firmware/esp32, simulation/wokwi) | biên dịch ESP32 thật + bản Wokwi | PASS, 0 warning |
| Unit (middleware) | `npm test` | mã `state-engine.js` thật, đồng hồ giả lập | 12/12 PASS |
| Nhất quán | `npm test` | flows.json ↔ src, sketch.ino ↔ firmware, GPIO ↔ diagram, topic downlink ↔ firmware, không commit secret | 7/7 PASS |
| E2E (stack thật) | `docker compose up -d` + `npm run e2e` | thiết bị ảo ↔ Mosquitto ↔ Node-RED ↔ API qua nginx | 11/11 PASS — [evidence/e2e-latest.md](evidence/e2e-latest.md) |
| Mô phỏng Wokwi | checklist W01–W08 | firmware thật trong Wokwi | cần chạy & chụp màn hình — [simulation/wokwi/README.md](../simulation/wokwi/README.md#4-checklist-xác-minh-trong-wokwi) |

## Ma trận test bắt buộc

| ID | Kịch bản | Kỳ vọng | Unit | E2E | Wokwi |
|---|---|---|---|---|---|
| TEST-01 | Hoạt động bình thường | NORMAL, không có lệnh | ✔ | ✔ | W02 |
| TEST-02 | CLOSED + không người + tải ON | sau delay: `cmd/relay OFF AUTO_RULE1`, `AUTO_SHUTDOWN`; mở cửa → `AUTO_RESTORE` | ✔ | ✔ | W03, W04 |
| TEST-03 | CLOSED + có người | không tắt, `OCCUPIED`, `SHUTDOWN_CANCELLED` | ✔ | ✔ | W05 |
| TEST-04 | Quá dòng | `ABNORMAL_CURRENT` → ACK → `CURRENT_NORMAL`; CUTOFF tự ngắt | ✔ | ✔ | W06 |
| TEST-05 | Remote relay OFF | 202, thiết bị OFF, `relay/state` xác nhận | ✔ | ✔ | W02 |
| TEST-06 | Remote relay ON | 202, thiết bị ON | ✔ | ✔ | W02 |
| TEST-07 | Manual override | rule 1 treo, `cmd/mode` retained | ✔ | ✔ | W07 |
| TEST-08 | MQTT mất/khôi phục | LWT/heartbeat → OFFLINE, lệnh 503, ONLINE lại | ✔ | ✔ | W08 |
| TEST-09 | Payload sai | `INVALID_PAYLOAD` (middleware + thiết bị), 400 ở API, trạng thái không đổi | ✔ | ✔ | — |
| TEST-10 | E2E uplink/downlink | ngưỡng: API → MQTT → ESP32 → telemetry → API | ✔ | ✔ | W02 |
| TEST-11 | Scheduler | `STORE_STATUS_SOURCE=SCHEDULE`, 22:00 → `STORE_CLOSED` | ✔ | — | — |
| TEST-12 | Relay không phản hồi | `FAULT` sau 10 s, `FAULT_CLEARED` khi có phản hồi | ✔ | — | — |

## Bằng chứng cần chụp
Chỉ dùng ảnh chụp thật:
- `screenshots/wokwi/01-normal.png`, `02-auto-shutdown.png`, `03-occupied.png`, `04-abnormal.png`
- `screenshots/dashboard/01-normal.png`, `02-countdown.png`, `03-alarm.png`, `04-offline.png`
- `screenshots/node-red/01-flow.png`
- `screenshots/mqtt/01-topics.png` (`docker exec iot55-mosquitto mosquitto_sub -t 'iot55/device01/#' -v`)
