# Week 2 - Mô phỏng Wokwi

## 1. Mục đích

Mô phỏng này triển khai phần đầu của Topic 55: theo dõi dòng điện mô phỏng
của tải và tự động tắt tải sau giờ đóng cửa khi không phát hiện người.

Mạch chạy trên ESP32 mô phỏng trong Wokwi. Relay chỉ điều khiển LED đại diện
cho tải mô phỏng; không kết nối hoặc mô tả tải điện thực tế.

Week 2 chưa triển khai MQTT, Mosquitto, Node-RED, dashboard, Telegram hay
phần cứng thật.

## 2. Linh kiện

- ESP32 DevKit v1: bộ điều khiển trung tâm.
- PIR: mô phỏng phát hiện người.
- Potentiometer: tạo giá trị ADC đại diện cho dòng điện.
- Slide switch: chọn trạng thái cửa hàng `CLOSED` hoặc `OPEN`.
- Relay module: bật hoặc tắt tải mô phỏng.
- LED vàng và điện trở: đại diện cho tải mô phỏng.
- Buzzer: cảnh báo khi dòng điện vượt ngưỡng.

## 3. GPIO mapping

| Tín hiệu | GPIO | Chân linh kiện Wokwi |
| --- | ---: | --- |
| Phát hiện người | 27 | PIR `OUT` |
| Dòng điện mô phỏng | 34 | Potentiometer `SIG` |
| Trạng thái cửa hàng | 26 | Slide switch chân `2` (COM) |
| Điều khiển relay | 25 | Relay `IN` |
| Buzzer cảnh báo | 33 | Buzzer chân `2` (dương) |

Slide switch Wokwi có ba chân số `1`, `2`, `3`; chân `2` là chân COM. Chân
`1` nối GND, chân `3` nối 3V3, còn chân `2` nối GPIO 26. Vì vậy trạng thái
đọc vào không bị floating: vị trí nối chân `3` là `CLOSED` (HIGH), vị trí nối
chân `1` là `OPEN` (LOW). PIR và potentiometer cũng được nối rõ ràng với
nguồn và GND.

Potentiometer có ba chân `GND`, `SIG`, `VCC`: `VCC` nối 3V3, `GND` nối GND,
`SIG` nối GPIO 34. Giá trị đọc nằm trong khoảng ADC `0..1023`.

## 4. Cách chạy

1. Mở [diagram.json](diagram.json) bằng Wokwi for VS Code hoặc import thư mục
  này vào Wokwi trên trình duyệt.
2. Chạy mô phỏng và mở Serial Monitor ở tốc độ `115200` baud.
3. Thay đổi slide switch, kích hoạt PIR và xoay potentiometer để kiểm thử.

Serial Monitor in trạng thái cửa hàng, hiện diện, giá trị ADC, relay và cảnh
báo dòng điện mỗi giây.

Sketch nằm trong [sketch.ino](sketch.ino). Ngưỡng cảnh báo hiện tại là
`CURRENT_THRESHOLD = 700` trên thang ADC Wokwi `0..1023`.

Relay dùng chế độ `pnp`: `IN=HIGH` nối `COM` với `NO`, làm LED tải sáng;
`IN=LOW` ngắt đường tới `NO`, làm LED tải tắt. `COM` nối 3V3, `NO` đi qua
điện trở và LED xuống GND. Buzzer nối GPIO 33 vào chân `2` (dương) và GND
vào chân `1` (âm).

## 5. Các scenario kiểm thử

### Scenario 1: Tự động tắt tải

Thiết lập:

- Slide switch ở trạng thái `CLOSED`.
- PIR không phát hiện người.

Kết quả mong đợi:

- Relay chuyển sang `OFF`.
- LED tải mô phỏng tắt.
- Serial Monitor in sự kiện `AUTO_SHUTDOWN`.

### Scenario 2: Có người thì không tự tắt

Thiết lập slide switch ở `CLOSED` và kích hoạt PIR.

Kết quả mong đợi: relay vẫn `ON` hoặc được bật lại, LED tải vẫn sáng trong
thời gian phát hiện có người.

### Scenario 3: Dòng điện vượt ngưỡng

Xoay potentiometer để giá trị ADC lớn hơn `700`.

Kết quả mong đợi:

- Serial Monitor hiển thị `abnormal_current=YES`.
- Buzzer phát âm cảnh báo.

## 6. Giới hạn của Week 2

- Potentiometer chỉ tạo giá trị ADC, chưa phải phép đo dòng điện đã hiệu
  chuẩn.
- Thời gian đóng cửa được mô phỏng bằng switch thủ công; chưa có đồng hồ hay
  lịch làm việc.
- Relay chỉ đóng/ngắt LED mô phỏng.
- Chưa có Wi-Fi, MQTT, lưu trữ dữ liệu, điều khiển từ xa, dashboard hoặc
  triển khai phần cứng thật.
- Logic hiện tại là logic cục bộ đơn giản, chưa phải cơ chế bảo vệ điện hoặc
  hệ thống an toàn cho môi trường thực tế.
