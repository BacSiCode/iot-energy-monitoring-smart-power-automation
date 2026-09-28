const fs = require('fs');

const flow = JSON.parse(fs.readFileSync('middleware/node-red/flows.json', 'utf8'));
const diagram = JSON.parse(fs.readFileSync('simulation/wokwi/diagram.json', 'utf8'));
const requiredNodes = ['mqtt in', 'function', 'mqtt out', 'http in', 'http response', 'inject'];
const types = new Set(flow.map(node => node.type));
const requiredTopics = [
  'iot55/device01/telemetry',
  'iot55/device01/cmd/relay',
  'iot55/device01/event'
];

if (!requiredNodes.every(type => types.has(type))) throw new Error('Missing Node-RED node type');
if (!requiredTopics.every(topic => JSON.stringify(flow).includes(topic))) throw new Error('Missing MQTT topic');
const ids = new Set(diagram.parts.map(part => part.id));
for (const id of ['esp', 'pir', 'currentInput', 'storeState', 'relay', 'loadLed', 'buzzer']) {
  if (!ids.has(id)) throw new Error(`Missing Wokwi part: ${id}`);
}
console.log(`Validated ${flow.length} Node-RED nodes and ${diagram.parts.length} Wokwi parts`);