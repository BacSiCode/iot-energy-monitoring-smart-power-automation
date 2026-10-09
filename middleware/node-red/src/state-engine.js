// IoT 55 state engine: validation, state machine, automation rules, event log.
// Node-RED function node body (inlined into flows.json by scripts/build-flows.js).
//
// Input msg.topic:
//   iot55/device01/telemetry | status | event | relay/state   (MQTT uplink)
//   internal/tick      every 5 s: scheduler, heartbeat timeout, relay feedback timeout
//   internal/command   HTTP API body { command, value }
// Outputs:
//   1 MQTT downlink commands   2 event log (MQTT)   3 system state (MQTT, retained)   4 HTTP response

const DEVICE_ID = 'device01';
const BASE = 'iot55/' + DEVICE_ID + '/';
const HYSTERESIS = 30;
const RELAY_FEEDBACK_TIMEOUT_MS = 10000;
const MAX_EVENTS = 100;
const MAX_HISTORY = 60;

const cfg = {
    shutdownDelayMs: numberEnv('AUTO_SHUTDOWN_DELAY_SECONDS', 10) * 1000,
    offlineTimeoutMs: numberEnv('DEVICE_TIMEOUT_SECONDS', 15) * 1000,
    storeSource: textEnv('STORE_STATUS_SOURCE', 'SWITCH'), // SWITCH | SCHEDULE
    safetyMode: textEnv('SAFETY_MODE', 'ALERT_ONLY'),      // ALERT_ONLY | CUTOFF
    openTime: env.get('STORE_OPEN_TIME') || '08:00',
    closeTime: env.get('STORE_CLOSE_TIME') || '22:00'
};

const now = Date.now();
const stored = flow.get('iot55');
const s = stored && stored.schema === 2 ? stored : initialState();
const out = { commands: [], events: [], reply: null };
const topic = String(msg.topic || '');

if (topic === 'internal/tick') onTick();
else if (topic === 'internal/command') onCommand(msg.payload || {});
else {
    const payload = parseJson(msg.payload);
    if (payload === undefined) logEvent('INVALID_PAYLOAD', 'WARNING', 'MALFORMED_JSON', { topic });
    else if (topic === BASE + 'telemetry') onTelemetry(payload);
    else if (topic === BASE + 'status') onStatus(payload);
    else if (topic === BASE + 'event') onDeviceEvent(payload);
    else if (topic === BASE + 'relay/state') onRelayState(payload);
    else logEvent('INVALID_PAYLOAD', 'WARNING', 'UNEXPECTED_TOPIC', { topic });
}

evaluate();
s.config = cfg;
s.countdownMs = s.pendingSince ? Math.max(0, cfg.shutdownDelayMs - (now - s.pendingSince)) : null;
s.updatedAt = now;
flow.set('iot55', s);

const stateMsg = { topic: BASE + 'system/state', retain: true, payload: JSON.stringify(snapshot()) };
let httpReply = null;
if (out.reply) {
    httpReply = msg;
    httpReply.statusCode = out.reply.statusCode;
    httpReply.headers = { 'content-type': 'application/json' };
    httpReply.payload = out.reply.body;
}
return [out.commands, out.events, stateMsg, httpReply];

