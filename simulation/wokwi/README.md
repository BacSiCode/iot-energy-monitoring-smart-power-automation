# Mô phỏng Wokwi — IoT 55

Wokwi chạy **cùng firmware** với ESP32 thật:
- `sketch.ino` là bản sao sinh tự động từ [firmware/esp32/src/main.cpp](../../firmware/esp32/src/main.cpp) (`node scripts/sync-wokwi.js`). Không sửa tay.
- `platformio.ini` ở thư mục này build trực tiếp từ `firmware/esp32/src` với cờ `IOT55_SIMULATION` (bỏ qua `config.h`).

Khi chạy trong Wokwi, firmware dùng Wi-Fi `Wokwi-GUEST` và broker public `broker.hivemq.com:1883`.

## 1. Linh kiện và đấu dây

| Linh kiện | Chân linh kiện | ESP32 |
|---|---|---|
| PIR | VCC / GND / OUT | 3V3 / GND / **D27** |
| Biến trở (mô phỏng ACS712) | VCC / GND / SIG | 3V3 / GND / **D34** |
| Công tắc trượt OPEN/CLOSED | 1 / 2 / 3 | GND / **D26** / 3V3 |
| Nút OVERRIDE | 1.l / 2.l | **D14** / GND (INPUT_PULLUP) |
| Relay module | VCC / GND / IN | **VIN** / GND / **D25** |
| Tải LED vàng | relay COM ← 3V3, NO → 220 Ω → LED → GND | |
| Buzzer | 2 (+) / 1 (−) | **D33** / GND |
| LED xanh MQTT | 220 Ω → LED → GND | **D4** |
| LED đỏ ALARM | 220 Ω → LED → GND | **D19** |

Đã sửa so với bản cũ: relay dùng `VIN` (devkit-v1 không có chân `5V`), bỏ `transistor: pnp` (firmware điều khiển relay mức HIGH = ON).
`tests/config.test.js` kiểm tra chân GPIO trong firmware khớp với `diagram.json`.

## 2. Cách chạy

### Cách A — wokwi.com (trình duyệt)
1. Tạo project ESP32 mới trên wokwi.com.
2. Dán nội dung `sketch.ino`, `diagram.json`, `libraries.txt` vào các tab tương ứng.
3. Bấm ▶. Serial Monitor hiển thị `[WIFI] connected`, `[MQTT] connected`, sau đó `[TEL] ...` mỗi 2 giây.

### Cách B — VS Code + extension Wokwi
```powershell
cd simulation/wokwi
pio run                    # sinh .pio/build/esp32dev/firmware.bin
```
Mở `simulation/wokwi/diagram.json` → lệnh **Wokwi: Start Simulator** (nếu hỏi, chọn `simulation/wokwi/wokwi.toml`).

### Nối với Node-RED
Trong `.env` ở gốc repo:
```
NODERED_MQTT_HOST=broker.hivemq.com
```
`docker compose up -d` → dashboard `http://localhost:8080` hiển thị dữ liệu từ Wokwi; nút trên dashboard điều khiển relay trong Wokwi.

> Broker public dùng chung toàn cầu: chỉ dùng cho mô phỏng; nếu trùng namespace với nhóm khác thì đổi `device01` ở firmware, state engine và `build-flows.js`.

## 3. Thao tác trong mô phỏng

| Muốn | Làm |
|---|---|
| Đóng/mở cửa hàng | Gạt công tắc trượt (Serial `store=CLOSED/OPEN`) |
| Có người | Bấm vào PIR (giữ presence 10 s sau chuyển động) |
| Quá dòng | Xoay biến trở lên cao (> ngưỡng 700 ADC) |
| Override thủ công | Nhấn nút xanh OVERRIDE |
| Mất mạng | Dừng/khởi động lại mô phỏng, hoặc dừng Node-RED/broker |

## 4. Checklist xác minh trong Wokwi
Đánh dấu khi đã chạy và chụp màn hình (lưu vào `screenshots/wokwi/`):

- [ ] W01 Khởi động: relay OFF, LED xanh sáng sau khi MQTT kết nối
- [ ] W02 Bấm Relay ON trên dashboard → LED tải sáng (downlink)
- [ ] W03 Gạt CLOSED, không bấm PIR → sau ~10 s LED tải tắt, Serial `[RELAY] OFF by AUTO_RULE1`
- [ ] W04 Gạt OPEN → `[RELAY] ON by AUTO_RESTORE`
- [ ] W05 Gạt CLOSED + bấm PIR liên tục → LED tải vẫn sáng (state OCCUPIED)
- [ ] W06 Xoay biến trở lên cao → buzzer kêu, LED đỏ nháy; ACK trên dashboard → buzzer tắt, LED đỏ sáng liên tục
- [ ] W07 Nhấn OVERRIDE → gạt CLOSED → tải không tắt
- [ ] W08 Dừng broker/Node-RED > 30 s khi CLOSED và không người → fallback cục bộ tắt tải

## 5. Giới hạn
Biến trở chỉ tạo tín hiệu analog; giá trị Ampe là quy đổi tuyến tính (4095 = 20 A) cho mục đích kiểm thử ngưỡng. LED là tải mô phỏng DC điện áp thấp.
