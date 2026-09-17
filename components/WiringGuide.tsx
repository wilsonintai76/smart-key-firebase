import React from 'react';
import { PinMapSection } from './wiring/PinMapSection';
import { WiringStepsSection } from './wiring/WiringStepsSection';
import { PowerUpChecksSection } from './wiring/PowerUpChecksSection';
import { ModuleSlotsSection } from './wiring/ModuleSlotsSection';
import { EndSwitchCapacitySection } from './wiring/EndSwitchCapacitySection';
import { BleCommandReferenceSection } from './wiring/BleCommandReferenceSection';

/** Pins the shipped firmware uses, in wiring order. */
const ACTIVE_PINS = [
  {
    pin: 'GPIO4',
    role: 'Relay IN',
    signal: 'Digital OUT',
    note: 'Pulsed for 1.5 s on every unlock. Set RELAY_ACTIVE_LOW in Config.h if the module is low-level trigger.',
  },
  {
    pin: 'GPIO5',
    role: 'Peg switch 1',
    signal: 'Digital IN, pull-up',
    note: 'Peg 1 of module 1 in the 16-switch map. If you turn per-peg sensing off (PEG_SWITCH_COUNT 0) this pin becomes the one summary switch instead: LOW = every peg in the cabinet seated.',
  },
  {
    pin: 'GPIO2',
    role: 'Status LED',
    signal: 'Digital OUT',
    note: '220 Ω in series to GND. Lit while a phone is connected over BLE.',
  },
  {
    pin: '5V',
    role: 'Relay VCC',
    signal: 'Power',
    note: 'The 5 V coil needs ≈3.75 V to pull in. Never run the coil from 3.3 V — it chatters or never switches.',
  },
  {
    pin: 'GND',
    role: 'Common ground',
    signal: 'Power',
    note: 'ESP32, relay module and 12 V supply grounds must be tied together, or the relay trigger floats.',
  },
];

/** Pins left over once the three assigned pins are reserved. */
const FREE_PIN_GROUPS = [
  {
    pins: ['13', '14', '16', '17', '18', '19', '21', '22', '23', '25', '26', '27', '32', '33'],
    kind: 'Internal pull-up',
    note: 'Wire exactly like GPIO5 — no external resistor needed. The 16-switch map claims all 14 of them.',
    accent: 'emerald',
  },
  {
    pins: ['34', '35', '36', '39'],
    kind: 'Input-only',
    note: 'No internal pull-up exists on these four — add 10 kΩ to 3.3 V. The 16-switch map uses GPIO34 for peg 16, leaving 35, 36 and 39 spare.',
    accent: 'amber',
  },
];

/**
 * Where the stock firmware looks for the 16 per-peg switches, in slot order:
 * entries 0-3 are module 1 pegs 1-4, and so on. Mirrors PEG_PINS in Config.h.
 */
const PEG_MAP = [
  { module: 'Module 1', pins: '5 · 13 · 14 · 16' },
  { module: 'Module 2', pins: '17 · 18 · 19 · 21' },
  { module: 'Module 3', pins: '22 · 23 · 25 · 26' },
  { module: 'Module 4', pins: '27 · 32 · 33 · 34' },
];

const WIRING_STEPS = [
  {
    icon: 'fa-bolt',
    title: '1. Control side (relay module)',
    body: 'ESP32 5V → relay VCC, ESP32 GND → relay GND, ESP32 GPIO4 → relay IN. The coil draws ~70–90 mA, which the 5 V pin over USB handles comfortably.',
  },
  {
    icon: 'fa-plug',
    title: '2. Load side (12 V solenoid)',
    body: 'PSU 12 V → relay COM, relay NO → solenoid +, solenoid − → PSU GND. The relay contacts switch the 12 V rail; the ESP32 never sees the lock current.',
  },
  {
    icon: 'fa-shield-halved',
    title: '3. Flyback diode',
    body: '1N4007 across the solenoid terminals, band (cathode) to +12 V. Without it the coil\'s collapsing field arcs the relay contacts on every switch-off.',
  },
  {
    icon: 'fa-toggle-on',
    title: '4. End switches (key sensors)',
    body: 'Switch COM → GND, switch NO → its own signal pin. Firmware enables the internal pull-up, so no resistor is needed and a seated key reads LOW. The stock map gives every peg a pin — 4 per module — so see "One Module = 4 Slots" below before you cut wires.',
  },
  {
    icon: 'fa-lightbulb',
    title: '5. Status LED',
    body: 'GPIO2 → 220 Ω → LED anode, LED cathode → GND.',
  },
];

