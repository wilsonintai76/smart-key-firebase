#ifndef BLE_CALLBACKS_H
#define BLE_CALLBACKS_H

#include <BLEServer.h>
#include "Config.h"

// ======================================================
// 1. Server Callbacks (Connection / Disconnection)
// ======================================================
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    deviceConnected = true;
    digitalWrite(LED_PIN, HIGH);
    Serial.printf(">>> Phone CONNECTED (clock %s)\n", timeSynced ? "synced" : "not synced");
    // Push current end-switch state immediately so phone doesn't wait for a change
    uint8_t statusByte = keyPresent ? 0x01 : 0x00;
    pStatusCharacteristic->setValue(&statusByte, 1);
    pStatusCharacteristic->notify();
  }

  void onDisconnect(BLEServer* pServer) override {
    deviceConnected = false;
    digitalWrite(LED_PIN, LOW);
    Serial.println(">>> Phone DISCONNECTED. Restarting advertising...");
    pServer->startAdvertising();
  }
};

// ======================================================
// 2. Write Characteristic Callbacks (Unlock Command)
// ======================================================
class WriteCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    String value = pCharacteristic->getValue();
    if (value.length() == 0) return;

    // Legacy single-byte unlock (BluetoothService.unlock()).
    if (value.length() == 1 && (uint8_t)value[0] == 0x01) {
      Serial.println(">>> UNLOCK command received (binary)");
      requestUnlock();
      return;
    }

    // Everything else is an ASCII command line, at most ~19 bytes: the write
    // characteristic is PROPERTY_WRITE, so the default 23-byte ATT MTU is never
    // negotiated. See the command table in README.md.
    String line = value;
    line.trim();

    // Clock sync (phone -> board): "TIME:<epochMs>". No RTC on board, so this
    // is the only source of wall-clock time; millis() is the fallback.
    if (line.startsWith("TIME:")) {
      int64_t epochMs = strtoll(line.c_str() + 5, nullptr, 10);
      if (applyPhoneTime(epochMs)) {
        Serial.printf(">>> Clock synced from phone: %lld\n", (long long)epochMs);
      } else {
        Serial.println(">>> Clock sync rejected (implausible timestamp)");
      }
      return;
    }

    String verb = line;
    int sep = verb.indexOf(':');
    if (sep >= 0) verb = verb.substring(0, sep);
    verb.toUpperCase();

    if (verb == "UNLOCK" || verb == "DOOR" || verb == "CYCLE" || verb == "1") {
      Serial.printf(">>> %s command received\n", verb.c_str());
      requestUnlock();
    } else if (verb == "FORCE_RETURN") {
      // Bookkeeping only -- the PWA records the override in Realtime Database.
      Serial.println(">>> FORCE_RETURN acknowledged (no actuator action)");
    } else {
      Serial.printf(">>> Unknown command ignored: %s\n", line.c_str());
    }
  }
};

#endif
