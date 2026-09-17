#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>
#include <stdlib.h>
#include <time.h>
#include <sys/time.h>

// ===== Hardware Pins =====
#define RELAY_PIN     4
#define MICRO_SWITCH  5
#define LED_PIN       2

// ===== Relay / Solenoid =====
// Set to 1 for a low-level-trigger relay module (IN pulled to GND energizes the
// coil). Single-channel SRD-05VDC-SL-C modules ship in both polarities, so
// confirm yours on the bench before connecting the solenoid -- the wrong
// setting holds the lock energized permanently and overheats the coil.
#define RELAY_ACTIVE_LOW  0

// How long the solenoid stays energized per unlock. Cabinet solenoids are
// intermittent-duty actuators, so keep this pulse short.
#define UNLOCK_HOLD_MS    1500

inline void relayEnergize() {
#if RELAY_ACTIVE_LOW
  digitalWrite(RELAY_PIN, LOW);
#else
  digitalWrite(RELAY_PIN, HIGH);
#endif
}

inline void relayRelease() {
#if RELAY_ACTIVE_LOW
  digitalWrite(RELAY_PIN, HIGH);
#else
  digitalWrite(RELAY_PIN, LOW);
#endif
}

// Defined in Cabinet_Manager.h. Declared here because BLE_Callbacks.h, which
// calls it from the write callback, is included before Cabinet_Manager.h.
void requestUnlock();

// ===== BLE UUIDs =====
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define WRITE_CHAR_UUID     "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define STATUS_CHAR_UUID    "d3e5c4d6-8a9b-4e2c-9f1d-6a7b8c9d0e1f"

// ===== Global State =====
extern BLEServer*        pServer;
extern BLECharacteristic* pStatusCharacteristic;
extern bool              deviceConnected;
extern bool              keyPresent;

// ===== Clock =====
// This board has no RTC and no backup battery, so the phone is the time
// source: the app writes "TIME:<epochMs>" on every BLE connect.
extern bool    timeSynced;
extern int64_t lastSyncMs;

/**
 * Apply a phone-provided epoch (milliseconds). Values that cannot be real
 * clocks are rejected so a stale or spoofed write cannot poison the log.
 * Returns true when the clock was set.
 */
inline bool applyPhoneTime(int64_t epochMs) {
  if (epochMs < 1600000000000LL) return false;                 // earlier than 2020
  if (lastSyncMs > 0 && llabs(epochMs - lastSyncMs) > 31536000000LL) return false; // > 1 year jump

  struct timeval tv;
  tv.tv_sec  = (time_t)(epochMs / 1000);
  tv.tv_usec = (suseconds_t)((epochMs % 1000) * 1000);
  settimeofday(&tv, nullptr);

  timeSynced = true;
  lastSyncMs = epochMs;
  return true;
}

/** Wall-clock epoch in ms, or 0 when the clock has never been synced. */
inline int64_t currentEpochMs() {
  if (!timeSynced) return 0;

  struct timeval tv;
  gettimeofday(&tv, nullptr);
  return (int64_t)tv.tv_sec * 1000 + tv.tv_usec / 1000;
}

#endif
