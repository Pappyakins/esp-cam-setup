# JakinsCraft ESP Cam Setup

PWA that provisions the WhatsApp doorbell cam (and other JakinsCraft ESP32
devices) over Bluetooth LE, using Web Bluetooth in Chrome on Android:
Wi-Fi SSID/password, camera name, receiver WhatsApp number, server URL and
device token are written to the device's NVS storage, overriding its
config.h defaults. Protocol: firmware/PROVISIONING.md in the
Pappyakins/whatsapp-doorbell-cam repo.

Live: https://pappyakins.github.io/esp-cam-setup/

Notes:
- Requires Chrome on Android (Web Bluetooth). Safari/iOS cannot do this.
- No secrets live in this repo: the app reads the server URL and token back
  from the camera itself, and only remembers them in the phone's own
  localStorage after a save.
