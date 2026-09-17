#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <esp_pm.h>

#include "Config.h"
#include "BLE_Callbacks.h"
#include "BLE_Manager.h"
#include "Cabinet_Manager.h"

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n===== Key Cabinet v2.0 =====");

  // 1. Hardware Init
  initHardware();
  
  // 2. Power Management (Light-sleep allowed)
  #if CONFIG_PM_ENABLE
    esp_pm_config_t pm_config = {
      .max_freq_mhz = 80,
      .min_freq_mhz = 40,
      .light_sleep_enable = true
    };
    esp_pm_configure(&pm_config);
    Serial.println("Power management enabled.");
  #endif

  // 3. BLE Init
  initBLE();

  Serial.println("System ready. Waiting for phone...");
}

void loop() {
  // Release the solenoid when its unlock pulse expires
  serviceRelay();

  // Sample each peg switch, debounce it, and notify on any change
  checkKeyStatus();

  // One debounce sample per pass: 4 samples at 20 ms settles a contact in
  // ~80 ms, so a quick grab-and-go still registers.
  delay(20);
}
