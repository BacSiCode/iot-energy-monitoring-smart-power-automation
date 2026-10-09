# Dashboard — IoT 55

Trang web tĩnh ([index.html](index.html)) do nginx phục vụ ở `http://localhost:8080`; nginx chuyển `/api/*` sang Node-RED ([nginx.conf](nginx.conf)).
Dashboard **không có logic giả**: mọi giá trị đọc từ `GET /api/state` (1 s/lần), mọi nút gửi `POST /api/command` → Node-RED validate → MQTT → ESP32.

## Hiển thị
| Ô | Nguồn |
|---|---|
| Dòng điện (A + ADC), ngưỡng | telemetry `current_a`, `current_signal`, `threshold_signal` |
| Hiện diện, cửa hàng (nguồn switch/lịch) | telemetry + scheduler |
| Relay (+ ai đổi) | `relay/state.changed_by` |
| Chế độ | `mode` / `override_active` |
| Trạng thái hệ thống + đếm ngược tự tắt | FSM trong Node-RED |
| Sự kiện mới nhất, event log | `events` (ẩn `STATE_CHANGED` mặc định) |
| Kết nối | pill **Node-RED** (API) và **Device** (LWT/heartbeat) |
| Banner đỏ + nút Acknowledge | `alarm.active` / `alarm.acknowledged` |

## Điều khiển
Relay ON/OFF · AUTO/MANUAL · Override ON/OFF · Acknowledge alert · Đặt ngưỡng (1..4095).
Nút cần thiết bị bị vô hiệu khi thiết bị offline; lỗi từ API (400/409/503) hiển thị ngay dưới nhóm nút.

Event và lý do do MQTT gửi lên được escape HTML trước khi hiển thị.
