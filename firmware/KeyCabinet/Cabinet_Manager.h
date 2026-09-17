#ifndef CABINET_MANAGER_H
#define CABINET_MANAGER_H

#include "Config.h"

// Non-zero while the solenoid is energized: the millis() deadline at which the
// relay must be released. The pulse is timed from loop() instead of inside the
// BLE write callback, because blocking that callback for the full duration
// starves the BLE stack and can drop the link.
static uint32_t relayReleaseAt = 0;

void requestUnlock() {
  relayEnergize();
  relayReleaseAt = millis() + UNLOCK_HOLD_MS;
  Serial.printf(">>> UNLOCK: solenoid energized for %d ms\n", UNLOCK_HOLD_MS);
}

void serviceRelay() {
  if (relayReleaseAt == 0) return;
  if ((int32_t)(millis() - relayReleaseAt) < 0) return;  // rollover-safe
  relayRelease();
  relayReleaseAt = 0;
  Serial.println(">>> Lock closed.");
}

// ===== Peg Switches (per-slot sensing) =====
#if PEG_SWITCH_COUNT > 0
static uint8_t pegRaw[PEG_SWITCH_COUNT];      // last sampled level
static uint8_t pegStable[PEG_SWITCH_COUNT];   // debounced level, 1 = seated
static uint8_t pegSamples[PEG_SWITCH_COUNT];  // consecutive matching samples

static inline bool pegSeated(uint8_t i) {
  return digitalRead(PEG_PINS[i]) == LOW;
}

static uint16_t readPegMask() {
  uint16_t mask = 0;
  for (uint8_t i = 0; i < PEG_SWITCH_COUNT; i++) {
    if (pegStable[i]) mask |= (uint16_t)1 << i;
  }
  return mask;
}

static void initPegSwitches() {
  for (uint8_t i = 0; i < PEG_SWITCH_COUNT; i++) {
    uint8_t pin = PEG_PINS[i];
    if (pin == RELAY_PIN || pin == LED_PIN || pin == 1 || pin == 3 ||
        (pin >= 6 && pin <= 12)) {
      Serial.printf("!! PEG_PINS[%u]=GPIO%u is a reserved pin -- fix Config.h\n", i, pin);
    }
    // GPIO 34-39 are input-only and have no pull-up; a peg there needs an
    // external 10k to 3V3.
    pinMode(pin, pin >= 34 ? INPUT : INPUT_PULLUP);
    pegRaw[i] = pegStable[i] = pegSeated(i) ? 1 : 0;
    pegSamples[i] = PEG_DEBOUNCE_SAMPLES;  // trust the reading at boot
  }
  pegMask = readPegMask();
}
#endif

void notifyStatus() {
#if PEG_SWITCH_COUNT > 0
  // [0x02][count][mask lo][mask hi ...], LSB first, bit i = peg i seated.
  // 16 pegs is 4 bytes, well inside the default 20-byte notification payload,
  // so no ATT MTU negotiation is required.
  uint8_t payload[2 + (PEG_SWITCH_COUNT + 7) / 8];
  payload[0] = 0x02;
  payload[1] = PEG_SWITCH_COUNT;
  for (uint8_t b = 0; b < (PEG_SWITCH_COUNT + 7) / 8; b++) {
    payload[2 + b] = (uint8_t)(pegMask >> (8 * b));
  }
  pStatusCharacteristic->setValue(payload, sizeof(payload));
#else
  // Legacy frame: one byte, 0x01 = seated. Keeps a lone summary switch working
  // with the PWA's cabinet-level inference.
  uint8_t statusByte = keyPresent ? 0x01 : 0x00;
  pStatusCharacteristic->setValue(&statusByte, 1);
#endif
  pStatusCharacteristic->notify();
}

void initHardware() {
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  relayRelease();
  digitalWrite(LED_PIN, LOW);

#if PEG_SWITCH_COUNT > 0
  initPegSwitches();
  keyPresent = (pegMask == (uint16_t)((1u << PEG_SWITCH_COUNT) - 1));
  Serial.printf(">>> %u peg switches armed on GPIO", PEG_SWITCH_COUNT);
  for (uint8_t i = 0; i < PEG_SWITCH_COUNT; i++) Serial.printf(" %u", PEG_PINS[i]);
  Serial.println();
#else
  pinMode(MICRO_SWITCH, INPUT_PULLUP);  // LOW = key peg seated (NO contact to GND)
  keyPresent = (digitalRead(MICRO_SWITCH) == LOW);
#endif
}

void checkKeyStatus() {
#if PEG_SWITCH_COUNT > 0
  bool changed = false;
  for (uint8_t i = 0; i < PEG_SWITCH_COUNT; i++) {
    uint8_t raw = pegSeated(i) ? 1 : 0;
    if (raw == pegRaw[i]) {
      if (pegSamples[i] < PEG_DEBOUNCE_SAMPLES) pegSamples[i]++;
    } else {
      pegRaw[i] = raw;
      pegSamples[i] = 1;
    }
    if (pegSamples[i] >= PEG_DEBOUNCE_SAMPLES && pegStable[i] != raw) {
      pegStable[i] = raw;
      changed = true;
      Serial.printf(">>> Peg %u (GPIO%u) %s\n", i + 1, PEG_PINS[i],
                    raw ? "seated" : "TAKEN");
    }
  }
  if (!changed) return;

  uint16_t previous = pegMask;
  pegMask = readPegMask();
  keyPresent = (pegMask == (uint16_t)((1u << PEG_SWITCH_COUNT) - 1));

  if (deviceConnected) {
    Serial.printf(">>> Peg mask 0x%04X -> 0x%04X\n", previous, pegMask);
    notifyStatus();
  } else {
    int64_t now = currentEpochMs();
    if (now > 0) {
      Serial.printf(">>> Peg state changed, phone offline. Log locally @ %lld\n", (long long)now);
    } else {
      Serial.println(">>> Peg state changed, phone offline. Log locally (clock not synced)");
    }
  }
#else
  bool current = (digitalRead(MICRO_SWITCH) == LOW);
  
  if (current != keyPresent) {
    keyPresent = current;
    
    if (deviceConnected) {
      notifyStatus();
      
      Serial.print(">>> Key status updated: ");
      Serial.println(keyPresent ? "IN cabinet" : "TAKEN by user");
    } else {
      int64_t now = currentEpochMs();
      if (now > 0) {
        Serial.printf(">>> Key status changed, phone offline. Log locally @ %lld\n", (long long)now);
      } else {
        Serial.println(">>> Key status changed, phone offline. Log locally (clock not synced)");
      }
    }
  }
#endif
}

#endif
