// End-to-end scenarios against the running stack (docker compose up -d):
//   virtual device <-> Mosquitto <-> Node-RED <-> HTTP API (through nginx).
// Usage: node scripts/e2e.js [--broker mqtt://localhost:1883] [--api http://localhost:8080]
// Requires AUTO_SHUTDOWN_DELAY_SECONDS<=10 and DEVICE_TIMEOUT_SECONDS<=15 (the .env.example defaults).
const fs = require('fs');
const path = require('path');
const { VirtualDevice } = require('./lib/virtual-device');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const BROKER = arg('--broker', 'mqtt://localhost:1883');
const API = arg('--api', 'http://localhost:8080');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(pathname, body) {
  const res = await fetch(API + pathname, body ? {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  } : undefined);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const state = async () => (await api('/api/state')).body;

async function waitFor(description, predicate, timeoutMs = 20000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await state();
    if (await predicate(last)) return last;
    await sleep(250);
  }
  throw new Error(`timeout waiting for: ${description} (state=${last && last.systemState})`);
}
const hasEventSince = (s, type, since) => s.events.some((e) => e.event_type === type && e.timestamp_ms >= since);

const results = [];
async function scenario(id, title, fn) {
  const started = Date.now();
  try {
    const evidence = await fn(started);
    results.push({ id, title, ok: true, ms: Date.now() - started, evidence });
    console.log(`PASS ${id} ${title} - ${evidence}`);
  } catch (error) {
    results.push({ id, title, ok: false, ms: Date.now() - started, evidence: error.message });
    console.log(`FAIL ${id} ${title} - ${error.message}`);
  }
}