const CHECK_STEPS = [
  'Flash and power the ESP32 over USB only — leave the 12 V rail and the solenoid disconnected.',
  'Confirm the trigger polarity: unplug relay IN, jumper IN → 3.3 V, then IN → GND. Whichever edge clicks the relay is your level.',
  'If the relay clicks on GND (low-level trigger), set RELAY_ACTIVE_LOW to 1 in Config.h and re-flash. Do not connect the solenoid until the polarity matches.',
  'Wire the 12 V load and confirm the lock is relaxed at idle; then unlock from the app and watch Serial print the command and the 1.5 s pulse.',
];

const COMMANDS = [
  { cmd: 'UNLOCK', use: 'Slot unlock / take key' },
  { cmd: 'DOOR', use: 'Main cabinet door' },
  { cmd: 'CYCLE:<slot>', use: 'Maintenance pulse' },
  { cmd: 'FORCE_RETURN:<slot>', use: 'Acknowledged, audited in cloud' },
  { cmd: 'TIME:<epochMs>', use: 'Clock sync on connect' },
];

/**
 * One "module" is 4 key slots (the app appends 4 rows per Add Module click), and
 * PEG_SWITCH_COUNT decides whether a module reports per peg or as a single row.
 * These are the two ways to wire the pegs, and what each one actually tells the app.
 */
const SENSOR_MODES = [
  {
    name: 'Per-peg',
    badge: 'Default',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    cost: '1 switch per peg · 4 GPIO per module',
    tells: 'Exactly which of the 4 pegs is empty — measured, not guessed.',
    detail:
      'PEG_SWITCH_COUNT ships as 16, so the firmware reads one pin per peg, debounces each one separately, and reports the whole set as a bitmask. Every bit maps to its own KeySlot row, so the audit names the slot that actually moved.',
    change: 'Flash as-is.',
  },
  {
    name: 'Row-level',
    badge: 'Opt-in',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
    cost: '1 switch · 1 GPIO',
    tells: 'That the module has a gap — not which peg.',
    detail:
      'Set PEG_SWITCH_COUNT to 0 in Config.h to fall back to the single summary switch on GPIO5. You can also series-wire all four peg switches into that one pin: the circuit stays closed only while every peg is seated, which still tells you just "this row has a gap".',
    change: 'Config.h: PEG_SWITCH_COUNT 0.',
  },
];

const ACCENTS: Record<string, { chip: string; dot: string }> = {
  emerald: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
  amber: { chip: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' },
};

export const WiringGuide: React.FC = () => (
  <div className="space-y-6">
    <h3 className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1 flex items-center gap-2">
      <i className="fa-solid fa-microchip"></i> Pin Map &amp; Wiring Guide
    </h3>

    {/* Pin map */}
    <PinMapSection pins={ACTIVE_PINS} />

    {/* Wiring steps */}
    <WiringStepsSection steps={WIRING_STEPS} />

    {/* Polarity / first power-up */}
    <PowerUpChecksSection steps={CHECK_STEPS} />

    {/* One module = 4 slots */}
    <ModuleSlotsSection modes={SENSOR_MODES} />

    {/* End switch capacity */}
    <EndSwitchCapacitySection
      pegMap={PEG_MAP}
      freePinGroups={FREE_PIN_GROUPS}
      accents={ACCENTS}
    />

    {/* BLE command reference */}
    <BleCommandReferenceSection commands={COMMANDS} />
  </div>
);
