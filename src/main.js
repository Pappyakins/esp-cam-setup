import { BleClient } from '@capacitor-community/bluetooth-le';

// JakinsCraft ESP Setup — provisions doorbell cams over BLE.
// Protocol: see PROVISIONING.md in Pappyakins/whatsapp-doorbell-cam.
const SVC     = '8d4f0001-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_SSID  = '8d4f0002-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_PASS  = '8d4f0003-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_NAME  = '8d4f0004-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_TO    = '8d4f0005-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_SERVER= '8d4f0006-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_TOKEN = '8d4f0007-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_CTRL  = '8d4f0008-3c2a-4b5e-9f1a-2b3c4d5e6f70';

const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
const dec = new TextDecoder();
let deviceId = null;
let scanning = false;

function status(msg) { $('status').textContent = msg; }
function log(msg) {
  const el = $('log');
  el.textContent = (msg + '\n' + el.textContent).split('\n').slice(0, 8).join('\n');
}
function strToView(s) { return new DataView(enc.encode(s).buffer); }
function viewToStr(v) { return dec.decode(v).trim(); }

function setFormEnabled(on) {
  document.querySelectorAll('#form input').forEach((i) => (i.disabled = !on));
  $('btn-save').disabled = !on;
  $('btn-erase').disabled = !on;
}

async function readChar(charUuid) {
  return viewToStr(await BleClient.read(deviceId, SVC, charUuid));
}
async function writeChar(charUuid, value) {
  await BleClient.write(deviceId, SVC, charUuid, strToView(value));
}

async function toggleScan() {
  if (scanning) {
    await BleClient.stopLEScan();
    scanning = false;
    $('btn-scan').textContent = 'Find camera';
    status('Scan stopped.');
    return;
  }
  try {
    await BleClient.initialize({ androidNeverForLocation: true });
    $('devices').innerHTML = '';
    status('Scanning… power the camera on where its Wi-Fi cannot connect, and watch for its flash blinking once a second.');
    scanning = true;
    $('btn-scan').textContent = 'Stop scan';
    const seen = new Set();
    await BleClient.requestLEScan({ services: [SVC] }, (result) => {
      const d = result.device;
      if (!d || seen.has(d.deviceId)) return;
      seen.add(d.deviceId);
      const btn = document.createElement('button');
      btn.className = 'device';
      btn.textContent = (d.name || 'JakinsCam') + '  ·  tap to connect';
      btn.onclick = () => connect(d.deviceId, d.name);
      $('devices').appendChild(btn);
    });
  } catch (e) {
    scanning = false;
    $('btn-scan').textContent = 'Find camera';
    status('Bluetooth problem: ' + (e && e.message ? e.message : e));
  }
}

async function connect(id, name) {
  try {
    if (scanning) { await BleClient.stopLEScan(); scanning = false; $('btn-scan').textContent = 'Find camera'; }
    status('Connecting to ' + (name || id) + '…');
    await BleClient.connect(id, (disconnectedId) => {
      if (disconnectedId === deviceId) {
        deviceId = null;
        setFormEnabled(false);
        status('Camera disconnected.');
      }
    });
    deviceId = id;
    $('f-ssid').value = await readChar(C_SSID);
    $('f-name').value = await readChar(C_NAME);
    $('f-to').value = await readChar(C_TO);
    $('f-server').value = await readChar(C_SERVER);
    $('f-token').value = await readChar(C_TOKEN);
    $('f-pass').value = '';
    setFormEnabled(true);
    status('Connected to ' + (name || 'camera') + '. Edit the values, then tap Save to camera.');
    log('Connected: ' + (name || id));
  } catch (e) {
    status('Connect failed: ' + (e && e.message ? e.message : e));
  }
}

async function save() {
  if (!deviceId) return;
  const ssid = $('f-ssid').value.trim();
  if (!ssid) { status('Wi-Fi name (SSID) cannot be empty.'); return; }
  try {
    $('btn-save').disabled = true;
    status('Saving to camera…');
    await writeChar(C_SSID, ssid);
    await writeChar(C_PASS, $('f-pass').value);           // blank = keep stored password
    await writeChar(C_NAME, $('f-name').value.trim());
    await writeChar(C_TO, $('f-to').value.replace(/[^0-9]/g, ''));
    await writeChar(C_SERVER, $('f-server').value.trim());
    await writeChar(C_TOKEN, $('f-token').value.trim());
    await writeChar(C_CTRL, 'APPLY');
    let result = '';
    try { result = await readChar(C_CTRL); } catch (e) { /* camera may already be restarting */ }
    if (result === 'saved' || result === '') {
      status('Saved. The camera is restarting and will join the Wi-Fi, then send its online photo to WhatsApp.');
      log('Settings saved to camera.');
    } else {
      status('Camera replied: ' + result);
    }
    setFormEnabled(false);
    deviceId = null;
  } catch (e) {
    status('Save failed: ' + (e && e.message ? e.message : e));
    $('btn-save').disabled = false;
  }
}

async function erase() {
  if (!deviceId) return;
  if (!window.confirm('Erase the settings stored in this camera? It will fall back to its built-in defaults.')) return;
  try {
    status('Erasing…');
    await writeChar(C_CTRL, 'ERASE');
    let result = '';
    try { result = await readChar(C_CTRL); } catch (e) { /* restarting */ }
    status('Erased. The camera is restarting with its built-in defaults.');
    log('Camera settings erased: ' + result);
    setFormEnabled(false);
    deviceId = null;
  } catch (e) {
    status('Erase failed: ' + (e && e.message ? e.message : e));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('btn-scan').onclick = toggleScan;
  $('btn-save').onclick = save;
  $('btn-erase').onclick = erase;
  setFormEnabled(false);
});
