# Firmware ESP32 — IoT 55

Một file nguồn duy nhất: [src/main.cpp](src/main.cpp) (cũng được dùng cho Wokwi).

## Build & nạp
```powershell
cd firmware/esp32
Copy-Item include/config.example.h include/config.h   # điền Wi-Fi + IP máy chạy Mosquitto; file này bị gitignore
pio run
pio run -t upload
pio device monitor
```
Không có `config.h` → firmware dùng mặc định Wokwi (`Wokwi-GUEST`, `broker.hivemq.com`).

## Trách nhiệm
| Phần | Hành vi |
|---|---|
| Sensing | ADC trung bình 8 mẫu mỗi 100 ms; PIR giữ trạng thái `PRESENCE_HOLD_MS`; công tắc store; nút override có debounce 50 ms |
| Alarm cục bộ | `current_signal > threshold` → buzzer + LED đỏ, nhả khi `< threshold − 30`; `cmd/alarm ACK` tắt buzzer |
| Uplink | `telemetry` (2 s hoặc ngay khi đổi), `current`/`presence`/`relay/state`/`status` retained, `event` |
| Downlink | Subscribe `cmd/#`; validate JSON, `device_id`, giá trị; lỗi → event `INVALID_PAYLOAD` |
| Rule 5 | Lệnh relay có `source` bắt đầu bằng `AUTO` bị từ chối khi MANUAL/override → `COMMAND_REJECTED` |
| Kết nối | Wi-Fi/MQTT không chặn (thử lại 10 s / 5 s), keepalive 15 s, LWT retained, NTP cho timestamp ISO |
| Fail-safe | Relay OFF khi khởi động; mất MQTT > `LOCAL_FALLBACK_AFTER_MS` → tự áp dụng rule 1; event được xếp hàng (8) và gửi lại khi kết nối lại |

## Cấu hình (`config.h`)
`WIFI_SSID`, `WIFI_PASSWORD`, `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `PRESENCE_HOLD_MS`, `LOCAL_FALLBACK_AFTER_MS`.

## An toàn phần cứng
Relay chỉ đóng/ngắt tải DC điện áp thấp (đèn 12 V, quạt 5 V). ACS712 đặt nối tiếp với tải DC đó. Không đấu điện lưới khi không có giám sát chuyên môn.
