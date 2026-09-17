
# SecureKey v3 — Key Management System

## System Overview
The **SecureKey** is a PWA-controlled IoT key management system. An ESP32 Dev Board with a relay (solenoid lock) and microswitch detects key presence. The React PWA connects directly via Web Bluetooth (BLE), authenticates users with Google Sign-In (Firebase Auth), and logs all key events to Firebase Realtime Database.

---

## Quick Start
1.  **Flash the ESP32** — Open `firmware/KeyCabinet/KeyCabinet.ino` in Arduino IDE and upload to your ESP32 Dev Board.
2.  **Start the PWA** — `npm install && npm run dev`
3.  **Connect** — Open the PWA on Chrome/Edge (Android or desktop), tap "Connect to Cabinet", pair with the "KeyCabinet" BLE device.
4.  **Login** — Sign in with Google. The first account to sign in becomes the admin; everyone else needs an invite created by an admin.

> **Hardware pins:** Relay → GPIO4, Microswitch → GPIO5, LED → GPIO2

---

## Hardware Wiring Schematic

```
                    ESP32 Dev Board
                   ┌──────────────┐
                   │              │
                   │    GPIO4 ────┼─────[1kΩ]────┐
                   │              │              │
                   │    GPIO5 ────┼──┬──[10kΩ]───3.3V
                   │              │  │           │
                   │     3.3V ────┼──┤           │
                   │              │  │           │
                   │     GND  ────┼──┴───────────GND
                   │              │
                   │    GPIO2 ────┼─────[220Ω]───▶├──GND
                   └──────────────┘               LED
```

### ① Relay / Solenoid Lock (GPIO4)

```
       GPIO4 ───[1kΩ]───┬───────┬─── 12V
                        │       │
                        │     ┌─┴─┐
                   NPN  │     │   │ Solenoid
                  2N2222│     │   │ Lock
                        │     └─┬─┘
                        │       │
                       GND    ──┴── GND

  ⚠️ Flyback Diode: 1N4007 across solenoid coil
     (Cathode → 12V, Anode → Collector)
     Protects transistor from voltage spike when relay turns OFF.
```

### ② Microswitch — Key Detection (GPIO5)

```
       GPIO5 ───┬─────────── SW ──── GND
                │
              [10kΩ]
                │
               3.3V

  NC (Normally Closed): key IN → GPIO5 = LOW
  NO (Normally Open):  key OUT → GPIO5 = HIGH (pull-up)
  Config: INPUT_PULLUP — internal pull-up active
```

### ③ Status LED (GPIO2)

```
       GPIO2 ───[220Ω]───▶├─── GND
                          LED
  ON  = Phone connected via BLE
  OFF = Disconnected / advertising
```

### 🛒 Bill of Materials

| Qty | Component | Value | Notes |
|---|---|---|---|
| 1 | ESP32 Dev Board | WROOM-32 | Any variant |
| 1 | NPN Transistor | 2N2222 | Switch relay from 3.3V GPIO |
| 1 | Flyback Diode | **1N4007** | Across solenoid coil |
| 1 | Solenoid Lock | 12V DC | Door actuator |
| 1 | Microswitch | NC type | Key presence sensor |
| 1 | LED | 5mm | Status indicator |
| 1 | Resistor | 1kΩ | Base current limit |
| 1 | Resistor | 10kΩ | Pull-up for microswitch |
| 1 | Resistor | 220Ω | LED current limit |
| 1 | 12V Power Supply | 2A | External power for solenoid |

---

## BLE-First Architecture
The system communicates directly with the ESP32 Dev Board via Bluetooth Low Energy (Web Bluetooth API). No WiFi, no MQTT, no external storage required.

### Why BLE?
For a workshop environment, Bluetooth Low Energy provides:
*   **Direct peer-to-peer** — No router, no internet, no cloud dependency for core operations.
*   **Low latency** — Unlock commands arrive in milliseconds.
*   **Cloud-backed** — All logs are mirrored to Firebase Realtime Database.

### Audit Logging
1.  **Key events** (TAKEN/RETURNED) are detected by the ESP32 microswitch and pushed via BLE notification.
2.  **Cloud audit** — The PWA writes the event to `/audit` in Realtime Database as the signed-in Google user.
3.  **Offline resilience** — If the device is offline, events are queued in `localStorage` and automatically flushed when connectivity returns.
4.  The database rules keep every audit entry append-only (`actorUid` must match the writer).

