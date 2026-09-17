import React from 'react';

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
    <div className="bg-white border border-slate-100 rounded-[28px] overflow-hidden">
      {ACTIVE_PINS.map((row, i) => (
        <div
          key={row.pin}
          className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-5 py-4 ${i > 0 ? 'border-t border-slate-100' : ''}`}
        >
          <span className="font-mono text-[11px] font-bold text-white bg-slate-900 rounded-lg px-3 py-1.5 w-fit shrink-0">
            {row.pin}
          </span>
          <div className="md:w-40 shrink-0">
            <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{row.role}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase">{row.signal}</p>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">{row.note}</p>
        </div>
      ))}
    </div>

    {/* Wiring steps */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {WIRING_STEPS.map(step => (
        <div key={step.title} className="p-5 bg-white border border-slate-100 rounded-[24px]">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3">
            <i className={`fa-solid ${step.icon}`}></i>
          </div>
          <h4 className="text-xs font-black text-slate-900 uppercase mb-2">{step.title}</h4>
          <p className="text-[10px] text-slate-500 leading-relaxed">{step.body}</p>
        </div>
      ))}
    </div>

    {/* Polarity / first power-up */}
    <div className="relative overflow-hidden p-6 bg-slate-900 rounded-4xl text-white">
      <h4 className="text-[10px] font-black uppercase text-amber-400 tracking-widest flex items-center gap-2 mb-4">
        <i className="fa-solid fa-triangle-exclamation"></i> First Power-Up Checks
      </h4>
      <ol className="space-y-3 relative z-10">
        {CHECK_STEPS.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold shrink-0">
              {i + 1}
            </span>
            <p className="text-[10px] text-slate-300 leading-relaxed">{step}</p>
          </li>
        ))}
      </ol>
      <i className="fa-solid fa-bolt absolute -right-10 -bottom-10 text-[160px] text-white/5 rotate-12 pointer-events-none"></i>
    </div>

    {/* One module = 4 slots */}
    <div className="p-6 bg-slate-50 border border-slate-200 rounded-4xl space-y-5">
      <div>
        <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 mb-2">
          <i className="fa-solid fa-table-cells"></i> One Module = 4 Slots
        </h4>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Adding a module in Control Hub creates <strong>4 key slots</strong>, so one row of your pegboard holds
          <strong> 4 pegs</strong>, not one. The shipped firmware puts one switch on each peg, so the cabinet reports
          the <strong>individual peg</strong> that moved and the app simply believes it. Only the row-level fallback
          leaves the app to infer which peg was taken by looking for the slot you just unlocked.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SENSOR_MODES.map(mode => (
          <div key={mode.name} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase text-slate-900 tracking-tight">{mode.name}</p>
              <span className={`text-[8px] font-black uppercase rounded-lg px-2 py-1 border ${mode.badgeClass}`}>
                {mode.badge}
              </span>
            </div>
            <p className="text-[9px] font-mono font-bold text-blue-600">{mode.cost}</p>
            <p className="text-[9px] font-bold text-slate-700 leading-relaxed">{mode.tells}</p>
            <p className="text-[9px] text-slate-500 leading-relaxed">{mode.detail}</p>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-tight">{mode.change}</p>
          </div>
        ))}
      </div>

      <div className="p-4 bg-white rounded-2xl border border-slate-200">
        <p className="text-[9px] font-black uppercase text-rose-500 tracking-tight mb-1">
          Row-level mode infers the peg
        </p>
        <p className="text-[9px] text-slate-500 leading-relaxed">
          Only when <code>PEG_SWITCH_COUNT</code> is 0 does the app guess: it marks the slot sitting in
          <code> UNLOCKED</code> state as BORROWED, and falls back to the first <code>AVAILABLE</code> one if none is.
          That is accurate while a single key leaves at a time — take two together and the second is blamed on
          whichever slot happens to sort first. Per-peg wiring removes that guess entirely.
        </p>
      </div>
    </div>

    {/* End switch capacity */}
    <div className="p-6 bg-slate-50 border border-slate-200 rounded-4xl space-y-5">
      <div>
        <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 mb-2">
          <i className="fa-solid fa-diagram-project"></i> End Switch Capacity
        </h4>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          A WROOM-32 module has 34 GPIO pads, but flash, USB-serial and boot duties leave <strong>19</strong> usable
          switch channels once the relay and the LED are assigned. Give each switch its own pin and share a single
          common ground return — each extra switch costs one signal wire, not two.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { value: '16', label: 'Peg switches max', tone: 'text-blue-600' },
          { value: '4', label: 'Modules sensed', tone: 'text-emerald-600' },
          { value: '19', label: 'Switch channels', tone: 'text-slate-900' },
        ].map(card => (
          <div key={card.label} className="p-4 bg-white rounded-2xl border border-slate-200 text-center">
            <p className={`text-2xl font-black ${card.tone}`}>{card.value}</p>
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-tight mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-[9px] font-black uppercase text-slate-900 tracking-tight">
            Peg switch map <span className="text-slate-400">· PEG_PINS</span>
          </p>
          <p className="text-[9px] text-slate-400 mt-1">
            16 switches fill 4 modules exactly and leave 3 pins over. A fifth module needs 20 switches — more than the
            19 available — so 4 is the practical ceiling without dropping the status LED.
          </p>
        </div>
        {PEG_MAP.map((row, i) => (
          <div
            key={row.module}
            className={`flex items-center justify-between gap-4 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}
          >
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-tight">{row.module}</span>
            <span className="font-mono text-[10px] font-bold text-slate-900">GPIO {row.pins}</span>
          </div>
        ))}
        <div className="px-4 py-3 border-t border-slate-100 bg-amber-50">
          <p className="text-[9px] text-amber-800/80 leading-relaxed">
            Peg 16 is <code>GPIO34</code>, which is input-only and has no internal pull-up — fit a 10 kΩ resistor from
            GPIO34 to 3.3 V for that one switch. The other fifteen need nothing.
          </p>
        </div>
      </div>

      {FREE_PIN_GROUPS.map(group => {
        const accent = ACCENTS[group.accent];
        return (
          <div key={group.kind}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${accent.dot}`}></span>
              <p className="text-[9px] font-black uppercase text-slate-500 tracking-tight">{group.kind}</p>
              <span className="text-[9px] font-bold text-slate-400">• {group.pins.length} pins</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {group.pins.map(pin => (
                <span
                  key={pin}
                  className={`font-mono text-[10px] font-bold rounded-lg px-2.5 py-1 border ${accent.chip}`}
                >
                  GPIO{pin}
                </span>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 leading-relaxed">{group.note}</p>
          </div>
        );
      })}

      <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
        <p className="text-[9px] font-black uppercase text-rose-500 tracking-tight flex items-center gap-2">
          <i className="fa-solid fa-ban"></i> Never use for a switch
        </p>
        <p className="text-[9px] text-slate-500 leading-relaxed">
          GPIO0 (BOOT button), GPIO1/GPIO3 (USB serial), GPIO6–GPIO11 (SPI flash) and GPIO12 (flash-voltage strap —
          pulling it high at boot can brick the boot sequence). GPIO15 also works, but it is a strapping pin: a switch
          closed at power-up silences the boot log. GPIO5 is a strapping pin too — held low at boot it only selects an
          SDIO timing option this project never uses, so a seated key is harmless.
        </p>
      </div>

      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
        <p className="text-[9px] font-black uppercase text-amber-700 tracking-tight mb-1">
          PEG_SWITCH_COUNT must match your wiring
        </p>
        <p className="text-[9px] text-amber-800/80 leading-relaxed">
          <code>PEG_SWITCH_COUNT</code> is <strong>16</strong> and has to equal the number of switches actually
          connected. An unwired pin floats high, which the firmware reports as "key removed" — flash 16 with three
          pegs bare and those slots show <strong>Borrowed</strong> the moment the phone connects. Set it to the real
          count, or to <strong>0</strong> for the single summary switch.
        </p>
        <p className="text-[9px] text-amber-800/80 leading-relaxed mt-2">
          The pegs travel as a <strong>2-byte</strong> bitmask <code>[0x02][count][mask…]</code>, which fits inside the
          default 20-byte notification, so no ATT MTU negotiation is involved. The frame carries a 16-bit mask, so 16
          is the ceiling without widening the payload. Per-peg sensing is also what makes the audit exact: each bit
          names its own <code>KeySlot</code> row, so the first status after connecting reconciles the slots silently
          and only later changes are logged as take/return events.
        </p>
      </div>
    </div>

    {/* BLE command reference */}
    <div className="bg-white border border-slate-100 rounded-[28px] overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-[10px] font-black uppercase text-slate-900 tracking-tight">BLE Command Reference</p>
        <p className="text-[9px] text-slate-400 mt-1">
          ASCII, newline-terminated, 19 bytes maximum — the write characteristic never negotiates a larger MTU.
        </p>
      </div>
      {COMMANDS.map((c, i) => (
        <div key={c.cmd} className={`flex items-center justify-between gap-4 px-5 py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
          <span className="font-mono text-[10px] font-bold text-blue-600">{c.cmd}</span>
          <span className="text-[9px] font-bold text-slate-400 uppercase text-right">{c.use}</span>
        </div>
      ))}
    </div>
  </div>
);
