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

void initHardware() {
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(MICRO_SWITCH, INPUT_PULLUP);  // LOW = key peg seated (NO contact to GND)
  pinMode(LED_PIN, OUTPUT);

  relayRelease();
  digitalWrite(LED_PIN, LOW);

  // Read initial state
  keyPresent = (digitalRead(MICRO_SWITCH) == LOW);
}

void checkKeyStatus() {
  bool current = (digitalRead(MICRO_SWITCH) == LOW);
  
  if (current != keyPresent) {
    keyPresent = current;
    
    if (deviceConnected) {
      // Send 1 byte via BLE Notification
      uint8_t statusByte = keyPresent ? 0x01 : 0x00;
      pStatusCharacteristic->setValue(&statusByte, 1);
      pStatusCharacteristic->notify();
      
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
}

#endif
