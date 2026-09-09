# Hardware Specification — Sensors, Actuators & BOM
## IoT Project #55 — Energy Monitoring & Smart Power Automation

**Document:** `docs/bom/03-hardware-spec.md`
**Version:** 1.0
**Phase:** Week 1 — Architecture
**Date:** 2026-09-09

---

## 1. Sensor Specifications

### 1.1 Current Sensor — ACS712 (20A variant)

| Parameter | Value |
|-----------|-------|
| Model | ACS712ELCTR-20A-T |
| Measurement range | –20 A to +20 A |
| Output | Analogue voltage (0 – 5 V, midpoint 2.5 V) |
| Sensitivity | 100 mV/A |
| Interface | Analogue pin (ADC) on ESP32 |
| Supply voltage | 5 V |
| Operating temperature | –40 °C to +85 °C |
| Bandwidth | 80 kHz |
| **Wokwi equivalent** | Potentiometer as analogue voltage stand-in |
| **Sampling** | 50 samples averaged per reading at 1 kHz |
| **RMS calculation** | Software RMS over one AC cycle (ESP32) |

**Pinout (to ESP32):**

```
ACS712 OUT → ESP32 GPIO34 (ADC1_CH6)
ACS712 VCC → 5V (via regulator or USB)
ACS712 GND → GND
```

**Software conversion formula:**

```
voltage_offset = 2.5 V  (midpoint)
sensitivity    = 0.1 V/A
voltage_raw    = (adc_reading / 4095.0) * 3.3   [ESP32 ADC = 12-bit, 3.3V ref]
current_A      = (voltage_raw - voltage_offset) / sensitivity
```

> ⚠️ **Note:** ESP32 ADC is 3.3V max. Use a voltage divider if ACS712 output exceeds 3.3V.  
> For 20A sensor at 0 A: Vout = 2.5V → fine.  
> For 20A sensor at +20A: Vout = 4.5V → requires voltage divider (2:3 ratio).

---

### 1.2 Presence Sensor — PIR (HC-SR501)

| Parameter | Value |
|-----------|-------|
| Model | HC-SR501 |
| Detection range | Up to 7 m (adjustable) |
| Detection angle | ~120° cone |
| Output | Digital HIGH (3.3V) = motion detected, LOW = none |
| Interface | Digital GPIO on ESP32 |
| Supply voltage | 5 V (tolerant output) |
| Trigger modes | Single trigger / Repeat trigger (jumper) — use Repeat |
| Hold time | Adjustable 5 s – 300 s (onboard pot) |
| **Software hold time** | 300 s (configurable via MQTT cmd/threshold) |
| **Wokwi equivalent** | Push button or HC-SR501 Wokwi component |

**Pinout (to ESP32):**

```
HC-SR501 OUT → ESP32 GPIO27 (digital input, internal pull-down)
HC-SR501 VCC → 5V
HC-SR501 GND → GND
```

**Software logic:**

```
if (digitalRead(PIR_PIN) == HIGH):
    presence = PRESENT
    last_seen = now()
else if (now() - last_seen > PRESENCE_TIMEOUT):
    presence = NONE
```

---

## 2. Actuator Specifications

### 2.1 Relay Module (5V Single-Channel)

| Parameter | Value |
|-----------|-------|
| Model | Generic 5V relay module (SRD-05VDC-SL-C) |
| Control signal | 3.3V / 5V compatible (active LOW typical) |
| Coil voltage | 5 V DC |
| Contact rating | Up to 10A @ 250V AC / 30V DC (do NOT use 220V in lab) |
| **Safe lab load** | 5V / 12V DC LEDs or DC fan |
| Interface | Digital GPIO on ESP32 |
| Isolation | Optical isolation recommended |
| **Wokwi equivalent** | LED as load indicator |

**Pinout (to ESP32):**

```
Relay IN   → ESP32 GPIO26 (digital output)
Relay VCC  → 5V
Relay GND  → GND
Load+      → Power supply positive (5V/12V DC)
Load–      → Load, then back to power supply negative (through relay NO contact)
```

**Software logic:**

