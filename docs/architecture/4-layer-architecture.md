# Kiến trúc 4 lớp triển khai

> **Ghi chú (bản triển khai v2):** đây là tài liệu thiết kế Week 1. Hành vi thực tế của code được mô tả ở [README](../../README.md), [MQTT topics](../mqtt/mqtt-topics.md) và [state machine](../state-machine/06-state-machine.md). Khác biệt chính: dòng điện xử lý theo ADC `current_signal` (kèm `current_a` quy đổi), toàn bộ rule nằm trong một function node `state-engine` có unit test, delay demo 10 s.

```mermaid
flowchart TB
  subgraph L1[Layer 1 - Physical / Simulation]
    PIR[PIR GPIO27]
    ADC[Current signal GPIO34]
    STORE[Store switch GPIO26]
    ACT[Relay GPIO25 + LED]
    BUZZ[Buzzer GPIO33]
  end
  subgraph L2[Layer 2 - Connectivity]
    ESP[ESP32 Arduino firmware]
    WIFI[Wi-Fi]
    MQTT[MQTT client + LWT]
  end
  subgraph L3[Layer 3 - Middleware]
    BROKER[Mosquitto]
    NR[Node-RED: validate, rules, scheduler, FSM, events]
  end
  subgraph L4[Layer 4 - Application]
    DASH[Dashboard]
  end
  PIR --> ESP
  ADC --> ESP
  STORE --> ESP
  ESP --> WIFI --> MQTT --> BROKER --> NR --> DASH
  NR --> MQTT
  ESP --> ACT
  ESP --> BUZZ
```

Uplink dùng telemetry JSON. Downlink dùng command JSON. Tín hiệu dòng điện trong mô phỏng được giữ ở dạng `current_signal`/ADC; chưa có calibration để quy đổi thành Ampere.
