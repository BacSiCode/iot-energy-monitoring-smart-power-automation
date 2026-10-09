// Software twin of the ESP32 firmware (same topics, payloads and command rules).
// Used for end-to-end tests of broker + Node-RED + API when no Wokwi/hardware
// is attached. It is a TEST DOUBLE - the real device logic is firmware/esp32/src/main.cpp.
const mqtt = require('mqtt');
const { EventEmitter } = require('events');

const BASE = 'iot55/device01/';
const LWT = JSON.stringify({ device_id: 'device01', online: false, state: 'OFFLINE' });
const toAmps = (signal) => Math.round((signal * 20 / 4095) * 100) / 100;

class VirtualDevice extends EventEmitter {
  constructor({ url = 'mqtt://localhost:1883', telemetryMs = 1000 } = {}) {
    super();
    this.url = url;
    this.telemetryMs = telemetryMs;
    this.state = {
      relayOn: false, relayChangedBy: 'BOOT', automationEnabled: true, overrideActive: false, overrideSource: 'NONE',
      threshold: 700, currentSignal: 350, presence: false, storeClosed: false, alarmActive: false, alarmAcknowledged: false
    };
    this.connects = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(this.url, {
        clientId: 'device01-virtual-' + Math.random().toString(16).slice(2, 8),
        keepalive: 5, reconnectPeriod: 0, clean: true,
        will: { topic: BASE + 'status', payload: LWT, qos: 1, retain: true }
      });
      this.client.once('connect', () => {
        this.connects += 1;
        this.client.subscribe(BASE + 'cmd/#', { qos: 1 });
        this.publishStatus();
        this.publishRelayState();
        this.publishTelemetry();
        this.timer = setInterval(() => this.publishTelemetry(), this.telemetryMs);
        resolve();
      });
      this.client.once('error', reject);
      this.client.on('message', (topic, payload) => this.onCommand(topic, payload.toString()));
    });
  }

  // Simulates a network failure: socket destroyed without DISCONNECT -> broker sends LWT.
  dropConnection() {
    clearInterval(this.timer);
    this.client.stream.destroy();
    this.client.end(true);
  }

  async close() {
    clearInterval(this.timer);
    if (this.client) await new Promise((r) => this.client.end(false, {}, r));
  }

  // --- sensors (what a tester would do on the Wokwi board) ---
  setStoreClosed(closed) { this.state.storeClosed = closed; this.publishTelemetry(); }
  setPresence(present) { this.state.presence = present; this.publishTelemetry(); }
  setCurrent(signal) {
    const s = this.state;
    s.currentSignal = signal;
    if (!s.alarmActive && signal > s.threshold) { s.alarmActive = true; s.alarmAcknowledged = false; }
    else if (s.alarmActive && signal < s.threshold - 30) { s.alarmActive = false; s.alarmAcknowledged = false; }
    this.publishTelemetry();
  }

  // --- uplink ---
  stamp(extra) {
    return { device_id: 'device01', timestamp: new Date().toISOString(), uptime_ms: Math.round(process.uptime() * 1000), ...extra };
  }

  pub(suffix, body, retain = false) {
    if (this.client && this.client.connected) this.client.publish(BASE + suffix, JSON.stringify(body), { qos: 0, retain });
  }

  publishStatus() {
    const s = this.state;
    this.pub('status', this.stamp({ online: true, state: 'ONLINE', fw: 'virtual', mqtt_connects: this.connects,
      mode: s.automationEnabled ? 'AUTO' : 'MANUAL', override_active: s.overrideActive, threshold_signal: s.threshold }), true);
  }

  publishRelayState() {
    this.pub('relay/state', this.stamp({ state: this.state.relayOn ? 'ON' : 'OFF', changed_by: this.state.relayChangedBy }), true);
  }

  publishTelemetry() {
    const s = this.state;
    this.pub('telemetry', this.stamp({
      current_signal: s.currentSignal, current_a: toAmps(s.currentSignal), threshold_signal: s.threshold, threshold_a: toAmps(s.threshold),
      presence: s.presence, pir_raw: s.presence, store_status: s.storeClosed ? 'CLOSED' : 'OPEN', relay: s.relayOn,
      mode: s.automationEnabled ? 'AUTO' : 'MANUAL', override_active: s.overrideActive, override_source: s.overrideSource,
      abnormal_current: s.alarmActive, alarm_acknowledged: s.alarmAcknowledged, wifi_rssi: -50, fw: 'virtual'
    }));
  }

  event(type, severity, reason, detail) {
    this.pub('event', this.stamp({ origin: 'device', event_type: type, severity, reason, detail,
      current_signal: this.state.currentSignal, current_a: toAmps(this.state.currentSignal), relay: this.state.relayOn }));
  }

  // --- downlink: mirrors mqttCallback() in the firmware ---
  onCommand(topic, text) {
    if (!text) return;
    let doc;
    try { doc = JSON.parse(text); } catch { return this.event('INVALID_PAYLOAD', 'WARNING', 'MALFORMED_JSON', topic); }
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return this.event('INVALID_PAYLOAD', 'WARNING', 'MALFORMED_JSON', topic);
    if ((doc.device_id ?? 'device01') !== 'device01') return this.event('INVALID_PAYLOAD', 'WARNING', 'DEVICE_ID_MISMATCH', topic);
    const s = this.state;
    const cmd = topic.slice((BASE + 'cmd/').length);
    if (cmd === 'relay') {
      const source = String(doc.source || 'REMOTE').toUpperCase();
      if (doc.command !== 'ON' && doc.command !== 'OFF') return this.event('INVALID_PAYLOAD', 'WARNING', 'RELAY_COMMAND_MUST_BE_ON_OR_OFF', topic);
      if (source.startsWith('AUTO') && !(s.automationEnabled && !s.overrideActive)) {
        return this.event('COMMAND_REJECTED', 'WARNING', 'AUTOMATION_SUSPENDED', source);
      }
      s.relayOn = doc.command === 'ON';
      s.relayChangedBy = source;
      this.publishRelayState();
    } else if (cmd === 'mode') {
      if (doc.mode !== 'AUTO' && doc.mode !== 'MANUAL') return this.event('INVALID_PAYLOAD', 'WARNING', 'MODE_MUST_BE_AUTO_OR_MANUAL', topic);
      s.automationEnabled = doc.mode === 'AUTO';
      this.publishStatus();
    } else if (cmd === 'override') {
      if (doc.override !== 'ACTIVE' && doc.override !== 'CLEAR') return this.event('INVALID_PAYLOAD', 'WARNING', 'OVERRIDE_MUST_BE_ACTIVE_OR_CLEAR', topic);
      s.overrideActive = doc.override === 'ACTIVE';
      s.overrideSource = s.overrideActive ? 'REMOTE' : 'NONE';
      this.publishStatus();
    } else if (cmd === 'threshold') {
      const v = doc.threshold_signal;
      if (!Number.isInteger(v)) return this.event('INVALID_PAYLOAD', 'WARNING', 'THRESHOLD_MUST_BE_INTEGER', topic);
      if (v < 1 || v > 4095) return this.event('INVALID_PAYLOAD', 'WARNING', 'THRESHOLD_OUT_OF_RANGE_1_4095', topic);
      s.threshold = v;
      this.publishStatus();
    } else if (cmd === 'alarm') {
      if (doc.action !== 'ACK') return this.event('INVALID_PAYLOAD', 'WARNING', 'ALARM_ACTION_MUST_BE_ACK', topic);
      if (s.alarmActive) s.alarmAcknowledged = true;
    } else {
      return this.event('INVALID_PAYLOAD', 'WARNING', 'UNKNOWN_COMMAND_TOPIC', topic);
    }
    this.emit('command', cmd, doc);
    this.publishTelemetry();
  }
}

module.exports = { VirtualDevice, BASE };
