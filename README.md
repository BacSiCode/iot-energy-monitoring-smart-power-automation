# Dự án IoT #55 - Giám sát điện năng và tự động hóa nguồn

> **Đồ án IoT học thuật | Kiến trúc 4 lớp | ESP32 + MQTT + Node-RED**

[![Tuần](https://img.shields.io/badge/Tuần-2%20Mô%20phỏng%20Wokwi-blue)](simulation/wokwi/)
[![Trạng thái](https://img.shields.io/badge/Trạng%20thái-Đang%20phát%20triển-yellow)](docs/)
[![Giấy phép](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 1. Tổng quan

### Bài toán

Sau giờ đóng cửa, cửa hàng có thể vẫn để các tải điện mô phỏng hoạt động dù
không còn người. Điều này làm lãng phí năng lượng và gây khó khăn cho việc
theo dõi trạng thái thiết bị.

### Mục tiêu

Xây dựng hệ thống IoT có khả năng:

- Theo dõi giá trị dòng điện mô phỏng của tải.
- Phát hiện người bằng cảm biến PIR.
- Nhận biết cửa hàng đang mở hay đã đóng.
- Tự động tắt tải khi cửa hàng đóng cửa và không có người.
- Cảnh báo khi giá trị dòng điện vượt ngưỡng.
- Cung cấp dữ liệu cho dashboard và điều khiển từ xa ở các tuần sau.
- Ghi nhận các sự kiện tự động hóa để phục vụ kiểm tra và phân tích.

---

## 2. Kiến trúc 4 lớp

```
┌─────────────────────────────────────────────────────────────┐
│ LỚP 4 - ỨNG DỤNG                                            │
│ Dashboard Node-RED · Điều khiển từ xa · Cảnh báo · Nhật ký  │
├─────────────────────────────────────────────────────────────┤
│ LỚP 3 - MIDDLEWARE                                          │
│ MQTT Mosquitto · Node-RED · Luật · Lập lịch · State machine │
├─────────────────────────────────────────────────────────────┤
│ LỚP 2 - MẠNG                                                │
│ ESP32 · Wi-Fi · MQTT Pub/Sub · Dữ liệu JSON                 │
├─────────────────────────────────────────────────────────────┤
│ LỚP 1 - CẢM BIẾN / THIẾT BỊ                                │
│ Cảm biến dòng · PIR · Relay · Buzzer/LED                    │
│ Mô phỏng Wokwi là hướng triển khai chính                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Cấu trúc repository

```
iot-energy-monitoring-smart-power-automation/
├── docs/
│   ├── architecture/          # Kiến trúc, luật tự động hóa và lộ trình
│   ├── requirements/          # Bài toán, yêu cầu và use case
│   ├── mqtt/                  # Thiết kế topic và payload MQTT
│   ├── state-machine/         # Thiết kế state machine
│   └── test-strategy/         # Kế hoạch và ca kiểm thử
├── simulation/wokwi/          # Mạch và sketch Wokwi (Week 2)
├── firmware/esp32/            # Firmware PlatformIO (Week 3-4)
├── middleware/
│   ├── node-red/              # Flow Node-RED (Week 5)
│   └── mosquitto/             # Cấu hình Mosquitto
├── dashboard/                 # Dashboard và ảnh chụp (Week 6)
├── tests/                     # Script kiểm thử (Week 9)
├── screenshots/               # Ảnh minh họa
├── videos/                    # Video minh họa
├── .env.example
├── .gitignore
└── README.md
```

---

## 4. Không gian MQTT

Namespace dự kiến là `iot55/device01/`. MQTT chưa được triển khai trong Week
2; bảng dưới đây là thiết kế cho các tuần tiếp theo.

| Hướng | Topic | Mục đích |
|-----------|-------|---------|
| Uplink | `iot55/device01/telemetry` | Dữ liệu tổng hợp từ cảm biến |
| Uplink | `iot55/device01/current` | Giá trị dòng điện |
| Uplink | `iot55/device01/presence` | Trạng thái hiện diện từ PIR |
| Uplink | `iot55/device01/status` | Trạng thái thiết bị |
| Uplink | `iot55/device01/event` | Sự kiện tự động hóa |
| Uplink | `iot55/device01/relay/state` | Phản hồi trạng thái relay |
| Downlink | `iot55/device01/cmd/relay` | Lệnh điều khiển relay |
| Downlink | `iot55/device01/cmd/mode` | Lệnh thay đổi chế độ |
| Downlink | `iot55/device01/cmd/override` | Lệnh điều khiển thủ công |
| Downlink | `iot55/device01/cmd/threshold` | Cập nhật ngưỡng cảnh báo |

---

## 5. Các trạng thái hệ thống

`OFFLINE` · `NORMAL` · `AFTER_HOURS` · `OCCUPIED` · `AUTO_SHUTDOWN` ·
`ABNORMAL_CURRENT` · `MANUAL_OVERRIDE` · `FAULT`

---

## 6. Tiến độ thực hiện

| Tuần | Giai đoạn | Trạng thái |
|------|-------|--------|
| **1** | **Kiến trúc** | ✅ **Hoàn thành** |
| **2** | **Mô phỏng Wokwi** | ✅ **Hoàn thành** |
| 3 | Firmware ESP32 | ⬜ Chưa bắt đầu |
| 4 | Wi-Fi và MQTT | ⬜ Chưa bắt đầu |
| 5 | Middleware Node-RED | ⬜ Chưa bắt đầu |
| 6 | Dashboard | ⬜ Chưa bắt đầu |
| 7 | Tự động hóa và tình huống biên | ⬜ Chưa bắt đầu |
| 8 | Tích hợp đầu cuối | ⬜ Chưa bắt đầu |
| 9 | Kiểm thử và tài liệu | ⬜ Chưa bắt đầu |
| 10 | Demo cuối kỳ | ⬜ Chưa bắt đầu |

---

## 7. Chạy mô phỏng Wokwi

Mở [simulation/wokwi/README.md](simulation/wokwi/README.md) để xem linh kiện,
GPIO mapping, cách chạy và các scenario kiểm thử của Week 2.

Mô phỏng hiện chỉ dùng tải LED. Không có kết nối tải điện thực tế và chưa có
MQTT, Mosquitto, Node-RED, dashboard hoặc Telegram.

## 8. Tài liệu

- [Phát biểu bài toán](docs/requirements/01-problem-statement.md)
- [Yêu cầu và use case](docs/requirements/02-requirements.md)
- [Thông số phần cứng và BOM](docs/bom/03-hardware-spec.md)
- [Kiến trúc 4 lớp](docs/architecture/04-architecture.md)
- [Thiết kế MQTT](docs/mqtt/05-mqtt-design.md)
- [State machine](docs/state-machine/06-state-machine.md)
- [Luật tự động hóa và lập lịch](docs/architecture/07-automation-rules.md)
- [Chiến lược kiểm thử](docs/test-strategy/08-test-strategy.md)
- [Lộ trình và tiêu chí đánh giá](docs/architecture/09-roadmap.md)

---

*IoT Project #55 | Đồ án học thuật | Week 2 - Mô phỏng Wokwi hoàn thành*
