// JakinsCraft ESP Cam Setup — provisions doorbell cams over Web Bluetooth.
// Protocol: firmware/PROVISIONING.md in Pappyakins/whatsapp-doorbell-cam.
const SVC      = '8d4f0001-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_SSID   = '8d4f0002-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_PASS   = '8d4f0003-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_NAME   = '8d4f0004-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_TO     = '8d4f0005-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_SERVER = '8d4f0006-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_TOKEN  = '8d4f0007-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_CTRL   = '8d4f0008-3c2a-4b5e-9f1a-2b3c4d5e6f70';
const C_STATE  = '8d4f0009-3c2a-4b5e-9f1a-2b3c4d5e6f70';

const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
const dec = new TextDecoder();
let device = null;
let service = null;
let expectedDrop = false; // we told the cam to restart (APPLY / LOCK / ERASE)
let lockState = false; // slider state, read from the cam on connect
const chars = {};

function status(msg) { $('status').textContent = msg; }
function log(msg) {
  const el = $('log');
  el.textContent = (msg + '\n' + el.textContent).split('\n').slice(0, 8).join('\n');
}
function setFormEnabled(on) {
  document.querySelectorAll('#form input').forEach((i) => (i.disabled = !on));
  $('btn-save').disabled = !on;
  $('btn-erase').disabled = !on;
}
async function getChar(uuid) {
  if (!chars[uuid]) chars[uuid] = await service.getCharacteristic(uuid);
  return chars[uuid];
}
async function readStr(uuid) {
  const v = await (await getChar(uuid)).readValue();
  return dec.decode(v).trim();
}
async function writeStr(uuid, s) {
  await (await getChar(uuid)).writeValue(enc.encode(s));
}

function onDisconnected() {
  service = null;
  Object.keys(chars).forEach((k) => delete chars[k]);
  if (expectedDrop) { expectedDrop = false; setFormEnabled(false); return; } // lock restart: keep slider at locked
  lockState = false;
  $('lock-slider').value = 0;
  setFormEnabled(false);
  status('Camera disconnected. Power it on in setup mode and tap Find camera to reconnect.');
}

async function find() {
  if (!navigator.bluetooth) {
    status('This browser cannot do Bluetooth setup. Open this page in Chrome on Android.');
    return;
  }
  try {
    status('Pick your camera in the Bluetooth list…');
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SVC] }, { namePrefix: 'JakinsCam' }],
      optionalServices: [SVC],
    });
    device.addEventListener('gattserverdisconnected', onDisconnected);
    status('Connecting to ' + (device.name || 'camera') + '…');
    const server = await device.gatt.connect();
    service = await server.getPrimaryService(SVC);
    $('f-ssid').value = await readStr(C_SSID);
    $('f-name').value = await readStr(C_NAME);
    $('f-to').value = await readStr(C_TO);
    $('f-server').value = await readStr(C_SERVER);
    $('f-token').value = await readStr(C_TOKEN);
    $('f-pass').value = '';
    // Fall back to this phone's remembered defaults only if the cam has none.
    try {
      const d = JSON.parse(localStorage.getItem('espSetupDefaults') || '{}');
      if (!$('f-server').value && d.server) $('f-server').value = d.server;
      if (!$('f-token').value && d.token) $('f-token').value = d.token;
    } catch (e) { /* ignore */ }
    // Position the lock slider from the cam's own locked flag.
    try { lockState = (await readStr(C_STATE)) === 'locked'; }
    catch (e) { lockState = false; } // older firmware has no state characteristic
    $('lock-slider').value = lockState ? 100 : 0;
    setFormEnabled(true);
    status('Connected to ' + (device.name || 'camera') + '. Edit the values, then tap Save to camera.');
    log('Connected: ' + (device.name || device.id));
  } catch (e) {
    if (e && e.name === 'NotFoundError') { status('No camera picked. Tap Find camera to try again.'); return; }
    status('Connect failed: ' + (e && e.message ? e.message : e));
  }
}

