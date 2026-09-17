
import { ControllerStatus } from '../types';
import { SERVICE_UUID, WRITE_CHAR_UUID, STATUS_CHAR_UUID } from './bleUuids';

export type BluetoothStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error';
export type KeyPresenceCallback = (keyPresent: boolean) => void;
/** One bit per instrumented peg: bit i set = peg i seated, lowest slot first. */
export type PegMaskCallback = (pegCount: number, mask: number) => void;

export class BluetoothService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private statusCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

  public status: BluetoothStatus = 'disconnected';
  public discoveredDevices: BluetoothDevice[] = [];

  private onStatusChangeCallbacks: ((status: BluetoothStatus) => void)[] = [];
  private onDataReceivedCallbacks: ((data: string) => void)[] = [];
  private onDiscoveryCallbacks: ((devices: BluetoothDevice[]) => void)[] = [];
  private onKeyPresenceCallbacks: KeyPresenceCallback[] = [];
  private onPegMaskCallbacks: PegMaskCallback[] = [];

  // ── Status helpers ──────────────────────────────────────────────

  private setStatus(newStatus: BluetoothStatus) {
    this.status = newStatus;
    this.onStatusChangeCallbacks.forEach(cb => cb(newStatus));
  }

  public onStatusChange(callback: (status: BluetoothStatus) => void) {
    this.onStatusChangeCallbacks.push(callback);
    callback(this.status);
    return () => {
      this.onStatusChangeCallbacks = this.onStatusChangeCallbacks.filter(c => c !== callback);
    };
  }

  public onDiscovery(callback: (devices: BluetoothDevice[]) => void) {
    this.onDiscoveryCallbacks.push(callback);
    callback(this.discoveredDevices);
    return () => {
      this.onDiscoveryCallbacks = this.onDiscoveryCallbacks.filter(c => c !== callback);
    };
  }

  public onDataReceived(callback: (data: string) => void) {
    this.onDataReceivedCallbacks.push(callback);
    return () => {
      this.onDataReceivedCallbacks = this.onDataReceivedCallbacks.filter(c => c !== callback);
    };
  }

  /** Subscribe to key-presence notifications (0x01 = in cabinet, 0x00 = taken) */
  public onKeyPresence(callback: KeyPresenceCallback) {
    this.onKeyPresenceCallbacks.push(callback);
    return () => {
      this.onKeyPresenceCallbacks = this.onKeyPresenceCallbacks.filter(c => c !== callback);
    };
  }

  /** Subscribe to per-peg switch reports, sent only by firmware with individual peg switches. */
  public onPegMask(callback: PegMaskCallback) {
    this.onPegMaskCallbacks.push(callback);
    return () => {
      this.onPegMaskCallbacks = this.onPegMaskCallbacks.filter(c => c !== callback);
    };
  }

  // ── Scanning ────────────────────────────────────────────────────

  public async startScanning(): Promise<void> {
    if (!navigator.bluetooth) {
      this.setStatus('error');
      return;
    }
    this.setStatus('scanning');
    this.discoveredDevices = [];
    this.onDiscoveryCallbacks.forEach(cb => cb([]));

    // Real BLE scanning: browser-native picker (no mock)
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });
      this.discoveredDevices = [device];
      this.onDiscoveryCallbacks.forEach(cb => cb(this.discoveredDevices));
      await this.connectToDevice(device);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        console.error('BLE scan failed:', err.message);
        this.setStatus('error');
      }
      // User cancelled — stay scanning/disconnected
    }
  }

  // ── Connect ─────────────────────────────────────────────────────

  public async connect(): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome or Edge on Desktop/Android.');
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: 'KeyCabinet' },
          { services: [SERVICE_UUID] },
        ],
        optionalServices: [SERVICE_UUID],
      });
      await this.connectToDevice(device);
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        console.log('User cancelled Bluetooth pairing');
        return;
      }
      console.error('Bluetooth requestDevice failed:', error?.message || String(error));
      this.setStatus('error');
      throw error;
    }
  }

  public async connectToDevice(device: BluetoothDevice): Promise<void> {
    try {
      this.setStatus('connecting');
      this.device = device;

      device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

      this.server = await device.gatt?.connect() || null;
      if (!this.server) throw new Error('Failed to connect to GATT Server');

      const service = await this.server.getPrimaryService(SERVICE_UUID);

      // Write characteristic (PWA → ESP32: unlock command)
      this.writeCharacteristic = await service.getCharacteristic(WRITE_CHAR_UUID);

      // Status characteristic (ESP32 → PWA: key presence notifications)
      this.statusCharacteristic = await service.getCharacteristic(STATUS_CHAR_UUID);
      await this.statusCharacteristic.startNotifications();
      this.statusCharacteristic.addEventListener(
        'characteristicvaluechanged',
        this.handleStatusNotification.bind(this),
      );

      // Read current state immediately — firmware only notifies on change, not on connect
      try {
        const currentValue = await this.statusCharacteristic.readValue();
        this.processStatusValue(currentValue);
      } catch { /* ignore if characteristic is notify-only */ }

      this.setStatus('connected');
      // The cabinet has no RTC, so hand it the phone's wall clock (and again on
      // every reconnect) — it keeps time with millis() afterwards.
      await this.syncDeviceTime();
      console.log('BLE connected to KeyCabinet:', device.name);
    } catch (error: any) {
      console.error('Bluetooth connection failed:', error?.message || String(error));
      this.setStatus('error');
      throw error;
    }
  }

  // ── Disconnect ──────────────────────────────────────────────────

  private onDisconnected() {
    console.log('KeyCabinet BLE disconnected');
    if (this.statusCharacteristic) {
      this.statusCharacteristic.removeEventListener(
        'characteristicvaluechanged',
        this.handleStatusNotification.bind(this),
      );
    }
    this.setStatus('disconnected');
    this.device = null;
    this.server = null;
    this.writeCharacteristic = null;
    this.statusCharacteristic = null;
  }

  public disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.onDisconnected();
  }

  // ── Key Presence Notifications (ESP32 → PWA) ────────────────────

  /**
   * STATUS characteristic frames:
   *   1 byte  — legacy summary switch: 0x01 = a key is seated, 0x00 = taken.
   *             The slot that moved is inferred by the caller.
   *   0x02…   — per-peg bitmask: [0x02][count][mask lo][mask hi], LSB first,
   *             bit i = peg i seated. The slot is known, not inferred.
   */
  private processStatusValue(dv: DataView) {
    if (dv.byteLength >= 2 && dv.getUint8(0) === 0x02) {
      const pegCount = Math.min(dv.getUint8(1), 16);
      if (pegCount === 0) return;

      let mask = 0;
      for (let b = 0; b < Math.ceil(pegCount / 8) && 2 + b < dv.byteLength; b++) {
        mask |= dv.getUint8(2 + b) << (8 * b);
      }

      this.onPegMaskCallbacks.forEach(cb => cb(pegCount, mask));

      // Keep the cabinet-level telemetry meaningful: "taken" when any
      // instrumented peg is empty.
      const allSeated = (1 << pegCount) - 1;
      const anyTaken = (mask & allSeated) !== allSeated;
      this.onDataReceivedCallbacks.forEach(cb => cb(anyTaken ? 'KEY_TAKEN' : 'KEY_RETURNED'));
      return;
    }

    if (dv.byteLength !== 1) return;
    const byte = dv.getUint8(0);
    if (byte !== 0x00 && byte !== 0x01) return;
    const keyPresent = byte === 0x01;
    this.onKeyPresenceCallbacks.forEach(cb => cb(keyPresent));
    const statusStr = keyPresent ? 'KEY_RETURNED' : 'KEY_TAKEN';
    this.onDataReceivedCallbacks.forEach(cb => cb(statusStr));
  }

  private handleStatusNotification(event: Event) {
    const char = event.target as BluetoothRemoteGATTCharacteristic;
    if (char.value) this.processStatusValue(char.value);
  }

  // ── Commands (PWA → ESP32) ──────────────────────────────────────

  /**
   * Write one ASCII command line. The firmware matches the verb before the
   * first ':' and ignores the rest, so lines must stay within the ~19-byte ATT
   * payload limit: the write characteristic is write-only, so the default
   * 23-byte MTU is never negotiated. See the command table in README.md.
   */
  private async writeLine(line: string): Promise<void> {
    if (!this.writeCharacteristic) {
      throw new Error('Not connected to KeyCabinet');
    }
    try {
      await this.writeCharacteristic.writeValue(new TextEncoder().encode(line + '\n'));
    } catch (err: any) {
      console.error(`BLE write "${line}" failed:`, err?.message || String(err));
      throw err;
    }
  }

  /** Energize the solenoid so the key in the given slot can be taken. */
  public async unlock(slotId?: number): Promise<void> {
    console.log(`Unlock command sent to KeyCabinet (slot ${slotId ?? 'main'})`);
    await this.writeLine('UNLOCK');
  }

  /** Unlock the cabinet's main door latch. */
  public async unlockDoor(): Promise<void> {
    await this.writeLine('DOOR');
  }

  /** Run a maintenance cycle on a slot; the relay pulses once. */
  public async runMaintenance(slotId?: number): Promise<void> {
    await this.writeLine(`CYCLE:${slotId ?? 0}`);
  }

  /**
   * Force-return override. The board has no policy engine, so there is nothing
   * to actuate -- the firmware just acknowledges it, and the caller records the
   * audit entry in Realtime Database.
   */
  public async forceReturn(slotId?: number): Promise<void> {
    await this.writeLine(`FORCE_RETURN:${slotId ?? 0}`);
  }

  // ── Clock Sync (PWA → ESP32) ───────────────────────────────────

  /**
   * Push the phone's clock to the ESP32 as `TIME:<epochMs>`. The board has no
   * RTC or backup battery, so this is its only wall-clock source; the firmware
   * rejects implausible values and reports the state over Serial.
   */
  public async syncDeviceTime(): Promise<boolean> {
    if (!this.writeCharacteristic) return false;

    try {
      const data = new TextEncoder().encode(`TIME:${Date.now()}\n`);
      await this.writeCharacteristic.writeValue(data);
      console.log('Clock synced to KeyCabinet');
      return true;
    } catch (err: any) {
      console.warn('Clock sync failed:', err?.message || String(err));
      return false;
    }
  }

  // ── Parse status (backward compat) ──────────────────────────────

  public parseStatus(msg: string): ControllerStatus | null {
    try {
      if (msg.startsWith('{') && msg.endsWith('}')) {
        return JSON.parse(msg);
      }
      // Handle KeyCabinet binary status strings
      if (msg === 'KEY_RETURNED' || msg === 'KEY_TAKEN') {
        return {
          online: true,
          lastSeen: Date.now(),
          ip: 'BLE',
          mode: 'STA',
          doorOpen: msg === 'KEY_TAKEN',
        };
      }
    } catch (e) {
      return null;
    }
    return null;
  }
}

export const bluetoothService = new BluetoothService();