// ---------------------------------------------------------------------------
// Uplink handlers
// ---------------------------------------------------------------------------
function onTelemetry(p) {
    const error = validateTelemetry(p);
    if (error) return logEvent('INVALID_PAYLOAD', 'WARNING', error, { topic: BASE + 'telemetry' });
    markSeen();
    const first = !s.initialized;
    const prev = { presence: s.presence, override: s.override, mode: s.mode };

    s.currentSignal = p.current_signal;
    s.currentA = Number.isFinite(Number(p.current_a)) ? Number(p.current_a) : null;
    s.threshold = Number.isInteger(p.threshold_signal) ? p.threshold_signal : s.threshold;
    s.thresholdA = Number.isFinite(Number(p.threshold_a)) ? Number(p.threshold_a) : s.thresholdA;
    s.presence = p.presence;
    s.storeSwitch = p.store_status;
    s.relay = p.relay;
    s.mode = p.mode === 'MANUAL' ? 'MANUAL' : 'AUTO';
    s.override = p.override_active === true;
    s.overrideSource = p.override_source || null;
    s.wifiRssi = p.wifi_rssi ?? null;
    s.lastTelemetry = now;
    s.initialized = true;
    s.history.push({ t: now, signal: s.currentSignal, a: s.currentA });
    if (s.history.length > MAX_HISTORY) s.history = s.history.slice(-MAX_HISTORY);

    if (first) return;
    if (prev.presence !== s.presence) {
        logEvent(s.presence ? 'PRESENCE_DETECTED' : 'PRESENCE_CLEARED', 'INFO', s.presence ? 'PIR_MOTION' : 'PRESENCE_HOLD_EXPIRED');
    }
    if (prev.override !== s.override) {
        logEvent(s.override ? 'MANUAL_OVERRIDE' : 'OVERRIDE_CLEARED', 'INFO', s.override ? (s.overrideSource || 'UNKNOWN') : 'CLEARED');
    }
    if (prev.mode !== s.mode) {
        logEvent(s.mode === 'AUTO' ? 'AUTOMATION_ENABLED' : 'AUTOMATION_DISABLED', 'INFO', 'MODE_' + s.mode);
    }
}

function validateTelemetry(p) {
    if (!isObject(p)) return 'PAYLOAD_NOT_OBJECT';
    if (p.device_id !== DEVICE_ID) return 'DEVICE_ID_MISMATCH';
    if (!Number.isInteger(p.current_signal) || p.current_signal < 0 || p.current_signal > 4095) return 'CURRENT_SIGNAL_INVALID';
    if (typeof p.presence !== 'boolean') return 'PRESENCE_INVALID';
    if (p.store_status !== 'OPEN' && p.store_status !== 'CLOSED') return 'STORE_STATUS_INVALID';
    if (typeof p.relay !== 'boolean') return 'RELAY_INVALID';
    return null;
}

function onStatus(p) {
    if (!isObject(p)) return logEvent('INVALID_PAYLOAD', 'WARNING', 'PAYLOAD_NOT_OBJECT', { topic: BASE + 'status' });
    if (p.online === false) return setOffline('LWT_OFFLINE');
    if (p.online === true) {
        s.firmware = p.fw || s.firmware;
        s.ip = p.ip || s.ip;
        s.mqttConnects = p.mqtt_connects ?? s.mqttConnects;
        markSeen();
    }
}

function onDeviceEvent(p) {
    if (!isObject(p) || p.origin === 'middleware') return; // ignore our own events (loop guard)
    if (typeof p.event_type !== 'string') return logEvent('INVALID_PAYLOAD', 'WARNING', 'EVENT_TYPE_MISSING', { topic: BASE + 'event' });
    if (p.event_type === 'COMMAND_REJECTED') s.pendingRelay = null;
    if (p.event_type === 'AUTO_SHUTDOWN') s.autoShutdownActive = true; // local fallback on the device
    pushEvent(Object.assign({}, p, { origin: 'device', received_at: new Date(now).toISOString(), timestamp_ms: now }));
}

function onRelayState(p) {
    if (!isObject(p) || (p.state !== 'ON' && p.state !== 'OFF')) {
        return logEvent('INVALID_PAYLOAD', 'WARNING', 'RELAY_STATE_INVALID', { topic: BASE + 'relay/state' });
    }
    const on = p.state === 'ON';
    const changed = s.relay !== null && s.relay !== on;
    s.relay = on;
    s.relayChangedBy = p.changed_by || null;
    if (on) s.autoShutdownActive = false;
    if (s.pendingRelay && s.pendingRelay.expected === on) s.pendingRelay = null;
    if (s.fault === 'RELAY_NO_FEEDBACK') {
        s.fault = null;
        logEvent('FAULT_CLEARED', 'INFO', 'RELAY_FEEDBACK_RECEIVED');
    }
    if (changed) logEvent(on ? 'RELAY_ON' : 'RELAY_OFF', 'INFO', 'CHANGED_BY_' + (s.relayChangedBy || 'UNKNOWN'));
}

