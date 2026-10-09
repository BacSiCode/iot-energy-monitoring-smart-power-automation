// Static consistency checks across firmware, Wokwi diagram and Node-RED flow.
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const firmware = read('firmware/esp32/src/main.cpp');
const flows = JSON.parse(read('middleware/node-red/flows.json'));
const diagram = JSON.parse(read('simulation/wokwi/diagram.json'));

test('flows.json is generated from middleware/node-red/src', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/build-flows.js'), '--check']);
});

test('Wokwi sketch.ino is identical to the firmware', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/sync-wokwi.js'), '--check']);
});

test('Node-RED flow has uplink, downlink, scheduler, API and error handling', () => {
  const nodeTypes = new Set(flows.map((n) => n.type));
  for (const type of ['mqtt in', 'mqtt out', 'function', 'inject', 'http in', 'http response', 'catch']) {
    assert.ok(nodeTypes.has(type), `missing node type ${type}`);
  }
  const subscribed = flows.filter((n) => n.type === 'mqtt in').map((n) => n.topic).sort();
  assert.deepEqual(subscribed, ['telemetry', 'status', 'event', 'relay/state'].map((t) => 'iot55/device01/' + t).sort());
  const ids = new Set(flows.map((n) => n.id));
  for (const node of flows) {
    for (const outputs of node.wires || []) for (const target of outputs) assert.ok(ids.has(target), `${node.id} wired to missing ${target}`);
  }
  const broker = flows.find((n) => n.type === 'mqtt-broker');
  assert.equal(broker.broker, '${MQTT_HOST}', 'broker host comes from the environment');
});

test('every downlink topic produced by Node-RED is handled by the firmware', () => {
  const engine = read('middleware/node-red/src/state-engine.js');
  const produced = [...engine.matchAll(/sendCommand\('(cmd\/[a-z]+)'/g)].map((m) => m[1]);
  assert.ok(produced.length >= 5);
  for (const suffix of new Set(produced)) {
    assert.ok(firmware.includes(`TOPIC_BASE "${suffix}"`), `firmware does not handle ${suffix}`);
  }
});

test('Wokwi diagram contains every part and valid ESP32 pins', () => {
  const parts = new Set(diagram.parts.map((p) => p.id));
  for (const id of ['esp', 'pir', 'currentInput', 'storeState', 'overrideBtn', 'relay', 'loadLed', 'buzzer', 'statusLed', 'alarmLed']) {
    assert.ok(parts.has(id), `missing part ${id}`);
  }
  const validEspPins = new Set(['3V3', 'VIN', 'GND.1', 'GND.2', 'TX0', 'RX0', 'D2', 'D4', 'D5', 'D12', 'D13', 'D14', 'D15',
    'D18', 'D19', 'D21', 'D22', 'D23', 'D25', 'D26', 'D27', 'D32', 'D33', 'D34', 'D35', 'VP', 'VN', 'EN', 'TX2', 'RX2']);
  for (const [from, to] of diagram.connections) {
    for (const end of [from, to]) {
      const [part, pin] = end.split(':');
      if (part === 'esp') assert.ok(validEspPins.has(pin), `invalid ESP32 pin ${pin}`);
      else if (part !== '$serialMonitor') assert.ok(parts.has(part), `connection to unknown part ${part}`);
    }
  }
  const relay = diagram.parts.find((p) => p.id === 'relay');
  assert.notEqual(relay.attrs.transistor, 'pnp', 'firmware drives the relay active-HIGH');
});

test('GPIO numbers in the firmware match the Wokwi wiring', () => {
  const pinOf = (name) => Number(firmware.match(new RegExp(`${name} = (\\d+);`))[1]);
  const wiredTo = (part, pin) => diagram.connections.find(([a, b]) => b === `${part}:${pin}` && a.startsWith('esp:D'))[0].replace('esp:D', '');
  assert.equal(pinOf('PIR_PIN'), Number(wiredTo('pir', 'OUT')));
  assert.equal(pinOf('CURRENT_PIN'), Number(wiredTo('currentInput', 'SIG')));
  assert.equal(pinOf('STORE_STATE_PIN'), Number(wiredTo('storeState', '2')));
  assert.equal(pinOf('OVERRIDE_BTN_PIN'), Number(wiredTo('overrideBtn', '1.l')));
  assert.equal(pinOf('RELAY_PIN'), Number(wiredTo('relay', 'IN')));
  assert.equal(pinOf('BUZZER_PIN'), Number(wiredTo('buzzer', '2')));
  assert.equal(pinOf('STATUS_LED_PIN'), Number(wiredTo('statusResistor', '1')));
  assert.equal(pinOf('ALARM_LED_PIN'), Number(wiredTo('alarmResistor', '1')));
});

test('no secrets or runtime state are tracked by git', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
  const forbidden = [/^\.env$/, /config\.h$/, /\.config\.runtime\.json/, /flows_cred\.json$/, /node-red\/context\//, /\.backup$/];
  for (const file of tracked) {
    for (const pattern of forbidden) assert.ok(!pattern.test(file), `must not be committed: ${file}`);
  }
});
