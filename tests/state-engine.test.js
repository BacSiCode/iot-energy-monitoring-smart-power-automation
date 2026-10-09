// Unit tests for the Node-RED state engine (the exact code inlined into flows.json).
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ENGINE = fs.readFileSync(path.join(__dirname, '../middleware/node-red/src/state-engine.js'), 'utf8');
const BASE = 'iot55/device01/';

function createEngine(envVars = {}) {
  const context = {};
  const clock = { now: new Date(2026, 9, 9, 10, 0, 0).getTime() }; // 10:00 local
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  }
  const flow = { get: (k) => context[k], set: (k, v) => { context[k] = v; } };
  const env = { get: (k) => envVars[k] };
  const fn = new Function('msg', 'flow', 'env', 'node', 'Date', ENGINE);
  const send = (msg) => {
    const [commands, events, state, reply] = fn(msg, flow, env, { warn() {} }, FakeDate);
    return {
      commands: commands.map((m) => ({ ...m, body: JSON.parse(m.payload) })),
      events: events.map((m) => JSON.parse(m.payload)),
      state: JSON.parse(state.payload),
      reply
    };
  };
  return {
    mqtt: (suffix, payload) => send({ topic: BASE + suffix, payload: typeof payload === 'string' ? payload : JSON.stringify(payload) }),
    command: (body) => send({ topic: 'internal/command', payload: body }),
    tick: () => send({ topic: 'internal/tick' }),
    advance: (ms) => { clock.now += ms; },
    setTime: (h, m) => { const d = new Date(clock.now); d.setHours(h, m, 0, 0); clock.now = d.getTime(); },
    get s() { return context.iot55; }
  };
}

function telemetry(overrides = {}) {
  return {
    device_id: 'device01', current_signal: 350, current_a: 1.71, threshold_signal: 700,
    presence: false, store_status: 'OPEN', relay: true, mode: 'AUTO', override_active: false, ...overrides
  };
}

const types = (result) => result.events.map((e) => e.event_type);

// Device online with relay ON, store OPEN.
function onlineEngine(env) {
  const e = createEngine(env);
  e.mqtt('status', { device_id: 'device01', online: true });
  e.mqtt('relay/state', { state: 'ON', changed_by: 'DASHBOARD' });
  e.mqtt('telemetry', telemetry());
  return e;
}

test('TEST-01 normal operation -> NORMAL, no command', () => {
  const e = onlineEngine();
  const r = e.mqtt('telemetry', telemetry());
  assert.equal(r.state.state, 'NORMAL');
  assert.equal(r.state.online, true);
  assert.equal(r.commands.length, 0);
});

test('TEST-02 closed + no presence + load ON -> auto shutdown after delay, restore on open', () => {
  const e = onlineEngine({ AUTO_SHUTDOWN_DELAY_SECONDS: '10' });
  let r = e.mqtt('telemetry', telemetry({ store_status: 'CLOSED' }));
  assert.ok(types(r).includes('STORE_CLOSED'));
  assert.equal(r.state.state, 'AFTER_HOURS');
  assert.equal(r.commands.length, 0, 'no shutdown before delay');
  assert.equal(r.state.countdown_ms, 10000);

  e.advance(5000);
  r = e.mqtt('telemetry', telemetry({ store_status: 'CLOSED' }));
  assert.equal(r.commands.length, 0);

  e.advance(5000);
  r = e.mqtt('telemetry', telemetry({ store_status: 'CLOSED' }));
  assert.equal(r.commands.length, 1);
  assert.equal(r.commands[0].topic, BASE + 'cmd/relay');
  assert.deepEqual([r.commands[0].body.command, r.commands[0].body.source], ['OFF', 'AUTO_RULE1']);
  const shutdown = r.events.find((ev) => ev.event_type === 'AUTO_SHUTDOWN');
  assert.equal(shutdown.reason, 'AFTER_HOURS_NO_PRESENCE');
  assert.equal(shutdown.current_a, 1.71);

  r = e.mqtt('relay/state', { state: 'OFF', changed_by: 'AUTO_RULE1' });
  assert.ok(types(r).includes('RELAY_OFF'));
  assert.equal(r.state.state, 'AUTO_SHUTDOWN');

  r = e.mqtt('telemetry', telemetry({ store_status: 'OPEN', relay: false }));
  assert.ok(types(r).includes('AUTO_RESTORE'));
  assert.deepEqual([r.commands[0].body.command, r.commands[0].body.source], ['ON', 'AUTO_RESTORE']);
});