// ---------------------------------------------------------------------------
// Timer: scheduler, heartbeat, relay feedback
// ---------------------------------------------------------------------------
function onTick() {
    s.scheduleStatus = scheduleStatusAt(new Date(now));
    if (s.online && s.lastSeen && now - s.lastSeen > cfg.offlineTimeoutMs) setOffline('HEARTBEAT_TIMEOUT');
    if (s.pendingRelay && s.online && now - s.pendingRelay.at > RELAY_FEEDBACK_TIMEOUT_MS) {
        s.pendingRelay = null;
        s.fault = 'RELAY_NO_FEEDBACK';
        logEvent('FAULT', 'ERROR', 'RELAY_NO_FEEDBACK');
    }
}

function scheduleStatusAt(date) {
    const hhmm = String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    const open = cfg.openTime;
    const close = cfg.closeTime;
    const isOpen = open <= close ? hhmm >= open && hhmm < close : hhmm >= open || hhmm < close;
    return isOpen ? 'OPEN' : 'CLOSED';
}

// ---------------------------------------------------------------------------
// Rule engine + state machine (runs after every input)
// ---------------------------------------------------------------------------
function evaluate() {
    if (!s.scheduleStatus) s.scheduleStatus = scheduleStatusAt(new Date(now));
    const store = cfg.storeSource === 'SCHEDULE' ? s.scheduleStatus : s.storeSwitch;
    if (store && s.storeStatus && store !== s.storeStatus) {
        logEvent(store === 'CLOSED' ? 'STORE_CLOSED' : 'STORE_OPENED', 'INFO', 'SOURCE_' + cfg.storeSource);
        if (store === 'OPEN' && s.autoShutdownActive && automationActive() && s.relay === false && s.online) {
            sendRelay('ON', 'AUTO_RESTORE');
            logEvent('AUTO_RESTORE', 'INFO', 'STORE_OPENED_AFTER_AUTO_SHUTDOWN');
        }
        if (store === 'OPEN') s.autoShutdownActive = false;
    }
    s.storeStatus = store || s.storeStatus;

    if (s.initialized) {
        evaluateAbnormalCurrent();
        evaluateAfterHours();
    }
    updateSystemState();
}

// RULE 3: abnormal current (with hysteresis) + optional safety cutoff.
function evaluateAbnormalCurrent() {
    const above = s.currentSignal > s.threshold;
    const below = s.currentSignal < Math.max(0, s.threshold - HYSTERESIS);
    if (!s.alarm.active && above) {
        s.alarm = { active: true, acknowledged: false, since: now, peakSignal: s.currentSignal, ackAt: null };
        logEvent('ABNORMAL_CURRENT', 'WARNING', 'CURRENT_ABOVE_THRESHOLD');
        if (cfg.safetyMode === 'CUTOFF' && s.relay && s.online) {
            sendRelay('OFF', 'SAFETY_CUTOFF');
            logEvent('SAFETY_CUTOFF', 'CRITICAL', 'ABNORMAL_CURRENT_CUTOFF');
        }
    } else if (s.alarm.active && below) {
        s.alarm = { active: false, acknowledged: false, since: null, peakSignal: null, ackAt: null };
        logEvent('CURRENT_NORMAL', 'INFO', 'CURRENT_BELOW_THRESHOLD');
    } else if (s.alarm.active) {
        s.alarm.peakSignal = Math.max(s.alarm.peakSignal || 0, s.currentSignal);
    }
}