### Cabinet Clock (no RTC on the board)
The ESP32 dev board has **no RTC and no backup battery** — it is powered straight from the 12–60 V HDR supply and cannot keep wall-clock time on its own. The phone is the time source:

1.  On every BLE connect (and reconnect) the PWA writes `TIME:<epochMs>` to the write characteristic — see `BluetoothService.syncDeviceTime()` in `services/bluetoothService.ts`.
2.  The firmware applies it with `settimeofday()`, so `time()` / `currentEpochMs()` are wall-clock from then on.
3.  Implausible values (before 2020, or a jump of more than a year) are rejected, and the clock starts as *unsynced* after every reboot — offline logs then say `clock not synced` instead of reporting a wrong time.

> The payload is 19 bytes, inside the default 20-byte BLE ATT MTU, so no MTU negotiation is needed. Accuracy is the board's crystal (±1–3 s/day) — re-sync happens on every connect.

---

## Tech Stack
*   **Edge Hardware:** ESP32 Dev Board (WROOM-32) with BLE + relay + microswitch.
*   **Firmware:** Arduino (ESP32 BLE Arduino library) — see `firmware/KeyCabinet/`.
*   **Hosting:** Firebase Hosting (`firebase deploy --only hosting,database`).
*   **Auth:** Google Sign-In via Firebase Authentication (no PIN or WebAuthn credentials).
*   **Frontend:** React 18, TypeScript, Tailwind CSS, Vite PWA.
*   **Database:** Firebase Realtime Database (`database.rules.json` holds the security rules).
*   **Offline Queue:** `localStorage` (lightweight, no dependencies).
*   **Architecture:** Cloud-native with BLE + Firebase SDK.

---

## Firebase Setup
1.  Create a Firebase project and enable **Google** under Authentication → Sign-in method.
2.  Create the Realtime Database instance (default, `us-central1`).
3.  Copy the web app config into `.env` / `.env.production`:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://<project>-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=<project>
VITE_FIREBASE_STORAGE_BUCKET=<project>.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

4.  Deploy hosting + rules:

```bash
npm run deploy          # bump version, build, deploy hosting + database
npm run deploy:hosting  # build + deploy hosting only
```

### Realtime Database schema
| Path | Purpose |
|---|---|
| `/users/{uid}` | Profile: name, email, avatar, role, staffId, contact, status, createdAt, lastLogin |
| `/invites/{email}` | Admin pre-registration (dots escaped as commas); claimed on the invitee's first sign-in |
| `/audit/{pushId}` | Append-only audit trail with actor identity and timestamp |
| `/meta/hasAdmin` | Bootstrap flag — the first account to sign in becomes admin |

### Roles
*   **First sign-in ever** → becomes `admin` and claims `/meta/hasAdmin`.
*   **Invited email** → receives the role stored in `/invites/{email}`.
*   **Everyone else** → `staff`. Role changes are admin-only and enforced in `database.rules.json`.
*   An **Emergency Code** can still be set per device in Account Settings; it is stored locally only and used by the deep-offline unlock banner.

---

## CBM Mathematical Model
Mechanical health is calculated using linear degradation:

$$Health \% = 100 - \left( \frac{\text{UsageCount}}{\text{Threshold}} \times 100 \right)$$

*   **Cabinet Actuator Limit:** 50,000 cycles (Door Solenoid thermal fatigue).
*   **Key Sensor Switch Limit:** 100,000 cycles (Microswitch mechanical spring fatigue per slot).

---

## Mobile App (Capacitor)

The PWA can be wrapped as a native Android/iOS app using **Capacitor**.

### Prerequisites
- **Android:** Android Studio + SDK 34+
- **iOS:** Xcode 16+ (macOS only)

### Build & Run

```bash
# Build web app + sync to native projects
npm run build:mobile

# Open in native IDE
npm run open:android   # Android Studio
npm run open:ios       # Xcode
```

### Native plugins
| Feature | Android | iOS | Plugin |
|---|---|---|---|
| BLE | ✅ | ✅ | `@capacitor-community/bluetooth-le` |
| Biometrics | ✅ Fingerprint | ✅ Face ID | `@capgo/capacitor-native-biometric` |
| Local DB | ✅ SQLite | ✅ SQLite | `@capacitor-community/sqlite` |

### Architecture
- **Web mode (PWA):** Uses Web Bluetooth + Google Sign-In (Firebase) + localStorage/offline queue
- **Native mode:** Uses Capacitor BLE + native biometrics + on-device SQLite
- Auto-detected at runtime via `Capacitor.isNativePlatform()`
