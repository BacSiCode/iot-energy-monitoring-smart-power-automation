# Kịch bản demo tất định — IoT 55

Thời lượng ~8 phút. Màn hình chia 3: Wokwi (mạch + Serial), dashboard `localhost:8080`, Node-RED `localhost:1880` (tab debug "Event log").

## Chuẩn bị (trước buổi demo)
1. `.env`: `NODERED_MQTT_HOST=broker.hivemq.com`, `AUTO_SHUTDOWN_DELAY_SECONDS=10`, `STORE_STATUS_SOURCE=SWITCH`.
2. `docker compose up -d`; mở dashboard.
3. Chạy Wokwi; chờ Serial `[MQTT] connected`, LED xanh sáng, dashboard **Device online**.
4. Phương án dự phòng không có Internet: `NODERED_MQTT_HOST=mosquitto` và `npm run sim` (thiết bị ảo, phím `c p h n d`).

| # | Kịch bản | Thao tác | Kết quả mong đợi (bằng chứng) |
|---|---|---|---|
| 1 | Bình thường | Công tắc OPEN, biến trở thấp; dashboard **Relay ON** | LED tải sáng; state `NORMAL`; event `REMOTE_COMMAND`, `RELAY_ON` (downlink + phản hồi) |
| 2 | Đóng cửa, không người | Gạt CLOSED, không chạm PIR | Dashboard đếm ngược 10 s → `AUTO_SHUTDOWN`; LED tải tắt; Serial `[RELAY] OFF by AUTO_RULE1` |
| 2b | Mở cửa lại | Gạt OPEN | `AUTO_RESTORE`, LED tải sáng |
| 3 | Đóng cửa, có người | Bấm PIR rồi gạt CLOSED, bấm PIR vài lần | State `OCCUPIED`, LED tải vẫn sáng; nếu đang đếm ngược → `SHUTDOWN_CANCELLED` |
| 4 | Quá dòng | Gạt OPEN, xoay biến trở lên cao | Banner đỏ, buzzer kêu, LED đỏ nháy, event `ABNORMAL_CURRENT` (WARNING) → **Acknowledge** → buzzer tắt, `ALERT_ACKNOWLEDGED` → xoay xuống → `CURRENT_NORMAL` |
| 5 | Điều khiển từ xa + override | Relay OFF/ON; Override ON rồi gạt CLOSED | Relay theo lệnh; khi override, tải không tự tắt (state `MANUAL_OVERRIDE`); nhấn nút OVERRIDE trên mạch cũng đổi trạng thái |
| 6 | Mất kết nối & phục hồi | Dừng mô phỏng Wokwi (hoặc phím `d` ở thiết bị ảo) | ≤ 20 s: `DEVICE_OFFLINE` (LWT/heartbeat), nút điều khiển bị khoá; chạy lại → `DEVICE_ONLINE`, telemetry tiếp tục |

Kết thúc: mở event log trên dashboard (bật "hiện STATE_CHANGED") để chỉ chuỗi chuyển trạng thái FSM; chạy `npm test` và mở `tests/evidence/e2e-latest.md`.
