# State machine — IoT 55 (bản triển khai)

**Vị trí:** `updateSystemState()` trong [middleware/node-red/src/state-engine.js](../../middleware/node-red/src/state-engine.js).
**Kiểm thử:** [tests/state-engine.test.js](../../tests/state-engine.test.js) (TEST-01…12) và `npm run e2e`.

## 1. Nguyên tắc
- Node-RED là nơi quyết định trạng thái hệ thống; ESP32 giữ trạng thái thiết bị (relay, mode, override, alarm cục bộ) và báo lên qua telemetry.
- State được **suy ra theo thứ tự ưu tiên** sau mỗi input (telemetry, status, relay/state, tick 5 s, lệnh). Không có if/else rải rác: mọi rule chạy trong `evaluate()`, rồi FSM chọn đúng một state.
- Mỗi lần đổi state → event `STATE_CHANGED` (`reason = "FROM->TO"`) và `system/state` (retained).

## 2. Các state (theo thứ tự ưu tiên)

| # | State | Điều kiện | Ý nghĩa | Automation |
|---|---|---|---|---|
| 1 | `OFFLINE` | chưa nhận tin / LWT / không có tin > `DEVICE_TIMEOUT_SECONDS` | mất kết nối thiết bị | treo (đếm ngược bị huỷ, lệnh relay trả 503) |
| 2 | `FAULT` | đã gửi lệnh relay nhưng không có `relay/state` khớp sau 10 s | relay/thiết bị không phản hồi | rule vẫn chạy, cần kiểm tra |
| 3 | `ABNORMAL_CURRENT` | `current_signal > threshold` (nhả khi `< threshold − 30`) | quá dòng | cảnh báo; CUTOFF nếu cấu hình |
| 4 | `MANUAL_OVERRIDE` | `override_active` hoặc `mode = MANUAL` | người vận hành nắm quyền | rule 1 treo |
| 5 | `OCCUPIED` | store CLOSED ∧ presence | còn người sau giờ | rule 2: không tắt |
| 6 | `AUTO_SHUTDOWN` | store CLOSED ∧ relay OFF do rule 1/fallback | đã tự tắt | chờ mở cửa |
| 7 | `AFTER_HOURS` | store CLOSED | sau giờ, đang theo dõi/đếm ngược | rule 1 đang chạy |
| 8 | `NORMAL` | còn lại | giờ mở cửa | bình thường |

## 3. Bảng chuyển trạng thái

| State hiện tại | Trigger | Condition | Action | Next state |
|---|---|---|---|---|
| OFFLINE | `status{online:true}` hoặc telemetry hợp lệ | — | event `DEVICE_ONLINE` | theo ưu tiên (thường NORMAL) |
| NORMAL | telemetry `store_status=CLOSED` (hoặc lịch) | — | event `STORE_CLOSED`, bắt đầu đếm ngược nếu đủ điều kiện rule 1 | AFTER_HOURS / OCCUPIED |
| AFTER_HOURS | telemetry / tick | không người ∧ relay ON ∧ AUTO ∧ ¬override, kéo dài ≥ delay | `cmd/relay OFF source=AUTO_RULE1`, event `AUTO_SHUTDOWN` | AUTO_SHUTDOWN (khi `relay/state` = OFF) |
| AFTER_HOURS | telemetry presence = true | đang đếm ngược | huỷ đếm ngược, event `SHUTDOWN_CANCELLED` | OCCUPIED |
| OCCUPIED | presence hết hạn (PIR hold) | store vẫn CLOSED | event `PRESENCE_CLEARED`, bắt đầu đếm ngược lại | AFTER_HOURS |
| AUTO_SHUTDOWN | store OPEN | AUTO ∧ ¬override | `cmd/relay ON source=AUTO_RESTORE`, event `AUTO_RESTORE` | NORMAL |
| AUTO_SHUTDOWN | presence | — | không tự bật lại (người dùng bấm ON) | OCCUPIED |
| bất kỳ | `current_signal > threshold` | — | event `ABNORMAL_CURRENT`; CUTOFF → `cmd/relay OFF SAFETY_CUTOFF` | ABNORMAL_CURRENT |
| ABNORMAL_CURRENT | `ACK_ALARM` | alarm chưa ACK | `cmd/alarm ACK` (tắt buzzer), event `ALERT_ACKNOWLEDGED` | ABNORMAL_CURRENT |
| ABNORMAL_CURRENT | `current_signal < threshold − 30` | — | event `CURRENT_NORMAL` | theo ưu tiên |
| bất kỳ | override (nút/dashboard) hoặc `MODE_MANUAL` | — | event `MANUAL_OVERRIDE` / `AUTOMATION_DISABLED` | MANUAL_OVERRIDE |
| MANUAL_OVERRIDE | `OVERRIDE_OFF` / `MODE_AUTO` | cả hai đều tắt | event `OVERRIDE_CLEARED` / `AUTOMATION_ENABLED` | theo ưu tiên |
| bất kỳ | tick 5 s | lệnh relay chờ phản hồi > 10 s | event `FAULT` (ERROR) | FAULT |
| FAULT | `relay/state` | — | event `FAULT_CLEARED` | theo ưu tiên |
| bất kỳ | LWT `online:false` hoặc tick quá timeout | — | event `DEVICE_OFFLINE` | OFFLINE |

## 4. Fail-safe

| Tình huống | Hành vi |
|---|---|
| ESP32 khởi động lại | relay OFF; `cmd/mode` và `cmd/threshold` retained được áp dụng lại; override bị xoá |
| Mất MQTT trên ESP32 > 30 s | ESP32 tự áp dụng rule 1 bằng công tắc + PIR (`changed_by=LOCAL_FALLBACK`), event được gửi khi kết nối lại |
| Node-RED khởi động lại | trạng thái/event log lưu trong context (localfilesystem); nhận lại `status`/`relay/state` retained |
| Lệnh sai | bị từ chối ở API (400) và ở ESP32 (`INVALID_PAYLOAD`), không đổi trạng thái |
| Lệnh tự động khi override | ESP32 từ chối (`COMMAND_REJECTED`) — bảo vệ cả khi có race |
