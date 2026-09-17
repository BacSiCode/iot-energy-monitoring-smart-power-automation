# Week 2 - Mô phỏng Wokwi

## Trạng thái kiểm tra

Hiện tại, dự án Week 2 đã vượt qua kiểm tra cấu trúc:

- JSON của Wokwi hợp lệ
- các hằng số và chuỗi cần thiết trong sketch đã có mặt
- chưa thêm Wi-Fi, MQTT, cloud hoặc kiến trúc của các tuần sau

Tuy nhiên, cần thực hiện xác minh runtime trong Wokwi để khẳng định các kịch bản T01-T06 đã hoạt động đúng như mong đợi. Tài liệu này không khẳng định rằng các bài kiểm tra đã được chạy thành công trong môi trường Wokwi thực tế.

## 1. Mục tiêu Week 2

Week 2 tập trung vào mô phỏng tầng cảm biến và tầng thiết bị của đề tài Smart Retail. Mục tiêu là kiểm tra logic điều khiển cục bộ của ESP32 trong trường hợp cửa hàng đóng cửa, không có người và tải đang bật.

Mô phỏng này giúp sinh viên hiểu rõ:

- trạng thái cửa hàng mở/đóng
- phát hiện người bằng PIR
- tín hiệu mô phỏng của cảm biến dòng điện
- điều khiển relay
- chuông báo khi dòng điện bất thường
- luật tắt tải tự động

## 2. Các thành phần trong Wokwi

- ESP32 DevKit V1
- PIR HC-SR501
- Potentiometer để mô phỏng tín hiệu analog của cảm biến dòng điện
- Slide switch để chọn trạng thái cửa hàng OPEN/CLOSED
- Relay module để điều khiển tải mô phỏng
- LED để mô phỏng tải điện
- Điện trở 220 ohm để bảo vệ LED
- Buzzer để cảnh báo dòng điện bất thường

## 3. GPIO mapping

| Tín hiệu | GPIO | Kết nối trong Wokwi |
|---|---:|---|
| PIR presence | 27 | PIR OUT |
| Tín hiệu dòng điện mô phỏng | 34 | Potentiometer SIG |
| Trạng thái cửa hàng | 26 | Slide switch chân 2 |
| Điều khiển relay | 25 | Relay IN |
| Buzzer cảnh báo | 33 | Buzzer chân dương |

## 4. Tổng hợp dây kết nối

- ESP32 3V3 -> PIR VCC
- ESP32 GND -> PIR GND
- ESP32 GPIO27 -> PIR OUT
- ESP32 3V3 -> potentiometer VCC
- ESP32 GND -> potentiometer GND
- ESP32 GPIO34 -> potentiometer SIG
- ESP32 GND -> slide switch chân 1
- ESP32 GPIO26 -> slide switch chân 2
- ESP32 3V3 -> slide switch chân 3
- ESP32 5V -> relay VCC
- ESP32 GND -> relay GND
- ESP32 GPIO25 -> relay IN
- Relay COM -> ESP32 3V3
- Relay NO -> điện trở 220Ω -> chân anode LED
- Chân cathode LED -> ESP32 GND
- ESP32 GPIO33 -> buzzer chân dương
- Buzzer chân âm -> ESP32 GND

## 5. Luật điều khiển

### Luật chính

- CLOSED + NO PRESENCE + LOAD ON -> RELAY OFF

### Luật bảo vệ

- CLOSED + PRESENCE -> không tự động tắt tải

### Dòng điện bất thường

- currentValue > CURRENT_THRESHOLD -> abnormal_current=YES
- kích hoạt buzzer cảnh báo

### Giới hạn tín hiệu mô phỏng

Potentiometer chỉ được sử dụng để mô phỏng tín hiệu analog của cảm biến dòng điện trong Wokwi. Giá trị này dùng để kiểm thử logic ngưỡng và không đại diện trực tiếp cho đơn vị Ampere.

