# Kế hoạch kiểm thử IoT 55

Trạng thái mặc định của các kiểm thử dưới đây là `NOT VERIFIED` cho tới khi chạy trong môi trường có Mosquitto, Node-RED và thiết bị/Wokwi kết nối được.

| ID | Kịch bản | Kỳ vọng | Bằng chứng |
|---|---|---|---|
| T01 | OPEN, không người, relay ON | NORMAL, telemetry cập nhật | Chưa chạy |
| T02 | CLOSED + không người + relay ON | Node-RED gửi OFF, AUTO_SHUTDOWN | Chưa chạy |
| T03 | CLOSED + có người | Không tự tắt, OCCUPIED | Chưa chạy |
| T04 | current_signal > threshold | ABNORMAL_CURRENT, dashboard cảnh báo | Chưa chạy |
| T05 | Remote OFF | Relay OFF và relay/state phản hồi | Chưa chạy |
| T06 | Remote ON | Relay ON và relay/state phản hồi | Chưa chạy |
| T07 | OVERRIDE | Rule tự động bị treo, điều khiển tay hoạt động | Chưa chạy |
| T08 | MQTT disconnect/reconnect | OFFLINE rồi ONLINE, telemetry tiếp tục | Chưa chạy |
| T09 | JSON/command không hợp lệ | Bị từ chối, INVALID_PAYLOAD, không đổi relay | Chưa chạy |
| T10 | Device timeout | Dashboard hiển thị OFFLINE | Chưa chạy |
| T11 | Scheduler | OPEN/CLOSED theo giờ cấu hình | Chưa chạy |
| T12 | End-to-end | Sensor -> ESP32 -> MQTT -> Node-RED -> command -> relay -> dashboard | Chưa chạy |

## Lệnh kiểm thử MQTT thủ công

```powershell
mosquitto_sub -h localhost -t 'iot55/device01/#' -v
mosquitto_pub -h localhost -t iot55/device01/telemetry -m '{"device_id":"device01","current_signal":350,"presence":false,"store_status":"CLOSED","relay":true,"mode":"AUTO"}'
mosquitto_pub -h localhost -t iot55/device01/telemetry -m '{"device_id":"device01","current_signal":350,"presence":false,"store_status":"CLOSED","relay":false,"mode":"AUTO"}'
mosquitto_pub -h localhost -t iot55/device01/cmd/relay -m '{"command":"OFF","source":"TEST"}'
mosquitto_pub -h localhost -t iot55/device01/cmd/relay -m 'not-json'
```

## Evidence cần chụp

- `screenshots/wokwi/01-normal.png`
- `screenshots/wokwi/02-auto-shutdown.png`
- `screenshots/mqtt/01-topics.png`
- `screenshots/node-red/01-flow.png`
- `screenshots/dashboard/01-status.png`
- `screenshots/tests/01-e2e-shutdown.png`

Không tạo ảnh giả. Các mục trên chỉ là danh sách bằng chứng cần bổ sung sau khi chạy thực tế.
