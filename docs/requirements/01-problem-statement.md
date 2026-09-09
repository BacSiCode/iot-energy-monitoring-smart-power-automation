# Problem Statement
## IoT Project #55 — Energy Monitoring & Smart Power Automation

**Version:** 1.0 | **Phase:** Week 1 | **Date:** 2026-09-09

---

## 1. Problem Statement

> **After store closing hours, electrical loads continue to draw power even when
> no staff or customers are present, resulting in measurable energy waste,
> increased operating costs, and avoidable environmental impact.**

### 1.1 Background

Retail stores, small offices, and commercial spaces routinely leave electrical
loads (lighting, fans, AC, display equipment) energised after closing hours:

- Staff may forget to turn off devices when leaving.
- No automated mechanism exists to detect that premises are unoccupied.
- Abnormal current events go undetected until a breaker trips.
- Managers have no real-time visibility outside of a monthly electricity bill.

### 1.2 Impact Metrics (Estimated)

| Metric | Typical Value |
|--------|--------------|
| Average idle load after hours | 500 W – 2 kW |
| Average after-hours duration | 10 – 14 h/day |
| Estimated annual waste | 1,825 – 10,220 kWh/store/year |
| Estimated annual cost (0.08 USD/kWh) | $146 – $818 USD/year/store |

---

## 2. Project Scope

### 2.1 In Scope

| # | Item |
|---|------|
| S01 | Real-time current monitoring (ACS712) |
| S02 | Human presence detection (PIR HC-SR501) |
| S03 | Time-based store schedule (open/close hours) |
| S04 | Automated relay control |
| S05 | MQTT communication: ESP32 ↔ Broker ↔ Node-RED |
| S06 | Node-RED automation rules (4 core rules) |
| S07 | Node-RED Dashboard (monitoring + remote control) |
| S08 | Event logging |
| S09 | Alert for abnormal current |
| S10 | State machine (8 states) |
| S11 | Wokwi simulation (primary demonstration) |
| S12 | Physical prototype with DC loads (optional bonus) |

### 2.2 Out of Scope

| Item | Reason |
|------|--------|
| 220V/110V AC mains switching | Safety |
| Multi-store management | Complexity |
| Cloud MQTT (AWS/Azure) | Not required |
| Mobile app | Dashboard sufficient |
| ML/predictive analytics | Over-engineering |

### 2.3 Assumptions

1. One controlled load circuit per device (device01).
2. Store schedule is time-of-day based.
3. Wi-Fi available at demo site.
4. Mosquitto runs locally (same LAN).
5. Wokwi simulation is the primary demo.

---

## 3. Definition of Done (DoD)

A deliverable is **Done** when:

- [ ] Implementation matches architecture design
- [ ] Tested against corresponding test case(s)
- [ ] No known critical bugs
- [ ] Committed with meaningful Git message
- [ ] Documentation updated
- [ ] Screenshot or video evidence captured
