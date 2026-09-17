# Dự án IoT #55 - Giám sát điện năng và tự động hóa nguồn

## 1. Tổng quan

### Vấn đề thực tế

Sau giờ đóng cửa, cửa hàng có thể để các tải điện vẫn hoạt động dù không còn người trong không gian bán hàng. Điều này dẫn đến lãng phí điện năng, khó kiểm soát trạng thái thiết bị và tăng nguy cơ hao phí không cần thiết.

### Mục tiêu

Xây dựng hệ thống IoT đơn giản, dễ demo trong lớp học, có khả năng:

- phát hiện trạng thái cửa hàng mở/đóng
- phát hiện sự hiện diện của người trong cửa hàng
- mô phỏng tín hiệu dòng điện
- tắt tải tự động khi cửa hàng đóng và không có người
- cảnh báo khi tín hiệu dòng điện vượt ngưỡng
- hiển thị trạng thái trên Serial Monitor trong Wokwi

### Giải pháp

Trong Week 2, hệ thống được triển khai ở mức mô phỏng Wokwi để kiểm tra logic cục bộ của ESP32. Phần này tập trung vào cảm biến, relay, đèn LED mô phỏng tải, buzzer và luật tự động hóa ở tầng thiết bị.

### Thành phần hệ thống

- ESP32 DevKit V1
- PIR HC-SR501
- Potentiometer để mô phỏng tín hiệu analog của cảm biến dòng điện
- Slide switch để mô phỏng trạng thái cửa hàng mở/đóng
- Relay module để điều khiển tải mô phỏng
- LED 220Ω để mô phỏng tải điện
- Buzzer để cảnh báo dòng điện bất thường

## 2. Kiến trúc 4 lớp

| Lớp | Mô tả |
|---|---|
| Lớp 1 | Cảm biến và thiết bị: PIR, relay, LED, buzzer, switch, ESP32 |
| Lớp 2 | Kết nối thiết bị và logic cục bộ trên ESP32 |
| Lớp 3 | Middleware, MQTT, Node-RED, quy trình xử lý dữ liệu trong các tuần sau |
| Lớp 4 | Ứng dụng, dashboard, giám sát và điều khiển từ xa trong các tuần sau |

Lưu ý: Week 2 chỉ mô phỏng Layer 1 và phần logic xử lý local trên thiết bị. Các lớp 3 và 4 chưa được triển khai.

## 3. Cấu trúc repository

| Thư mục | Mô tả |
|---|---|
| docs/ | Tài liệu yêu cầu, kiến trúc, thiết kế, lộ trình |
| simulation/wokwi/ | Mô phỏng Wokwi cho Week 2 |
| firmware/ | Firmware ESP32 cho các tuần sau |
| middleware/ | Node-RED, Mosquitto cho các tuần sau |
| dashboard/ | Dashboard cho các tuần sau |
| tests/ | Script kiểm thử cho các tuần sau |
| screenshots/ | Ảnh minh họa |
| videos/ | Video minh họa |

## 4. Tiến độ 10 tuần

| Tuần | Giai đoạn | Trạng thái |
|---|---|---|
| 1 | Kiến trúc | Hoàn thành |
| 2 | Mô phỏng Wokwi | Chờ xác minh thực tế |
| 3 | Firmware ESP32 | Chưa thực hiện |
| 4 | Wi-Fi và MQTT | Chưa thực hiện |
| 5 | Middleware Node-RED | Chưa thực hiện |
| 6 | Dashboard / ứng dụng | Chưa thực hiện |
| 7 | Tăng cường tự động hóa | Chưa thực hiện |
| 8 | Tích hợp đầu cuối | Chưa thực hiện |
| 9 | Kiểm thử và tài liệu | Chưa thực hiện |
| 10 | Demo cuối kỳ | Chưa thực hiện |

## 5. Trạng thái hiện tại

Hiện tại, hệ thống chỉ ở mức Week 2 với mô phỏng Wokwi. Phần logic cục bộ đã được chuẩn bị và kiểm tra về cấu trúc, nhưng cần thực hiện xác minh Wokwi trực tiếp để khẳng định các kịch bản hoạt động đúng như mong đợi.