async function save() {
  if (!service) return;
  const ssid = $('f-ssid').value.trim();
  if (!ssid) { status('Wi-Fi name (SSID) cannot be empty.'); return; }
  try {
    $('btn-save').disabled = true;
    status('Saving to camera…');
    await writeStr(C_SSID, ssid);
    await writeStr(C_PASS, $('f-pass').value);            // blank = keep stored password
    await writeStr(C_NAME, $('f-name').value.trim());
    await writeStr(C_TO, $('f-to').value.replace(/[^0-9]/g, ''));
    await writeStr(C_SERVER, $('f-server').value.trim());
    await writeStr(C_TOKEN, $('f-token').value.trim());
    await writeStr(C_CTRL, 'APPLY');
    let result = '';
    try { result = await readStr(C_CTRL); } catch (e) { /* camera may already be restarting */ }
    try {
      localStorage.setItem('espSetupDefaults', JSON.stringify({
        server: $('f-server').value.trim(), token: $('f-token').value.trim(),
      }));
    } catch (e) { /* ignore */ }
    if (result === 'saved' || result === '') {
      status('Saved. The camera is restarting and will join the Wi-Fi, then send its online photo to WhatsApp.');
      log('Settings saved to camera.');
    } else {
      status('Camera replied: ' + result);
    }
    setFormEnabled(false);
  } catch (e) {
    status('Save failed: ' + (e && e.message ? e.message : e));
    $('btn-save').disabled = false;
  }
}

async function erase() {
  if (!service) return;
  if (!window.confirm('Erase the settings stored in this camera? It will fall back to its built-in defaults.')) return;
  try {
    status('Erasing…');
    await writeStr(C_CTRL, 'ERASE');
    status('Erased. The camera is restarting with its built-in defaults.');
    log('Camera settings erased.');
    setFormEnabled(false);
  } catch (e) {
    status('Erase failed: ' + (e && e.message ? e.message : e));
  }
}

// Lock slider: the slider SHOWS the cam's locked flag, it is not a
// one-way action. Slide right to save the form and LOCK, slide left to
// UNLOCK (clears the flag, no restart, the window keeps running).
// A timeout with no action leaves the flag exactly as it was.
async function lock() {
  if (!service) return;
  const ssid = $('f-ssid').value.trim();
  if (!ssid) { status('Wi-Fi name (SSID) cannot be empty.'); $('lock-slider').value = 0; return; }
  try {
    $('lock-slider').disabled = true;
    status('Locking these details in the camera…');
    await writeStr(C_SSID, ssid);
    await writeStr(C_PASS, $('f-pass').value);            // blank = keep stored password
    await writeStr(C_NAME, $('f-name').value.trim());
    await writeStr(C_TO, $('f-to').value.replace(/[^0-9]/g, ''));
    await writeStr(C_SERVER, $('f-server').value.trim());
    await writeStr(C_TOKEN, $('f-token').value.trim());
    expectedDrop = true; // LOCK makes the camera restart and drop the link
    await writeStr(C_CTRL, 'LOCK');
    let result = '';
    try { result = await readStr(C_CTRL); } catch (e) { /* camera may already be restarting */ }
    try {
      localStorage.setItem('espSetupDefaults', JSON.stringify({
        server: $('f-server').value.trim(), token: $('f-token').value.trim(),
      }));
    } catch (e) { /* ignore */ }
    if (result === 'locked' || result === '') {
      lockState = true;
      status('Locked. These details are saved in the camera, future boots will skip setup. Hold the setup button while powering on to reopen setup.');
      log('Settings locked in camera.');
    } else {
      status('Camera replied: ' + result);
    }
    setFormEnabled(false);
    $('lock-slider').value = 100;
  } catch (e) {
    expectedDrop = false;
    status('Lock failed: ' + (e && e.message ? e.message : e));
    $('lock-slider').disabled = false;
    $('lock-slider').value = 0; // was unlocked before
  }
}

async function unlock() {
  if (!service) return;
  try {
    $('lock-slider').disabled = true;
    status('Unlocking setup…');
    await writeStr(C_CTRL, 'UNLOCK');
    let result = '';
    try { result = await readStr(C_CTRL); } catch (e) { /* ignore */ }
    if (result === 'unlocked' || result === '') {
      lockState = false;
      status('Unlocked. Future boots will open setup again. The setup window is still running, you can edit and save, or leave it to time out.');
      log('Setup unlocked.');
    } else {
      status('Camera replied: ' + result);
    }
    $('lock-slider').value = 0;
    $('lock-slider').disabled = false;
  } catch (e) {
    status('Unlock failed: ' + (e && e.message ? e.message : e));
    $('lock-slider').disabled = false;
    $('lock-slider').value = 100; // was locked before
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('btn-scan').onclick = find;
  $('btn-save').onclick = save;
  $('btn-erase').onclick = erase;
  $('lock-slider').addEventListener('change', () => {
    const v = Number($('lock-slider').value);
    if (v >= 50 && !lockState) { lock(); }
    else if (v < 50 && lockState) { unlock(); }
    else { $('lock-slider').value = lockState ? 100 : 0; } // short slides snap back
  });
  setFormEnabled(false);
  if (!navigator.bluetooth) {
    status('Open this page in Chrome on Android, this browser has no web Bluetooth.');
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
