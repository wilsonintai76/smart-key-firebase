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