## 6. Week 1 đã làm gì

Week 1 tập trung vào xác định bài toán, yêu cầu chức năng, giới hạn, kiến trúc hệ thống và kế hoạch triển khai học thuật. Trong giai đoạn này, nhóm đã xác định rõ mục tiêu, yêu cầu chức năng và các ràng buộc kỹ thuật của dự án.

## 7. Week 2 đã làm gì

Week 2 xây dựng mô phỏng Wokwi với các thành phần sau:

- ESP32 điều khiển logic cục bộ
- PIR mô phỏng sự hiện diện người
- Potentiometer mô phỏng tín hiệu analog của cảm biến dòng điện
- Slide switch mô phỏng trạng thái cửa hàng mở/đóng
- Relay điều khiển tải mô phỏng
- LED mô phỏng tải điện
- Buzzer cảnh báo dòng điện bất thường

Week 2 tập trung vào luật chính:

- CLOSED + NO PRESENCE + LOAD ON -> RELAY OFF

Và luật bảo vệ:

- CLOSED + PRESENCE -> không tự động tắt tải

## 8. Những phần chưa triển khai

Các phần sau chưa được triển khai và chưa được xác minh là đã hoạt động thực tế:

- Wi-Fi
- MQTT
- Broker MQTT
- Node-RED
- Dashboard
- Telegram
- Cloud service
- phần cứng 220V thực tế
- firmware hoàn chỉnh cho tuần 3+

## 9. Cách chạy mô phỏng Wokwi

1. Mở thư mục [simulation/wokwi](simulation/wokwi).
2. Mở file [simulation/wokwi/diagram.json](simulation/wokwi/diagram.json) trong Wokwi.
3. Mở Serial Monitor ở tốc độ 115200.
4. Kiểm tra trạng thái cửa hàng bằng slide switch.
5. Thay đổi PIR và xoay potentiometer để mô phỏng khác nhau.
6. Quan sát relay, LED và buzzer.

## 10. Cách kiểm thử

Các kịch bản kiểm thử cần thực hiện trong Wokwi như sau:

- T01: cửa hàng mở, không có người, dòng điện bình thường
- T02: cửa hàng đóng, không có người, tải đang bật -> tự ngắt
- T03: cửa hàng đóng, có người -> không tự ngắt sai
- T04: dòng điện vượt ngưỡng -> abnormal_current=YES và buzzer hoạt động
- T05: sau khi tắt tự động, có người xuất hiện -> relay bật lại
- T06: cửa hàng mở trở lại -> relay bật lại

## 11. Giới hạn của mô phỏng

- Potentiometer chỉ mô phỏng tín hiệu analog cho nhiệm vụ kiểm thử logic ngưỡng.
- Hệ thống không điều khiển điện áp AC 220V thực tế.
- LED chỉ là tải mô phỏng, không đại diện cho tải điện thật.
- Không có MQTT, dashboard, Node-RED, Wi-Fi hay cloud trong Week 2.
- Logic hiện tại là logic cục bộ trên thiết bị, chưa phải kiến trúc hoàn chỉnh của các tuần sau.

## 12. Tài liệu tham khảo

- [docs/requirements/01-problem-statement.md](docs/requirements/01-problem-statement.md)
- [docs/requirements/02-requirements.md](docs/requirements/02-requirements.md)
- [docs/architecture/04-architecture.md](docs/architecture/04-architecture.md)
- [docs/architecture/07-automation-rules.md](docs/architecture/07-automation-rules.md)
- [docs/test-strategy/08-test-strategy.md](docs/test-strategy/08-test-strategy.md)
- [simulation/wokwi/README.md](simulation/wokwi/README.md)

## 13. Lưu ý

Tài liệu này chỉ mô tả phần đã thực hiện và đã được kiểm tra về cấu trúc. Không khẳng định các tính năng của tuần sau đã hoàn thành.