## 6. Các kịch bản kiểm thử

### T01 - Hoạt động bình thường

- Cửa hàng mở
- Không có người
- Dòng điện thấp hơn ngưỡng
- Kỳ vọng: relay ON, LED ON, buzzer OFF

### T02 - Tắt tự động

- Cửa hàng mở, sau đó chuyển sang CLOSED
- Không có người
- Relay đang ON
- Kỳ vọng: xuất hiện AUTO_SHUTDOWN, relay OFF, LED OFF

### T03 - Bảo vệ khi có người

- Cửa hàng CLOSED
- PIR phát hiện người
- Kỳ vọng: không tự động tắt tải, relay vẫn ON

### T04 - Dòng điện bất thường

- Tăng giá trị potentiometer vượt ngưỡng
- Kỳ vọng: abnormal_current=YES và buzzer kích hoạt
- Khi giảm xuống dưới ngưỡng, buzzer tắt

### T05 - Khôi phục sau khi có người

- Cửa hàng CLOSED
- Relay đã OFF do tự động tắt
- Kích hoạt PIR
- Kỳ vọng: LOAD_RESTORE và relay bật lại

### T06 - Mở cửa khôi phục

- Cửa hàng CLOSED
- Relay OFF
- Chuyển cửa hàng sang OPEN
- Kỳ vọng: relay ON, LED ON

## 7. Serial Monitor

Serial Monitor được cấu hình để hiển thị trạng thái mỗi khoảng thời gian khoảng 1 giây. Nội dung hiển thị gồm:

- store
- presence
- current
- relay
- abnormal_current

Ví dụ:

- store=OPEN presence=NO current=350 relay=ON abnormal_current=NO
- store=CLOSED presence=NO current=350 relay=OFF abnormal_current=NO
- store=CLOSED presence=YES current=350 relay=ON abnormal_current=NO

## 8. Cách chạy mô phỏng

1. Mở thư mục [simulation/wokwi](simulation/wokwi).
2. Mở file [simulation/wokwi/diagram.json](simulation/wokwi/diagram.json) trong Wokwi.
3. Mở Serial Monitor ở tốc độ 115200.
4. Đặt cửa hàng ở trạng thái OPEN.
5. Kiểm tra relay và LED.
6. Thực hiện lần lượt các kịch bản T01-T06.

## 9. Giới hạn của Week 2

- Potentiometer không phải cảm biến dòng điện thực tế.
- Tín hiệu ADC chỉ dùng để kiểm thử logic ngưỡng.
- LED là tải mô phỏng, không phải tải điện 220V thực tế.
- Không có Wi-Fi, MQTT, dashboard, Node-RED hoặc Telegram trong Week 2.
- Không có kiến trúc 4 lớp hoàn chỉnh ở các tuần sau.

## 10. Yêu cầu xác minh thực tế

Các bài kiểm tra cần thực hiện trong Wokwi thực tế:

- [ ] T01: cửa hàng mở, không có người, dòng điện bình thường
- [ ] T02: cửa hàng đóng, không có người, tự động tắt
- [ ] T03: cửa hàng đóng, có người, không tự ngắt sai
- [ ] T04: dòng điện vượt ngưỡng, buzzer cảnh báo
- [ ] T05: phục hồi sau khi có người
- [ ] T06: mở cửa lại, relay bật lại

Hiện tại, chưa có bằng chứng runtime Wokwi để khẳng định các mục này đã vượt qua. Người dùng cần thực hiện trong môi trường Wokwi để xác nhận cuối cùng.

## 11. Lưu ý an toàn

Mô phỏng này chỉ là mô phỏng phần cứng ở cấp độ low-voltage và không được mô tả là điều khiển điện AC 220V thực tế. Nếu triển khai vật lý sau này, phải dùng phương án cách ly phù hợp và tải mô phỏng an toàn.