```
RELAY_ON  → digitalWrite(RELAY_PIN, HIGH)   [or LOW if active-low]
RELAY_OFF → digitalWrite(RELAY_PIN, LOW)    [fail-safe default]
```

---

### 2.2 Status LED

| Parameter | Value |
|-----------|-------|
| Color | Green (normal) / Red (alert) — or single bi-color |
| Resistor | 220Ω in series |
| GPIO | GPIO2 (onboard LED on most ESP32 dev boards) |
| Purpose | Visual relay state indicator |

---

### 2.3 Buzzer (Optional)

| Parameter | Value |
|-----------|-------|
| Type | Active piezo buzzer 5V |
| GPIO | GPIO25 |
| Purpose | Audible alert on ABNORMAL_CURRENT |
| Wokwi equivalent | Buzzer component |

---

## 3. Microcontroller — ESP32 Dev Kit

| Parameter | Value |
|-----------|-------|
| Model | ESP32-WROOM-32 (any Dev Kit variant) |
| CPU | Dual-core Xtensa LX6 @ 240 MHz |
| Flash | 4 MB |
| RAM | 520 KB SRAM |
| Wi-Fi | 802.11 b/g/n, 2.4 GHz |
| ADC pins | 18 × 12-bit ADC channels |
| Digital GPIO | 34 usable |
| Supply | 5V via USB or 3.3V regulated |
| Dev environment | PlatformIO (ESP32 Arduino framework) |

**GPIO Allocation:**

| GPIO | Function | Direction | Note |
|------|----------|-----------|------|
| GPIO34 | ACS712 OUT | Input (ADC) | ADC1_CH6, input only |
| GPIO27 | PIR OUT | Input (digital) | Pull-down |
| GPIO26 | Relay IN | Output (digital) | Fail-safe = LOW |
| GPIO2 | Status LED | Output (digital) | Onboard LED |
| GPIO25 | Buzzer | Output (digital) | Optional |

---

## 4. Bill of Materials (BOM)

### 4.1 Core Components (Simulation + Prototype)

| # | Component | Model | Qty | Unit Cost (USD) | Total |
|---|-----------|-------|-----|----------------|-------|
| 1 | ESP32 Dev Kit | ESP32-WROOM-32 | 1 | $5.00 | $5.00 |
| 2 | Current Sensor | ACS712 20A | 1 | $1.50 | $1.50 |
| 3 | PIR Sensor | HC-SR501 | 1 | $1.00 | $1.00 |
| 4 | Relay Module | 5V Single Channel | 1 | $1.20 | $1.20 |
| 5 | Resistor 220Ω | 1/4W | 2 | $0.02 | $0.04 |
| 6 | LED (Green) | 5mm | 1 | $0.05 | $0.05 |
| 7 | LED (Red) | 5mm | 1 | $0.05 | $0.05 |
| 8 | Buzzer | Active 5V | 1 | $0.50 | $0.50 |
| 9 | Breadboard | 830-point | 1 | $2.00 | $2.00 |
| 10 | Jumper wires | M-M / M-F set | 1 | $1.50 | $1.50 |
| 11 | USB cable | Micro-USB / USB-C | 1 | $1.00 | $1.00 |
| 12 | DC load (12V fan) | Optional demo | 1 | $2.00 | $2.00 |

**Subtotal (Hardware):** ~$15.84 USD

### 4.2 Software Stack (All Free/Open Source)

| # | Software | Version | License |
|---|----------|---------|---------|
| 1 | Wokwi | Online | Free tier |
| 2 | PlatformIO | Latest | Apache 2.0 |
| 3 | ESP32 Arduino Framework | 2.x | Apache 2.0 |
| 4 | Mosquitto MQTT Broker | 2.x | EPL 2.0 |
| 5 | Node-RED | 3.x | Apache 2.0 |
| 6 | Node-RED Dashboard | 3.x | Apache 2.0 |
| 7 | MQTT Explorer | Latest | Free |
| 8 | VS Code | Latest | MIT |
| 9 | Git + GitHub | Latest | Free |
| 10 | ArduinoJson | 7.x | MIT |
| 11 | PubSubClient | 2.8 | MIT |

**Total Software Cost:** $0.00

---

*End of Document*
