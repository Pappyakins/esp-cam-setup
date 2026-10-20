# JakinsCraft ESP Cam Setup

Android app that provisions the WhatsApp doorbell cam (and other JakinsCraft
ESP32 devices) over Bluetooth LE: Wi-Fi SSID/password, camera name, receiver
WhatsApp number, server URL and device token are written to the device's NVS
storage, overriding its config.h defaults. Protocol: PROVISIONING.md in the
Pappyakins/whatsapp-doorbell-cam repo (firmware/PROVISIONING.md).

## Build

```sh
npm ci
npm run build          # esbuild: src/main.js -> www/app.js
npx cap sync android
cd android && ./gradlew assembleRelease
```

Release signing uses the shared JakinsCraft keystore (see the apk-builds
notes). Android only for now; BLE permissions are requested at runtime.