async function main() {
  console.log(`Broker ${BROKER} | API ${API}`);
  await api('/api/state').catch(() => { throw new Error(`API not reachable at ${API} - run docker compose up -d`); });
  let device = new VirtualDevice({ url: BROKER });
  await device.connect();
  await waitFor('device online', (s) => s.online && s.lastTelemetry > Date.now() - 3000);
  await api('/api/command', { command: 'MODE_AUTO' });
  await api('/api/command', { command: 'OVERRIDE_OFF' });
  await api('/api/command', { command: 'SET_THRESHOLD', value: 700 });

  await scenario('TEST-01', 'Normal operation', async () => {
    device.setStoreClosed(false); device.setPresence(false); device.setCurrent(350);
    await api('/api/command', { command: 'RELAY_ON' });
    const s = await waitFor('NORMAL with relay ON', (x) => x.systemState === 'NORMAL' && x.relay === true);
    return `state=${s.systemState} relay=ON current=${s.currentA}A`;
  });

  await scenario('TEST-02', 'Closed + no presence + load ON -> auto shutdown', async (t0) => {
    device.setStoreClosed(true);
    const s = await waitFor('AUTO_SHUTDOWN', (x) => x.systemState === 'AUTO_SHUTDOWN' && hasEventSince(x, 'AUTO_SHUTDOWN', t0), 25000);
    if (device.state.relayOn) throw new Error('device relay still ON');
    return `relay OFF on device after ${((Date.now() - t0) / 1000).toFixed(1)}s (changed_by=${device.state.relayChangedBy})`;
  });

  await scenario('TEST-02b', 'Store opens after auto shutdown -> auto restore', async (t0) => {
    device.setStoreClosed(false);
    await waitFor('AUTO_RESTORE', (x) => x.relay === true && hasEventSince(x, 'AUTO_RESTORE', t0));
    return `relay ON on device (changed_by=${device.state.relayChangedBy})`;
  });

  await scenario('TEST-03', 'Closed + presence -> no shutdown', async (t0) => {
    device.setPresence(true); device.setStoreClosed(true);
    await waitFor('OCCUPIED', (x) => x.systemState === 'OCCUPIED');
    await sleep(14000);
    const s = await state();
    if (!device.state.relayOn || hasEventSince(s, 'AUTO_SHUTDOWN', t0)) throw new Error('load was switched off');
    device.setPresence(false); device.setStoreClosed(false);
    return 'relay stayed ON for 14s while OCCUPIED';
  });

  await scenario('TEST-04', 'Abnormal current -> alert -> ACK -> recovery', async (t0) => {
    device.setCurrent(1500);
    await waitFor('ABNORMAL_CURRENT', (x) => x.systemState === 'ABNORMAL_CURRENT' && hasEventSince(x, 'ABNORMAL_CURRENT', t0));
    const ack = await api('/api/command', { command: 'ACK_ALARM' });
    if (ack.status !== 202) throw new Error('ACK rejected ' + ack.status);
    await waitFor('device acknowledged', () => device.state.alarmAcknowledged === true, 5000);
    device.setCurrent(300);
    await waitFor('CURRENT_NORMAL', (x) => x.systemState === 'NORMAL' && hasEventSince(x, 'CURRENT_NORMAL', t0));
    return 'ABNORMAL_CURRENT, ALERT_ACKNOWLEDGED (buzzer silenced on device), CURRENT_NORMAL';
  });

  await scenario('TEST-05', 'Remote relay OFF', async () => {
    const r = await api('/api/command', { command: 'RELAY_OFF' });
    await waitFor('relay OFF', (x) => x.relay === false && !device.state.relayOn, 5000);
    return `HTTP ${r.status}, device relay OFF, relay/state confirmed`;
  });

  await scenario('TEST-06', 'Remote relay ON', async () => {
    const r = await api('/api/command', { command: 'RELAY_ON' });
    await waitFor('relay ON', (x) => x.relay === true && device.state.relayOn, 5000);
    return `HTTP ${r.status}, device relay ON, relay/state confirmed`;
  });

  await scenario('TEST-07', 'Manual override suspends auto shutdown', async (t0) => {
    await api('/api/command', { command: 'OVERRIDE_ON' });
    await waitFor('MANUAL_OVERRIDE', (x) => x.systemState === 'MANUAL_OVERRIDE');
    device.setStoreClosed(true);
    await sleep(14000);
    const s = await state();
    if (!device.state.relayOn || hasEventSince(s, 'AUTO_SHUTDOWN', t0)) throw new Error('automation ignored override');
    await api('/api/command', { command: 'OVERRIDE_OFF' });
    device.setStoreClosed(false);
    await waitFor('NORMAL', (x) => x.systemState === 'NORMAL');
    return 'relay stayed ON for 14s with store CLOSED under override';
  });

  await scenario('TEST-08', 'MQTT disconnect -> OFFLINE -> reconnect -> ONLINE', async (t0) => {
    device.dropConnection();
    await waitFor('DEVICE_OFFLINE', (x) => !x.online && hasEventSince(x, 'DEVICE_OFFLINE', t0), 30000);
    const offline = (await state()).events.find((e) => e.event_type === 'DEVICE_OFFLINE');
    const blocked = await api('/api/command', { command: 'RELAY_OFF' });
    const relayBefore = device.state.relayOn;
    device = Object.assign(new VirtualDevice({ url: BROKER }), { state: device.state });
    await device.connect();
    await waitFor('DEVICE_ONLINE', (x) => x.online && hasEventSince(x, 'DEVICE_ONLINE', t0));
    if (device.state.relayOn !== relayBefore) throw new Error('relay changed during outage');
    return `offline reason=${offline.reason}, command while offline -> HTTP ${blocked.status}, recovered online`;
  });

  await scenario('TEST-09', 'Invalid payloads are rejected', async (t0) => {
    device.client.publish('iot55/device01/telemetry', 'not-json');
    device.client.publish('iot55/device01/cmd/relay', '{"command":"MAYBE"}');
    const bad = await api('/api/command', { command: 'SET_THRESHOLD', value: 99999 });
    const s = await waitFor('INVALID_PAYLOAD from middleware and device', (x) =>
      x.events.some((e) => e.event_type === 'INVALID_PAYLOAD' && e.origin === 'middleware' && e.timestamp_ms >= t0) &&
      x.events.some((e) => e.event_type === 'INVALID_PAYLOAD' && e.origin === 'device' && e.timestamp_ms >= t0));
    if (bad.status !== 400) throw new Error('bad threshold accepted');
    if (!s.relay) throw new Error('relay changed');
    return 'malformed telemetry, bad relay command and bad threshold rejected; relay unchanged';
  });

  await scenario('TEST-10', 'End-to-end threshold round trip (API -> MQTT -> device -> telemetry -> API)', async () => {
    await api('/api/command', { command: 'SET_THRESHOLD', value: 900 });
    const s = await waitFor('threshold 900 reported by device', (x) => x.threshold === 900 && device.state.threshold === 900, 5000);
    await api('/api/command', { command: 'SET_THRESHOLD', value: 700 });
    return `device threshold=${device.state.threshold}, API threshold=${s.threshold}`;
  });

  await device.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} scenarios passed`);

  const lines = [
    '# E2E test evidence', '',
    `Run: ${new Date().toISOString()} | broker ${BROKER} | API ${API}`,
    'Stack: Mosquitto + Node-RED + nginx (docker compose) with scripts/lib/virtual-device.js as the device.', '',
    '| ID | Scenario | Result | Time | Evidence |', '|---|---|---|---|---|',
    ...results.map((r) => `| ${r.id} | ${r.title} | ${r.ok ? 'PASS' : 'FAIL'} | ${(r.ms / 1000).toFixed(1)}s | ${r.evidence} |`),
    '', `**${passed}/${results.length} passed**`, ''
  ];
  const out = path.join(__dirname, '..', 'tests', 'evidence', 'e2e-latest.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, lines.join('\n'));
  console.log('Evidence written to tests/evidence/e2e-latest.md');
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((error) => { console.error(error.message); process.exit(1); });
