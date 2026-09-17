
# SmartKey v3 — Key Management System

## System Overview
The **SmartKey** is a PWA-controlled IoT key management system. An ESP32 Dev Board with a relay (solenoid lock) and microswitch detects key presence. The React PWA connects directly via Web Bluetooth (BLE), authenticates users with Google Sign-In (Firebase Auth), and logs all key events to Firebase Realtime Database.

---

## Quick Start
1.  **Flash the ESP32** — Open `firmware/KeyCabinet/KeyCabinet.ino` in Arduino IDE and upload to your ESP32 Dev Board.
2.  **Start the PWA** — `npm install && npm run dev`
3.  **Connect** — Open the PWA on Chrome/Edge (Android or desktop), tap "Connect to Cabinet", pair with the "KeyCabinet" BLE device.
4.  **Login** — Sign in with Google. The first account to sign in becomes the admin; everyone else joins as `staff` and an admin can promote them from the admin hub.

> **Hardware pins:** Relay → GPIO4, Microswitch → GPIO5, LED → GPIO2

---

## Hardware Wiring Schematic

```
        ESP32 Dev Board                    Relay module              12 V circuit
   ┌──────────────────────┐          ┌──────────────────────┐
   │  GPIO4 ──────────────┼──────────┤ IN                   │
   │  5V ─────────────────┼──────────┤ VCC     COM ─────────┼──── 12 V (HDR-60-12)
   │  GND ────────────────┼────┬─────┤ GND      NO ─────────┼──── solenoid (+)
   │  GPIO5 ──────────────┼─┐  │     └──────────────────────┘          │
   │  GPIO2 ─[220Ω]─▶|────┼─┼──┘                            solenoid (−) ── GND
   └──────────────────────┘ │
                            └── NO ──┐ lever microswitch (SPDT)
       GND ──────────────────── COM ──┘
```

### ① Relay Module → Solenoid Lock (GPIO4)

The solenoid is switched by the 1-channel relay module, so there is no discrete
transistor stage — the module already contains the driver and its own coil
suppression.

       ESP32 5V  ───────────── VCC ┐
       ESP32 GND ───────────── GND ├─ 1-channel relay module
       ESP32 GPIO4 ───────────── IN ┘

       12 V (PSU) ──────────── COM ┐
                                   ├─ relay contacts
       Solenoid +  ─────────────  NO ┘
       Solenoid −  ───────────── GND (PSU)

  ⚠️ Feed VCC from 5 V, not 3.3 V: an SRD-05VDC-SL-C coil needs ≈3.75 V to
     pull in, so on 3.3 V it chatters or never switches.
  ⚠️ The firmware drives IN active-HIGH. If the module clicks on the wrong
     edge, set `RELAY_ACTIVE_LOW` to 1 in `firmware/KeyCabinet/Config.h`.
  ⚠️ Flyback Diode: 1N4007 across the solenoid terminals
     (Cathode/band → +12V, Anode → GND)
     The solenoid coil is inductive; without the diode its collapsing field
     arcs the relay contacts every time the load switches off.
  ⚠️ Never power the solenoid from the ESP32's 5 V or 3.3 V pin — use the 12 V
     supply and switch it through the relay contacts.
```

### ② Microswitch — Key Detection (GPIO5)

```
       GPIO5 ────────── NO  ┐
                            ├── lever microswitch (SPDT, 5 A)
       GND   ────────── COM ┘

  Use NO (Normally Open), wired to GND — no external pull-up resistor needed:
  the ESP32's internal pull-up is enabled in firmware (`INPUT_PULLUP`).

  Key IN  (lever pressed) → contact closed to GND → GPIO5 = LOW
  Key OUT (lever released) → contact open          → GPIO5 = HIGH

  ⚠️ Do NOT use the NC contact: pressing the lever *opens* NC, which inverts
     the reading and reports the key as taken while it is seated.
  ⚠️ Do not add a 10 kΩ resistor to 3.3 V here — it fights the internal
     pull-up. If the cable run is long, add 10 kΩ in series at GPIO5 plus
     100 nF to GND instead, for noise filtering.
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
| 1 | ESP32 Dev Board | WROOM-32 | On a 38-pin expansion board |
| 1 | Relay Module | 1 channel, 5 V coil | SRD-05VDC-SL-C. High- or low-level trigger — set `RELAY_ACTIVE_LOW` to match |
| 1 | Solenoid Lock | 12 V DC, ~0.5–1 A | Intermittent duty; pulsed for 1.5 s per unlock |
| 1 | Microswitch | Lever, SPDT | Wire the **NO** contact — see ② |
| 1 | Flyback Diode | **1N4007** | Across the solenoid terminals |
| 1 | LED | 5mm | Status indicator |
| 1 | Resistor | 220Ω | LED current limit |
| 1 | DIN Power Supply | Mean Well HDR-60-12 | 12 V / 4.5 A for the solenoid; the ESP32 stays on USB 5 V |
| — | Hookup wire + ferrules | 0.5–1mm² | Signal runs and the 12 V load circuit |
| — | Fuse (optional) | 2A slow-blow | In-line on the 12 V solenoid feed |

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
The ESP32 dev board has **no RTC and no backup battery** — it is powered from the 12 V DIN-rail supply (Mean Well HDR-60-12) and cannot keep wall-clock time on its own. The phone is the time source:

1.  On every BLE connect (and reconnect) the PWA writes `TIME:<epochMs>` to the write characteristic — see `BluetoothService.syncDeviceTime()` in `services/bluetoothService.ts`.
2.  The firmware applies it with `settimeofday()`, so `time()` / `currentEpochMs()` are wall-clock from then on.
3.  Implausible values (before 2020, or a jump of more than a year) are rejected, and the clock starts as *unsynced* after every reboot — offline logs then say `clock not synced` instead of reporting a wrong time.