test('TEST-03 closed + presence -> never shut down, countdown cancelled', () => {
  const e = onlineEngine({ AUTO_SHUTDOWN_DELAY_SECONDS: '10' });
  e.mqtt('telemetry', telemetry({ store_status: 'CLOSED' }));
  e.advance(5000);
  let r = e.mqtt('telemetry', telemetry({ store_status: 'CLOSED', presence: true }));
  assert.ok(types(r).includes('PRESENCE_DETECTED'));
  assert.ok(types(r).includes('SHUTDOWN_CANCELLED'));
  assert.equal(r.state.state, 'OCCUPIED');
  for (let i = 0; i < 10; i++) {
    e.advance(5000);
    r = e.mqtt('telemetry', telemetry({ store_status: 'CLOSED', presence: true }));
    assert.equal(r.commands.length, 0);
  }
});

test('TEST-04 abnormal current -> alert, acknowledge, recovery', () => {
  const e = onlineEngine();
  let r = e.mqtt('telemetry', telemetry({ current_signal: 1200 }));
  assert.ok(types(r).includes('ABNORMAL_CURRENT'));
  assert.equal(r.events.find((ev) => ev.event_type === 'ABNORMAL_CURRENT').severity, 'WARNING');
  assert.equal(r.state.state, 'ABNORMAL_CURRENT');
  assert.equal(r.commands.length, 0, 'ALERT_ONLY mode does not cut the relay');

  r = e.mqtt('telemetry', telemetry({ current_signal: 1300 }));
  assert.ok(!types(r).includes('ABNORMAL_CURRENT'), 'alert raised once per episode');

  r = e.command({ command: 'ACK_ALARM' });
  assert.equal(r.reply.statusCode, 202);
  assert.equal(r.commands[0].topic, BASE + 'cmd/alarm');
  assert.ok(types(r).includes('ALERT_ACKNOWLEDGED'));
  assert.equal(e.command({ command: 'ACK_ALARM' }).reply.statusCode, 409);

  r = e.mqtt('telemetry', telemetry({ current_signal: 690 }));
  assert.ok(!types(r).includes('CURRENT_NORMAL'), 'hysteresis keeps alarm near threshold');
  r = e.mqtt('telemetry', telemetry({ current_signal: 300 }));
  assert.ok(types(r).includes('CURRENT_NORMAL'));
  assert.equal(r.state.state, 'NORMAL');
});

test('TEST-04b abnormal current with SAFETY_MODE=CUTOFF turns the relay off', () => {
  const e = onlineEngine({ SAFETY_MODE: 'CUTOFF' });
  const r = e.mqtt('telemetry', telemetry({ current_signal: 2000 }));
  assert.ok(types(r).includes('SAFETY_CUTOFF'));
  assert.deepEqual([r.commands[0].body.command, r.commands[0].body.source], ['OFF', 'SAFETY_CUTOFF']);
});

test('TEST-05/06 remote relay OFF and ON', () => {
  const e = onlineEngine();
  let r = e.command({ command: 'RELAY_OFF' });
  assert.equal(r.reply.statusCode, 202);
  assert.deepEqual(r.commands[0].body.command, 'OFF');
  assert.equal(r.commands[0].body.source, 'DASHBOARD');
  assert.equal(r.commands[0].retain, false);
  assert.ok(types(r).includes('REMOTE_COMMAND'));
  r = e.mqtt('relay/state', { state: 'OFF', changed_by: 'DASHBOARD' });
  assert.ok(types(r).includes('RELAY_OFF'));

  r = e.command({ command: 'RELAY_ON' });
  assert.equal(r.commands[0].body.command, 'ON');
});

test('TEST-07 manual override suspends automation', () => {
  const e = onlineEngine({ AUTO_SHUTDOWN_DELAY_SECONDS: '10' });
  let r = e.command({ command: 'OVERRIDE_ON' });
  assert.equal(r.commands[0].topic, BASE + 'cmd/override');
  assert.equal(r.commands[0].body.override, 'ACTIVE');

  r = e.mqtt('telemetry', telemetry({ override_active: true, override_source: 'LOCAL_BUTTON' }));
  assert.ok(types(r).includes('MANUAL_OVERRIDE'));
  assert.equal(r.state.state, 'MANUAL_OVERRIDE');
  for (let i = 0; i < 5; i++) {
    e.advance(5000);
    r = e.mqtt('telemetry', telemetry({ override_active: true, store_status: 'CLOSED' }));
    assert.equal(r.commands.length, 0);
  }
  r = e.command({ command: 'MODE_MANUAL' });
  assert.equal(r.commands[0].topic, BASE + 'cmd/mode');
  assert.equal(r.commands[0].retain, true, 'mode is retained so the device restores it');
});

