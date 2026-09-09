# State Machine Design
## IoT Project #55 — Energy Monitoring & Smart Power Automation

**Document:** `docs/state-machine/06-state-machine.md`
**Version:** 1.0
**Phase:** Week 1 — Architecture
**Date:** 2026-09-09

---

## 1. State Machine Overview

The system uses a **Finite State Machine (FSM)** to model system behaviour.
The FSM is maintained in **Node-RED** (authoritative state) and mirrored to the
ESP32 via the `cmd/mode` topic.

**Design principle:** Keep it simple. Only states that drive different behaviour
are included. No unnecessary complexity.

---

## 2. State Definitions

| State | Code | Description | Relay Default | Automation |
|-------|------|-------------|---------------|-----------|
| **OFFLINE** | `OFFLINE` | ESP32 not connected to MQTT | — | N/A |
| **NORMAL** | `NORMAL` | Store open, normal operation | ON | Active |
| **AFTER_HOURS** | `AFTER_HOURS` | Store closed, checking presence | Depends | Active |
| **OCCUPIED** | `OCCUPIED` | Store closed but presence detected | ON | Suspended |
| **AUTO_SHUTDOWN** | `AUTO_SHUTDOWN` | Auto-shutdown executed (load OFF) | OFF | Active |
| **ABNORMAL_CURRENT** | `ABNORMAL_CURRENT` | Current exceeds threshold | Configurable | Alert active |
| **MANUAL_OVERRIDE** | `MANUAL_OVERRIDE` | Human has taken control | User-controlled | Suspended |
| **FAULT** | `FAULT` | System error — fail-safe mode | OFF | Suspended |

---

## 3. State Transition Diagram

```
                    ┌─────────┐
                    │ OFFLINE │◄─────────────────────────────────┐
                    └────┬────┘                                  │
                         │ ESP32 connects + MQTT online           │ Disconnect
                         ▼                                        │
                    ┌─────────┐   Store closes (22:00)           │
     ┌──────────────│  NORMAL │─────────────────────────►        │
     │              └────┬────┘                         │        │
     │                   │                              │        │
     │ Current > thresh  │                              ▼        │
     ▼                   │                        ┌────────────┐ │
┌──────────────────┐     │                        │ AFTER_HOURS│ │
│ ABNORMAL_CURRENT │     │                        └──────┬─────┘ │
└──────────────────┘     │                               │       │
     │                   │              Presence=NONE    │       │
     │ Current OK        │              Load=ON          │       │
     │ (auto-recover)    │              ┌────────────────┘       │
     │                   │              │                        │
     │                   │              ▼                        │
     │                   │       ┌─────────────────┐            │
     │                   │       │  AUTO_SHUTDOWN  │            │
     │                   │       └────────┬────────┘            │
     │                   │                │                      │
     │                   │   Presence=PRESENT detected           │
     │                   │                │                      │
     │                   │       ┌────────▼────────┐            │
     │                   │       │    OCCUPIED     │            │
     │                   │       └────────┬────────┘            │
     │                   │                │ Presence clears      │
     │                   │                │ + Store still CLOSED │
     │                   │                ▼                      │
     │                   │       (Re-evaluate RULE 1)           │
     │                   │                                       │
     │            Override ACTIVE (any state)                    │
     │                   │                                       │
     │                   ▼                                       │
     │         ┌────────────────────┐                           │
     └────────►│  MANUAL_OVERRIDE   │◄──────────────────────────┤
               └──────────┬─────────┘                           │
                          │ Override CLEAR                       │
                          ▼                                      │
                  (Return to previous state)              ┌──────┴─────┐
                                                          │    FAULT   │
                  Any critical error → ──────────────────►└────────────┘
```

---

## 4. State Transitions Table

| From State | Event / Condition | To State | Action |
|-----------|------------------|----------|--------|
| OFFLINE | MQTT connected | NORMAL or AFTER_HOURS | Restore last state |
| NORMAL | Store closes (scheduler) | AFTER_HOURS | Evaluate RULE 1 |
| NORMAL | Current > threshold | ABNORMAL_CURRENT | Alert, log |
| NORMAL | Override activated | MANUAL_OVERRIDE | Suspend automation |
| AFTER_HOURS | Presence = NONE AND Load = ON | AUTO_SHUTDOWN | Relay OFF, log event |
| AFTER_HOURS | Presence = PRESENT | OCCUPIED | Keep relay ON |
| AFTER_HOURS | Current > threshold | ABNORMAL_CURRENT | Alert, log |
| AFTER_HOURS | Store opens (scheduler) | NORMAL | Resume normal |
| OCCUPIED | Presence = NONE (timeout) AND Store CLOSED | AUTO_SHUTDOWN | Relay OFF |
| OCCUPIED | Presence = NONE AND Store OPEN | NORMAL | Resume normal |
| OCCUPIED | Store opens (scheduler) | NORMAL | Resume normal |
| AUTO_SHUTDOWN | Store opens (scheduler) | NORMAL | Relay ON |
| AUTO_SHUTDOWN | Presence = PRESENT | OCCUPIED | Keep relay OFF? or ON* |
| ABNORMAL_CURRENT | Current ≤ threshold | Previous state | Clear alert |
| ABNORMAL_CURRENT | Override activated | MANUAL_OVERRIDE | Suspend automation |
| MANUAL_OVERRIDE | Override cleared | Previous state | Resume automation |
| MANUAL_OVERRIDE | Fault detected | FAULT | Fail-safe |
| FAULT | System reset / manual recovery | OFFLINE | Restart sequence |
| Any | MQTT disconnect (LWT) | OFFLINE | — |

> *AUTO_SHUTDOWN + Presence: By default, re-detecting presence in AUTO_SHUTDOWN state transitions to OCCUPIED (load stays OFF until manager manually turns ON or store opens).

---

## 5. Fail-Safe Behaviour

| Condition | Fail-Safe Action |
|-----------|-----------------|
| MQTT connection lost | Relay stays in last known state; LWT publishes OFFLINE |
| ESP32 reboots | Relay defaults to OFF (safe) until state restored |
| Node-RED restarts | Relay stays physical state; Node-RED re-reads retained topics |
| FAULT state entered | Relay → OFF, alert published, manual recovery required |
| Invalid command received | Command ignored, error logged, state unchanged |

---

## 6. State Machine Implementation Notes

### Node-RED (Authoritative)
- State stored in a `flow.systemState` context variable
- State published to `iot55/device01/status` on every change (retained)
- State transitions logged as events to `iot55/device01/event`

### ESP32 (Mirror)
- Local state variable `SystemState currentState`
- Subscribes to `iot55/device01/cmd/mode` for mode changes
- Relay defaults to OFF on `FAULT` or `OFFLINE`

### State Persistence
- Node-RED context (`flow` scope) survives flow redeployment
- `fileContextStorage` used for Node-RED restarts (persistent context)
- Retained MQTT topics allow ESP32 to restore mode/override on reconnect

---

*End of Document*
