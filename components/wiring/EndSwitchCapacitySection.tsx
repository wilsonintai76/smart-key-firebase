import React from 'react';

interface PegMapRow {
  module: string;
  pins: string;
}

interface FreePinGroup {
  pins: string[];
  kind: string;
  note: string;
  accent: string;
}

interface AccentStyle {
  chip: string;
  dot: string;
}

interface EndSwitchCapacitySectionProps {
  pegMap: PegMapRow[];
  freePinGroups: FreePinGroup[];
  accents: Record<string, AccentStyle>;
}

export const EndSwitchCapacitySection: React.FC<EndSwitchCapacitySectionProps> = ({
  pegMap,
  freePinGroups,
  accents,
}) => (
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
      {pegMap.map((row, i) => (
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

    {freePinGroups.map(group => {
      const accent = accents[group.accent];
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
);