test('TEST-08 MQTT disconnect (LWT) and heartbeat timeout -> OFFLINE, recovery -> ONLINE', () => {
  const e = onlineEngine();
  let r = e.mqtt('status', { device_id: 'device01', online: false, state: 'OFFLINE' });
  assert.ok(types(r).includes('DEVICE_OFFLINE'));
  assert.equal(r.state.state, 'OFFLINE');
  assert.equal(e.command({ command: 'RELAY_ON' }).reply.statusCode, 503);

  r = e.mqtt('telemetry', telemetry());
  assert.ok(types(r).includes('DEVICE_ONLINE'));
  assert.equal(r.state.state, 'NORMAL');

  e.advance(16000);
  r = e.tick();
  assert.equal(r.events.find((ev) => ev.event_type === 'DEVICE_OFFLINE').reason, 'HEARTBEAT_TIMEOUT');
});

test('TEST-09 invalid payloads are rejected without changing state', () => {
  const e = onlineEngine();
  let r = e.mqtt('telemetry', 'not-json');
  assert.equal(r.events[0].event_type, 'INVALID_PAYLOAD');
  assert.equal(r.events[0].reason, 'MALFORMED_JSON');
  r = e.mqtt('telemetry', telemetry({ device_id: 'device99', relay: false }));
  assert.equal(r.events[0].reason, 'DEVICE_ID_MISMATCH');
  r = e.mqtt('telemetry', telemetry({ current_signal: 'abc' }));
  assert.equal(r.events[0].reason, 'CURRENT_SIGNAL_INVALID');
  assert.equal(r.state.relay, true);
  assert.equal(e.command({ command: 'EXPLODE' }).reply.statusCode, 400);
  assert.equal(e.command({ command: 'SET_THRESHOLD', value: 5000 }).reply.statusCode, 400);
  assert.equal(e.command({ command: 'SET_THRESHOLD', value: 1.5 }).reply.statusCode, 400);
  r = e.command({ command: 'SET_THRESHOLD', value: 900 });
  assert.equal(r.reply.statusCode, 202);
  assert.equal(r.commands[0].body.threshold_signal, 900);
});

test('TEST-10 device events are logged once and own events are ignored', () => {
  const e = onlineEngine();
  const before = e.s.events.length;
  e.mqtt('event', { device_id: 'device01', origin: 'device', event_type: 'COMMAND_REJECTED', severity: 'WARNING', reason: 'AUTOMATION_SUSPENDED' });
  e.mqtt('event', { device_id: 'device01', origin: 'middleware', event_type: 'REMOTE_COMMAND' });
  assert.equal(e.s.events.length, before + 1);
  assert.equal(e.s.events[0].event_type, 'COMMAND_REJECTED');
});

test('TEST-11 scheduler drives store status when STORE_STATUS_SOURCE=SCHEDULE', () => {
  const e = onlineEngine({ STORE_STATUS_SOURCE: 'SCHEDULE', STORE_OPEN_TIME: '08:00', STORE_CLOSE_TIME: '22:00' });
  assert.equal(e.s.storeStatus, 'OPEN');
  e.setTime(22, 0);
  const r = e.tick();
  assert.ok(types(r).includes('STORE_CLOSED'));
  assert.equal(r.state.store_status, 'CLOSED');
  assert.equal(r.state.store_switch, 'OPEN', 'switch is ignored in SCHEDULE mode');
});

test('TEST-12 missing relay feedback -> FAULT, cleared by feedback', () => {
  const e = onlineEngine();
  e.command({ command: 'RELAY_OFF' });
  e.advance(11000);
  e.mqtt('status', { device_id: 'device01', online: true });
  let r = e.tick();
  assert.ok(types(r).includes('FAULT'));
  assert.equal(r.state.state, 'FAULT');
  r = e.mqtt('relay/state', { state: 'OFF', changed_by: 'DASHBOARD' });
  assert.ok(types(r).includes('FAULT_CLEARED'));
  assert.equal(r.state.state, 'NORMAL');
});
