# Bảo mật & quản lý secrets — IoT 55

## Không bao giờ commit
| File | Chứa | Cách tạo |
|---|---|---|
| `.env` | cấu hình + secret Node-RED | copy `.env.example` |
| `firmware/esp32/include/config.h` | Wi-Fi, MQTT user/pass | copy `config.example.h` |
| `middleware/node-red/flows_cred.json` | credential MQTT nhập trong editor | Node-RED tự tạo (mã hoá bằng `NODE_RED_CREDENTIAL_SECRET`) |
| `middleware/node-red/.config.*.json`, `context/` | khoá instance, trạng thái runtime | Node-RED tự tạo |
| `middleware/mosquitto/passwd` | hash mật khẩu broker | `mosquitto_passwd` |

Tất cả đã nằm trong `.gitignore`; `tests/config.test.js` fail nếu chúng bị track.
Lưu ý: các commit cũ có `.config.runtime.json` (khoá `_credentialSecret` sinh tự động, repo không có `flows_cred.json` nên không lộ credential). Khi triển khai thật, đặt `NODE_RED_CREDENTIAL_SECRET` mới.

## Bật xác thực (khuyến nghị khi ra khỏi máy cá nhân)
1. **Mosquitto**
   ```powershell
   docker compose exec mosquitto mosquitto_passwd -c -b /mosquitto/config/passwd iot55 "<mật-khẩu>"
   ```
   Mount `./middleware/mosquitto/passwd` vào `/mosquitto/config/passwd`, sửa `mosquitto.conf`: `allow_anonymous false`, `password_file /mosquitto/config/passwd`.
2. **ESP32**: điền `MQTT_USERNAME` / `MQTT_PASSWORD` trong `config.h`.
3. **Node-RED → broker**: mở editor, sửa node `IoT55 broker` → tab Security (lưu vào `flows_cred.json`, mã hoá).
4. **Editor Node-RED**: `docker compose run --rm nodered node-red admin hash-pw`, đặt `NODE_RED_ADMIN_USER` và `NODE_RED_ADMIN_PASSWORD_HASH` (thay `$` bằng `$$`) trong `.env`.

## TLS (tuỳ chọn)
Listener 8883 với `cafile`/`certfile`/`keyfile` trong Mosquitto; ESP32 dùng `WiFiClientSecure` + CA cert. Không bật mặc định để giữ demo đơn giản.

## Broker public cho Wokwi
`broker.hivemq.com` không xác thực, không mã hoá, ai cũng subscribe được: chỉ dùng dữ liệu mô phỏng, không gửi thông tin thật.

## Phòng thủ trong code
- Mọi payload MQTT và lệnh HTTP được validate (kiểu, miền giá trị, `device_id`); sai → từ chối + log.
- Dashboard escape HTML với dữ liệu từ MQTT (chống XSS qua event log).
- Lệnh relay tới thiết bị offline bị từ chối (503) thay vì âm thầm thất lạc.
