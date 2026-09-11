# Week 2 - Wokwi Simulation

## Purpose

This simulation demonstrates Topic 55: monitoring simulated electrical load
current and automatically switching a simulated load off after store closing
when no presence is detected. It runs locally on an ESP32 model in Wokwi.

There is no MQTT, Mosquitto, Node-RED, dashboard, Telegram integration, or
physical mains wiring in Week 2.

## Components

- ESP32 DevKit v1
- PIR motion sensor for presence
- Potentiometer as a simulated current input
- Slide switch as the store CLOSED/OPEN input
- Relay module as the load switch
- Yellow LED and resistor as the simulated load
- Buzzer for abnormal-current warning

## GPIO Mapping

| Signal | GPIO | Wokwi component |
| --- | ---: | --- |
| Presence input | 27 | PIR `OUT` |
| Simulated current | 34 | Potentiometer `SIG` |
| Store state | 26 | Slide switch `COM` |
| Relay control | 25 | Relay `IN` |
| Warning buzzer | 33 | Buzzer `1` |

The slide switch connects its common pin to either 3V3 (CLOSED) or GND
(OPEN), so the store-state input is never left floating. The sensor and
potentiometer also have explicit power and ground connections.

## Run

1. Open `simulation/wokwi/diagram.json` in Wokwi for VS Code or import the
   folder into the Wokwi web simulator.
2. Start the simulation and open the Serial Monitor at 115200 baud.
3. Use the slide switch, PIR control, and current potentiometer while the
   simulation is running.

The Serial Monitor reports store state, presence, ADC current value, relay
state, and abnormal-current state once per second.

## Test Scenarios

### Scenario 1: Automatic shutdown

Set the slide switch to CLOSED and leave the PIR inactive. The relay turns
OFF and the simulated load LED turns OFF. The Serial Monitor prints an
`AUTO_SHUTDOWN` event.

### Scenario 2: Presence prevents shutdown

Set the slide switch to CLOSED and activate the PIR. The relay remains ON (or
is restored ON), so the load LED remains ON while presence is detected.

### Scenario 3: Abnormal current

Turn the current potentiometer above the `CURRENT_THRESHOLD` value of 3000.
The Serial Monitor reports `abnormal_current=YES` and the buzzer sounds.

## Week 2 Limitations

- The potentiometer value is an ADC-level simulation, not a calibrated current
  measurement.
- Store time is represented by a manual switch; there is no clock or schedule.
- Relay switching controls only the LED simulation load.
- There is no network, persistence, remote control, dashboard, or physical
  hardware implementation.
- The sketch uses simple local logic and does not claim production safety or
  electrical protection behavior.
