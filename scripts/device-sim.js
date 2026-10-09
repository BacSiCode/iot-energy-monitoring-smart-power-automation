// Interactive virtual device for demos/debugging without Wokwi or hardware.
// Usage: node scripts/device-sim.js [mqtt://localhost:1883]
// Keys: c = toggle store OPEN/CLOSED, p = toggle presence, + / - = current +-200,
//       h = abnormal current (1500), n = normal current (350), d = drop connection, q = quit
const readline = require('readline');
const { VirtualDevice } = require('./lib/virtual-device');

const url = process.argv[2] || 'mqtt://localhost:1883';
let device = new VirtualDevice({ url });

function show() {
  const s = device.state;
  console.log(`store=${s.storeClosed ? 'CLOSED' : 'OPEN'} presence=${s.presence ? 'YES' : 'NO'} current=${s.currentSignal} ` +
    `relay=${s.relayOn ? 'ON' : 'OFF'} mode=${s.automationEnabled ? 'AUTO' : 'MANUAL'} override=${s.overrideActive} ` +
    `alarm=${s.alarmActive ? (s.alarmAcknowledged ? 'ACK' : 'ACTIVE') : 'NO'}`);
}

async function start() {
  await device.connect();
  device.on('command', (cmd, doc) => { console.log(`[CMD] ${cmd} ${JSON.stringify(doc)}`); show(); });
  console.log(`Connected to ${url}. Keys: c p + - h n d q`);
  show();
}

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on('keypress', async (_, key) => {
  const s = device.state;
  const k = key && key.sequence;
  if (k === 'q' || (key && key.ctrl && key.name === 'c')) { await device.close(); process.exit(0); }
  if (k === 'c') device.setStoreClosed(!s.storeClosed);
  if (k === 'p') device.setPresence(!s.presence);
  if (k === '+') device.setCurrent(Math.min(4095, s.currentSignal + 200));
  if (k === '-') device.setCurrent(Math.max(0, s.currentSignal - 200));
  if (k === 'h') device.setCurrent(1500);
  if (k === 'n') device.setCurrent(350);
  if (k === 'd') {
    device.dropConnection();
    console.log('Connection dropped; reconnecting in 25 s');
    setTimeout(async () => { const state = device.state; device = new VirtualDevice({ url }); device.state = state; await start(); }, 25000);
    return;
  }
  show();
});

start().catch((e) => { console.error(e.message); process.exit(1); });
