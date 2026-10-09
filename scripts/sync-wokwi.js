// Copies firmware/esp32/src/main.cpp to simulation/wokwi/sketch.ino so the
// wokwi.com web simulator runs exactly the same firmware as real hardware.
// Use --check to fail when the copies differ (used by tests).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'firmware/esp32/src/main.cpp');
const target = path.join(root, 'simulation/wokwi/sketch.ino');
const header = '// GENERATED from firmware/esp32/src/main.cpp by scripts/sync-wokwi.js - do not edit.\n';
const expected = header + fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n');

if (process.argv.includes('--check')) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current !== expected) {
    console.error('sketch.ino differs from firmware: run node scripts/sync-wokwi.js');
    process.exit(1);
  }
  console.log('sketch.ino matches firmware');
} else {
  fs.writeFileSync(target, expected);
  console.log('Synced simulation/wokwi/sketch.ino');
}
