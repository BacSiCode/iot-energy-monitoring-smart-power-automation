# Automation Rules & Scheduler Design
## IoT Project #55 — Energy Monitoring & Smart Power Automation

**Document:** `docs/architecture/07-automation-rules.md`
**Version:** 1.0
**Phase:** Week 1 — Architecture
**Date:** 2026-09-09

---

## 1. Automation Rules Overview

All automation rules are implemented in **Node-RED** as conditional logic nodes.
Rules execute on **every telemetry message received** from the ESP32.

**Global guard:** If `mode = MANUAL` or `override = ACTIVE`, NO rule fires.

---

## 2. Rule Definitions

### RULE 1 — Auto-Shutdown After Hours

**Purpose:** Save energy by turning off load when store is closed and no one is present.

```
IF:
    store_status = CLOSED
    AND presence = NONE
    AND relay_state = ON
    AND mode = AUTO
    AND override = INACTIVE

THEN:
    Publish cmd/relay → {"command": "OFF", "source": "AUTO_RULE1"}
    Set state → AUTO_SHUTDOWN
    Log event → AUTO_SHUTDOWN
    Update dashboard
    Send alert (if configured)
    Trigger buzzer (1 short beep)
```

**Hysteresis / Debounce:**
- A configurable delay (`AUTO_SHUTDOWN_DELAY_SECONDS`, default 60 s) must elapse
  after the rule condition becomes true before the command is sent.
- If presence is detected during the delay window → delay resets, RULE 2 applies.
- This prevents false triggers from momentary sensor glitches.

**Implementation in Node-RED:**
```
[MQTT in: telemetry]
    → [Function: Extract fields]
    → [Switch: store_status = CLOSED?]
        → [Switch: presence = NONE?]
            → [Switch: relay_state = ON?]
                → [Switch: mode = AUTO?]
                    → [Delay: 60s countdown]
                        → [Function: Build cmd/relay OFF payload]
                            → [MQTT out: cmd/relay]
                            → [Function: Build event payload]
                                → [MQTT out: event]
```

---

### RULE 2 — Protect Occupied After Hours

**Purpose:** Prevent auto-shutdown from cutting power when people are still present.

```
IF:
    store_status = CLOSED
    AND presence = PRESENT
    AND relay_state = ON

THEN:
    DO NOTHING (keep relay ON)
    Set state → OCCUPIED
    Log event → OCCUPIED_DETECTED (if state changed)
    Update dashboard
```

**Note:** This rule overrides RULE 1 — it is evaluated first or as a pre-condition check.

---

### RULE 3 — Abnormal Current Alert

**Purpose:** Detect potential overload, short-circuit, or equipment malfunction.

```
IF:
    current_a > current_threshold_a

THEN:
    Set state → ABNORMAL_CURRENT
    Log event → ABNORMAL_CURRENT
    Publish to event topic
    Send Telegram alert (optional)
    Dashboard: show RED indicator
    Trigger buzzer (3 rapid beeps)
    [Safety action: relay OFF if current_a > 2× threshold]
```

**Recovery:**
```
IF:
    current_a ≤ current_threshold_a
    AND state = ABNORMAL_CURRENT

THEN:
    Set state → previous_state
    Log event → CURRENT_NORMAL_RESTORED
    Dashboard: clear RED indicator
```

**Configurable threshold:**
- Default: 10.0 A
- Updatable via `cmd/threshold` MQTT message from dashboard
- Hard safety limit: Automatic relay OFF if current > 2× threshold (20 A)

---

### RULE 4 — Remote Control & Override

**Purpose:** Dashboard / operator can directly control relay and override automation.

```
On receive cmd/relay:
    Parse command (ON / OFF)
    Apply to relay
    Set changed_by = DASHBOARD
    Log event → RELAY_ON or RELAY_OFF
    Publish relay/state

On receive cmd/override ACTIVE:
    Set override = ACTIVE
    Set state → MANUAL_OVERRIDE
    Suspend all automation rules
    Log event → OVERRIDE_ACTIVE

On receive cmd/override CLEAR:
    Set override = INACTIVE
    Set state → previous_state
    Resume automation rules
    Log event → OVERRIDE_CLEARED
```

---

## 3. Rule Priority & Conflict Resolution

| Priority | Rule | Condition |
|----------|------|-----------|
| 1 (Highest) | Safety cutoff (RULE 3 hard limit) | current > 2× threshold |
| 2 | MANUAL_OVERRIDE (RULE 4) | override = ACTIVE |
| 3 | RULE 2 (Presence protection) | Store CLOSED + Presence PRESENT |
| 4 | RULE 1 (Auto-shutdown) | Store CLOSED + No Presence |
| 5 (Lowest) | Normal pass-through | No rule fires |

---

## 4. Scheduler Design

### 4.1 Schedule Configuration

| Parameter | Default Value | Configurable |
|-----------|---------------|-------------|
| Store open time | 08:00 (HH:MM) | Yes — `.env` |
| Store close time | 22:00 (HH:MM) | Yes — `.env` |
| Timezone | Asia/Ho_Chi_Minh | Yes — `.env` |
| Auto-shutdown delay | 60 s | Yes — `.env` |
| Presence hold timeout | 300 s | Yes — `.env` |

