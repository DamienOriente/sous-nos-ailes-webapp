import { DAY_SLOTS, WEEKDAY_LABELS } from "@/modules/professionals/domain/listing-schema";
import type { AvailabilitySlot } from "@/modules/professionals/application/availability-service";

/** Weekday × slot checkbox grid. Each checked box posts `slot=<weekday>-<start>-<end>`. */
export function AvailabilityGrid({ slots }: { slots: AvailabilitySlot[] }) {
  const checked = new Set(slots.map((s) => `${s.weekday}-${s.startMinute}-${s.endMinute}`));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">Disponibilités hebdomadaires par jour et créneau</caption>
        <thead>
          <tr>
            <th scope="col" className="p-2 text-left font-medium text-muted-foreground">
              Jour
            </th>
            {DAY_SLOTS.map((s) => (
              <th key={s.key} scope="col" className="p-2 text-center font-medium text-muted-foreground">
                {s.label}
                <span className="block text-xs font-normal">
                  {Math.floor(s.startMinute / 60)}h–{Math.floor(s.endMinute / 60) === 24 ? "minuit" : `${Math.floor(s.endMinute / 60)}h`}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAY_LABELS.map((day, weekday) => (
            <tr key={day} className="border-t">
              <th scope="row" className="p-2 text-left font-medium">
                {day}
              </th>
              {DAY_SLOTS.map((s) => {
                const value = `${weekday}-${s.startMinute}-${s.endMinute}`;
                return (
                  <td key={s.key} className="p-1 text-center">
                    <label className="flex h-11 cursor-pointer items-center justify-center rounded-lg border transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/15 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                      <input type="checkbox" name="slot" value={value} defaultChecked={checked.has(value)} className="sr-only" aria-label={`${day} ${s.label}`} />
                      <span className="text-xs font-medium text-primary [input:not(:checked)~&]:opacity-0">Disponible</span>
                    </label>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
