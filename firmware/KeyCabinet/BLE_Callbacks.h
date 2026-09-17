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
    std::string value = pCharacteristic->getValue();
    if (value.length() == 0) return;

    // Clock sync (phone -> board): "TIME:<epochMs>". No RTC on board, so this
    // is the only source of wall-clock time; millis() is the fallback.
    if (value.rfind("TIME:", 0) == 0) {
      int64_t epochMs = strtoll(value.c_str() + 5, nullptr, 10);
      if (applyPhoneTime(epochMs)) {
        Serial.printf(">>> Clock synced from phone: %lld\n", (long long)epochMs);
      } else {
        Serial.println(">>> Clock sync rejected (implausible timestamp)");
      }
      return;
    }

    if (value[0] == '1') {
      Serial.println(">>> UNLOCK command received!");
      digitalWrite(RELAY_PIN, HIGH);
      delay(1500);              // Hold solenoid open for 1.5s
      digitalWrite(RELAY_PIN, LOW);
      Serial.println(">>> Lock closed.");
    }
  }
};

#endif