### 4.2 Cron Expressions (Node-RED)

```javascript
// Store opens at 08:00 every day
OPEN_CRON  = "0 8 * * *"

// Store closes at 22:00 every day  
CLOSE_CRON = "0 22 * * *"
```

### 4.3 Scheduler Events

| Time Event | Action | State Transition |
|-----------|--------|-----------------|
| Open time reached | store_status → OPEN | Any → NORMAL |
| Close time reached | store_status → CLOSED | NORMAL → AFTER_HOURS |
| After close + No presence | (RULE 1 triggers) | AFTER_HOURS → AUTO_SHUTDOWN |

### 4.4 Scheduler Implementation

In Node-RED, the scheduler uses the **`inject` node** with cron expression, or
the **`node-red-contrib-cron-plus`** node for more flexible scheduling.

```
[Inject: cron "0 8 * * *"]
    → [Function: set store_status = OPEN]
        → [Update flow context]
        → [MQTT out: status topic]
        → [Function: log STORE_OPENED event]

[Inject: cron "0 22 * * *"]
    → [Function: set store_status = CLOSED]
        → [Update flow context]
        → [MQTT out: status topic]
        → [Function: log STORE_CLOSED event]
        → [Trigger Rule 1 evaluation]
```

---

## 5. Dashboard Requirements

### 5.1 Widget Inventory

| Widget ID | Type | Data Source | Purpose |
|-----------|------|-------------|---------|
| W01 | Gauge | `current` topic | Real-time current (A) |
| W02 | Status indicator | `presence` topic | PRESENT / NONE badge |
| W03 | Status indicator | `status` topic | OPEN / CLOSED badge |
| W04 | Status indicator | `relay/state` topic | ON / OFF badge |
| W05 | Text/Badge | `status` state field | Current FSM state |
| W06 | Scrolling list | `event` topic | Event log (last 20) |
| W07 | Button | → `cmd/relay` | Relay ON |
| W08 | Button | → `cmd/relay` | Relay OFF |
| W09 | Button | → `cmd/mode` | AUTO mode |
| W10 | Button | → `cmd/override` | MANUAL OVERRIDE |
| W11 | Number input | → `cmd/threshold` | Current threshold |
| W12 | Chart (line) | `current` topic | Historical current |
| W13 | Status indicator | `status.online` | ESP32 connection |

### 5.2 Dashboard Layout (Planned)

```
┌─────────────────────────────────────────────────────────────────┐
│  IoT #55 — Energy Monitor & Smart Power Automation             │
│  Device: device01                    ● Online / ○ Offline      │
├───────────────┬───────────────┬───────────────┬────────────────┤
│  Current (A)  │   Presence    │  Store Status │  Relay State   │
│  [Gauge: 4.2] │  [PRESENT 🟢] │  [OPEN 🟢]   │  [ON 🟢]      │
├───────────────┴───────────────┴───────────────┴────────────────┤
│  System State: NORMAL                                           │
│  Mode: AUTO                                                     │
├─────────────────────────────────────┬───────────────────────────┤
│  Current History (60 readings)      │  Controls                 │
│                                     │  [ON] [OFF]              │
│  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  [AUTO] [OVERRIDE]       │
│                                     │  Threshold: [10.0] A     │
├─────────────────────────────────────┴───────────────────────────┤
│  Event Log                                                      │
│  22:05:30  AUTO_SHUTDOWN — Store closed, no presence           │
│  22:00:00  STORE_CLOSED — Scheduler triggered                  │
│  08:00:00  STORE_OPENED — Scheduler triggered                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Error Scenarios

| # | Error Scenario | Detection | Response | Recovery |
|---|---------------|-----------|----------|---------|
| E01 | ESP32 Wi-Fi disconnects | LWT message | Node-RED sets state OFFLINE, dashboard shows red | ESP32 auto-reconnect |
| E02 | MQTT broker stops | Connection timeout | ESP32 reconnect loop | Restart Mosquitto |
| E03 | Malformed JSON payload | JSON parse error | Log, ignore | Automatic (next message) |
| E04 | PIR false positive (glitch) | Rapid state change | Debounce timer prevents action | Timeout resets |
| E05 | ACS712 ADC noise | Erratic readings | Software averaging (50 samples) | Automatic |
| E06 | Relay stuck ON | relay/state ≠ expected | Log FAULT, alert | Manual intervention |
| E07 | Node-RED crashes | No telemetry processing | Mosquitto queues messages | Restart Node-RED |
| E08 | Current > 2× threshold | Current reading | Immediate relay OFF (hard cutoff) | Manual reset |
| E09 | ESP32 memory overflow | WDT reset / crash | ESP32 reboots, reconnects | Auto |
| E10 | Invalid cmd/relay value | Unknown command string | Ignore, log, no action | Automatic |

---

*End of Document*