> The payload is 19 bytes, inside the default 20-byte BLE ATT MTU, so no MTU negotiation is needed. Accuracy is the board's crystal (±1–3 s/day) — re-sync happens on every connect.

### BLE Command Protocol

The write characteristic takes short, newline-terminated ASCII lines. The
firmware matches the verb before the first `:` (case-insensitive) and logs
anything it does not recognise to Serial.

| Command | Sent by | Firmware action |
|---|---|---|
| `TIME:<epochMs>` | `syncDeviceTime()` on every connect | sets the wall clock |
| `UNLOCK` | `unlock()` — slot unlock / take key | pulses the relay for `UNLOCK_HOLD_MS` |
| `DOOR` | `unlockDoor()` — main cabinet door | pulses the relay |
| `CYCLE:<slot>` | `runMaintenance()` | pulses the relay |
| `FORCE_RETURN:<slot>` | `forceReturn()` | acknowledged only; the audit entry is written to Realtime Database |

> Keep every line within **19 bytes**. The characteristic is write-only, so the
> default 23-byte ATT MTU is never negotiated and longer writes fail outright.
> That is also why global policy lives only in Realtime Database and is never
> pushed to the board — the ESP32 has no policy engine to receive it.

### Adding More End Switches

One switch per free GPIO is possible; the in-app **System Manual → Pin Map &
Wiring Guide** lists the safe pins and how many are left. Two of the limits are
in firmware rather than hardware:

* `checkKeyStatus()` reads a single pin into one `keyPresent` flag, and the
  notify characteristic carries **1 byte** — so up to 8 switches can be reported
  as a bitmask with no protocol change.
* Beyond 8, the notification needs a multi-byte payload, and each switch needs
  its own `KeySlot` row to be audited per key.

---

## Tech Stack
*   **Edge Hardware:** ESP32 Dev Board (WROOM-32) with BLE + relay + microswitch.
*   **Firmware:** Arduino (ESP32 BLE Arduino library) — see `firmware/KeyCabinet/`.
*   **Hosting:** Firebase Hosting (`firebase deploy --only hosting,database`).
*   **Auth:** Google Sign-In via Firebase Authentication (no PIN or WebAuthn credentials).
*   **Frontend:** React 18, TypeScript, Tailwind CSS, Vite PWA.
*   **Database:** Firebase Realtime Database (`database.rules.json` holds the security rules).
*   **Offline Queue:** `localStorage` (lightweight, no dependencies).
*   **Architecture:** Static PWA (Firebase Hosting) + BLE to the ESP32; the browser talks to Realtime Database directly through the Firebase SDK — there is no server-side runtime.

---

## Firebase Setup
1.  Create a Firebase project and enable **Google** under Authentication → Sign-in method.
2.  Create the Realtime Database instance (default, `us-central1`).
3.  Copy the web app config into `.env`:

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
| `/users/{uid}` | Profile: name, email, avatar, role, contact, status, createdAt, lastLogin |
| `/audit/{pushId}` | Append-only audit trail with actor identity and timestamp |
| `/meta/hasAdmin` | Bootstrap flag — the first account to sign in becomes admin |

### Roles
*   **First sign-in ever** → becomes `admin` and claims `/meta/hasAdmin`.
*   **Everyone else** → `staff`. Role changes are admin-only and enforced in `database.rules.json`.
*   Role changes reach an already-signed-in session immediately (the profile is synced from the live `/users` subscription — no reload needed), and a demoted user is dropped back to the dashboard. Because the rules read `role` from the database, a promoted user's admin actions are authorized without a token refresh.

---

## CBM Mathematical Model
Mechanical health is calculated using linear degradation:

$$Health \% = 100 - \left( \frac{\text{UsageCount}}{\text{Threshold}} \times 100 \right)$$

*   **Cabinet Actuator Limit:** 50,000 cycles (Door Solenoid thermal fatigue).
*   **Key Sensor Switch Limit:** 100,000 cycles (Microswitch mechanical spring fatigue per slot).

---

## Mobile Usage (PWA only)

There is no native wrapper — the app is a single web bundle served from Firebase Hosting and is designed mobile-first (installed to the home screen, full-screen, works on phone-sized viewports).

### Install on a phone
1. Open `https://smart-key-firebase.web.app` in a supported browser.
2. Use the browser menu → **Add to Home Screen** / **Install app**.
3. Sign in with Google, then pair the cabinet over Bluetooth.

### Browser requirements

| Platform | Browser | Notes |
|---|---|---|
| Android | Chrome / Edge | Web Bluetooth + Google Sign-In both supported |
| Desktop | Chrome / Edge | Web Bluetooth + Google Sign-In both supported |
| iOS | Bluefy / WebBLE | Safari has no Web Bluetooth; sign-in works anywhere |

### Architecture
- **Web mode (PWA):** Web Bluetooth for the ESP32 + Google Sign-In (Firebase Auth) for identity + Firebase Realtime Database for shared state, with a `localStorage` offline queue that flushes on reconnect.
- No Capacitor/native bridge, no local SQLite: all persistence is RTDB plus the offline queue.

### Diagrams

| Diagram | File | Shows |
|---|---|---|
| Wiring schematic | [`flowchart LR.mmd`](./flowchart%20LR.mmd) | ESP32 pin map to relay, microswitch and status LED |
| System architecture | [`flowchart TB.mmd`](./flowchart%20TB.mmd) | High-level flow: hardware ↔ PWA ↔ Firebase |
| Key workflow | [`sequenceDiagram.mmd`](./sequenceDiagram.mmd) | Key take/return sequence across user, PWA and ESP32 |

Open any file in VS Code and press `Ctrl+Shift+V` (Mermaid preview) to render it.
