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
    role: 'End switch (NO)',
    signal: 'Digital IN, pull-up',
    note: 'LOW = key peg seated, HIGH = key taken. Strapping pin — see the boot note.',
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
    note: 'Wire exactly like GPIO5 — no external resistor needed.',
    accent: 'emerald',
  },
  {
    pins: ['34', '35', '36', '39'],
    kind: 'Input-only',
    note: 'No internal pull-up exists on these four — add 10 kΩ to 3.3 V.',
    accent: 'amber',
  },
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
    title: '4. End switch (key sensor)',
    body: 'Switch COM → GND, switch NO → GPIO5. Firmware enables the internal pull-up, so no resistor is needed and the key reads LOW when seated.',
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

    {/* End switch capacity */}
    <div className="p-6 bg-slate-50 border border-slate-200 rounded-4xl space-y-5">
      <div>
        <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 mb-2">
          <i className="fa-solid fa-diagram-project"></i> End Switch Capacity
        </h4>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          A WROOM-32 module has 34 GPIO pads, but flash, USB-serial and boot duties leave only <strong>18</strong> free
          once the relay, sensor and LED are assigned. Add one switch per pin and share a single common ground return —
          each extra switch costs one signal wire, not two.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { value: '1', label: 'In use now', tone: 'text-blue-600' },
          { value: '8', label: 'No code change', tone: 'text-emerald-600' },
          { value: '18', label: 'Max extra', tone: 'text-slate-900' },
        ].map(card => (
          <div key={card.label} className="p-4 bg-white rounded-2xl border border-slate-200 text-center">
            <p className={`text-2xl font-black ${card.tone}`}>{card.value}</p>
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-tight mt-1">{card.label}</p>
          </div>
        ))}
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
        <p className="text-[9px] font-black uppercase text-amber-700 tracking-tight mb-1">Firmware limit, not hardware</p>
        <p className="text-[9px] text-amber-800/80 leading-relaxed">
          The current firmware reads exactly <strong>one</strong> switch (<code>GPIO5</code>) into a single
          <code> keyPresent</code> flag, and the notify characteristic carries <strong>1 byte</strong> — so up to
          <strong> 8</strong> switches can be reported as a bitmask with no protocol change. More than 8 needs a
          multi-byte payload, and every switch also needs its own row in <code>KeySlot</code> to be audited per key.
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