// RULE 1 (after-hours shutdown, debounced) and RULE 2 (presence protection).
function evaluateAfterHours() {
    const closed = s.storeStatus === 'CLOSED';
    const commandInFlight = s.pendingRelay && s.pendingRelay.expected === false;
    const eligible = s.online && closed && !s.presence && s.relay === true && automationActive() && !commandInFlight;
    if (!eligible) {
        if (s.pendingSince && closed && s.presence) logEvent('SHUTDOWN_CANCELLED', 'INFO', 'PRESENCE_DETECTED');
        s.pendingSince = 0;
        return;
    }
    if (!s.pendingSince) {
        s.pendingSince = now;
        return;
    }
    if (now - s.pendingSince >= cfg.shutdownDelayMs) {
        s.pendingSince = 0;
        s.autoShutdownActive = true;
        sendRelay('OFF', 'AUTO_RULE1');
        logEvent('AUTO_SHUTDOWN', 'INFO', 'AFTER_HOURS_NO_PRESENCE');
    }
}

// Explicit FSM: the state is derived from inputs by priority; transitions are logged.
function updateSystemState() {
    let next;
    if (!s.online) next = 'OFFLINE';
    else if (s.fault) next = 'FAULT';
    else if (s.alarm.active) next = 'ABNORMAL_CURRENT';
    else if (!automationActive()) next = 'MANUAL_OVERRIDE';
    else if (s.storeStatus === 'CLOSED' && s.presence) next = 'OCCUPIED';
    else if (s.storeStatus === 'CLOSED' && s.autoShutdownActive && s.relay === false) next = 'AUTO_SHUTDOWN';
    else if (s.storeStatus === 'CLOSED') next = 'AFTER_HOURS';
    else next = 'NORMAL';
    if (next !== s.systemState) {
        const from = s.systemState;
        s.systemState = next;
        s.stateSince = now;
        logEvent('STATE_CHANGED', 'DEBUG', from + '->' + next);
    }
}

// ---------------------------------------------------------------------------
// Remote commands (HTTP API -> MQTT downlink)
// ---------------------------------------------------------------------------
function onCommand(body) {
    const command = String(body.command || '').toUpperCase();
    const needsDevice = ['RELAY_ON', 'RELAY_OFF', 'OVERRIDE_ON', 'OVERRIDE_OFF'];
    if (needsDevice.includes(command) && !s.online) return reply(503, { error: 'Device offline', command });

    switch (command) {
        case 'RELAY_ON':
        case 'RELAY_OFF':
            sendRelay(command === 'RELAY_ON' ? 'ON' : 'OFF', 'DASHBOARD');
            break;
        case 'MODE_AUTO':
        case 'MODE_MANUAL':
            // Retained so the device restores the mode after a reboot/reconnect.
            sendCommand('cmd/mode', { mode: command === 'MODE_AUTO' ? 'AUTO' : 'MANUAL' }, true);
            break;
        case 'OVERRIDE_ON':
        case 'OVERRIDE_OFF':
            sendCommand('cmd/override', { override: command === 'OVERRIDE_ON' ? 'ACTIVE' : 'CLEAR' }, false);
            break;
        case 'ACK_ALARM':
            if (!s.alarm.active) return reply(409, { error: 'No active alarm' });
            if (s.alarm.acknowledged) return reply(409, { error: 'Alarm already acknowledged' });
            s.alarm.acknowledged = true;
            s.alarm.ackAt = now;
            sendCommand('cmd/alarm', { action: 'ACK' }, false);
            logEvent('ALERT_ACKNOWLEDGED', 'INFO', 'ACK_BY_DASHBOARD');
            break;
        case 'SET_THRESHOLD': {
            const value = Number(body.value);
            if (!Number.isInteger(value) || value < 1 || value > 4095) {
                return reply(400, { error: 'Threshold must be an integer 1..4095', value: body.value ?? null });
            }
            sendCommand('cmd/threshold', { threshold_signal: value }, true);
            break;
        }
        default:
            return reply(400, { error: 'Unsupported command', command: body.command ?? null });
    }
    logEvent('REMOTE_COMMAND', 'INFO', command + (body.value !== undefined ? '=' + body.value : ''), { source: 'DASHBOARD' });
    reply(202, { accepted: true, command });
}

function sendRelay(command, source) {
    s.pendingRelay = { expected: command === 'ON', at: now, source };
    sendCommand('cmd/relay', { command, source }, false);
}

function sendCommand(suffix, body, retain) {
    const payload = Object.assign({ device_id: DEVICE_ID }, body, { source: body.source || 'NODE_RED', timestamp_ms: now });
    out.commands.push({ topic: BASE + suffix, retain, qos: 1, payload: JSON.stringify(payload) });
    s.lastCommand = { topic: BASE + suffix, payload, at: now };
}

function reply(statusCode, body) {
    out.reply = { statusCode, body };
}

// ---------------------------------------------------------------------------
// Connectivity
// ---------------------------------------------------------------------------
function markSeen() {
    s.lastSeen = now;
    if (!s.online) {
        s.online = true;
        logEvent('DEVICE_ONLINE', 'INFO', 'MQTT_CONNECTED');
    }
}

function setOffline(reason) {
    s.pendingSince = 0;
    s.pendingRelay = null;
    if (!s.online) return;
    s.online = false;
    logEvent('DEVICE_OFFLINE', 'WARNING', reason);
}

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------
function logEvent(type, severity, reason, extra) {
    const event = Object.assign({
        timestamp: new Date(now).toISOString(),
        timestamp_ms: now,
        device_id: DEVICE_ID,
        origin: 'middleware',
        event_type: type,
        severity,
        reason,
        current_a: s.currentA,
        current_signal: s.currentSignal,
        state: s.systemState
    }, extra || {});
    pushEvent(event);
    out.events.push({ topic: BASE + 'event', payload: JSON.stringify(event) });
}

function pushEvent(event) {
    s.events.unshift(event);
    if (s.events.length > MAX_EVENTS) s.events.length = MAX_EVENTS;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function automationActive() {
    return s.mode === 'AUTO' && !s.override;
}

function snapshot() {
    return {
        device_id: DEVICE_ID,
        timestamp: new Date(now).toISOString(),
        online: s.online,
        state: s.systemState,
        store_status: s.storeStatus,
        store_switch: s.storeSwitch,
        schedule_status: s.scheduleStatus,
        presence: s.presence,
        relay: s.relay,
        mode: s.mode,
        override_active: s.override,
        current_signal: s.currentSignal,
        current_a: s.currentA,
        threshold_signal: s.threshold,
        alarm: s.alarm,
        fault: s.fault,
        countdown_ms: s.countdownMs
    };
}

function parseJson(value) {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch (error) { return undefined; }
}

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function numberEnv(name, fallback) {
    const raw = env.get(name);
    if (raw === undefined || raw === null || raw === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function textEnv(name, fallback) {
    return String(env.get(name) || fallback).toUpperCase();
}

function initialState() {
    return {
        schema: 2,
        initialized: false,
        online: false,
        lastSeen: 0,
        lastTelemetry: 0,
        firmware: null,
        ip: null,
        mqttConnects: null,
        wifiRssi: null,
        systemState: 'OFFLINE',
        stateSince: now,
        storeStatus: null,
        storeSwitch: null,
        scheduleStatus: null,
        presence: false,
        relay: null,
        relayChangedBy: null,
        mode: 'AUTO',
        override: false,
        overrideSource: null,
        currentSignal: 0,
        currentA: null,
        threshold: 700,
        thresholdA: null,
        alarm: { active: false, acknowledged: false, since: null, peakSignal: null, ackAt: null },
        fault: null,
        pendingSince: 0,
        pendingRelay: null,
        autoShutdownActive: false,
        lastCommand: null,
        events: [],
        history: []
    };
}
