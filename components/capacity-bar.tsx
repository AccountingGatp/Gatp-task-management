import clsx from "clsx";
import { hours } from "@/lib/format";

/**
 * The capacity ruler. One track per person per week:
 *  - ticks mark each 8-hour working day up to capacity
 *  - dark fill = hours already logged, light fill = remaining estimated work
 *  - anything past the capacity line is hatched coral and labelled "Over by …"
 */
export function CapacityBar({
  assigned,
  logged,
  capacity,
  compact = false,
  animate = true,
}: {
  assigned: number;
  logged?: number;
  capacity: number;
  compact?: boolean;
  animate?: boolean;
}) {
  const cap = Math.max(capacity, 1);
  const scaleMax = Math.max(cap * 1.25, assigned, logged ?? 0);
  const pct = (h: number) => `${Math.min(100, (h / scaleMax) * 100)}%`;
  const within = Math.min(assigned, cap);
  const over = Math.max(0, assigned - cap);
  const done = Math.min(logged ?? 0, within);
  const ticks = Math.floor(cap / 8);

  return (
    <div className={clsx("relative w-full", compact ? "h-2" : "h-3")} role="img" aria-label={`${hours(assigned)} assigned of ${hours(cap)} capacity${over > 0 ? `, over by ${hours(over)}` : ""}`}>
      <div className="absolute inset-0 rounded-full bg-rule-soft" />
      <div className={clsx("absolute inset-y-0 left-0 overflow-hidden rounded-full", animate && "ruler-fill")} style={{ width: pct(assigned) }}>
        <div className="absolute inset-y-0 left-0 bg-mist" style={{ width: `${(within / Math.max(assigned, 0.0001)) * 100}%` }} />
        {over > 0 ? <div className="over-hatch absolute inset-y-0 right-0" style={{ width: `${(over / assigned) * 100}%` }} /> : null}
        {done > 0 ? <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${(done / Math.max(assigned, 0.0001)) * 100}%` }} /> : null}
      </div>
      {Array.from({ length: Math.max(0, ticks - 1) }, (_, i) => (
        <span key={i} className="absolute inset-y-0 w-px bg-paper/90" style={{ left: pct((i + 1) * 8) }} />
      ))}
      <span className="absolute -inset-y-1 w-0.5 rounded-full bg-ink" style={{ left: pct(cap) }} title={`Capacity ${hours(cap)}`} />
    </div>
  );
}

export function CapacityLabel({ assigned, capacity }: { assigned: number; capacity: number }) {
  const over = assigned - capacity;
  return (
    <span className="num inline-flex items-baseline gap-2 whitespace-nowrap">
      <span>
        <span className={clsx("font-semibold", over > 0 && "text-brick")}>{Math.round(assigned * 10) / 10}</span>
        <span className="text-graphite"> / {capacity} h</span>
      </span>
      {over > 0.05 ? (
        <span className="text-xs font-medium text-brick">Over by {hours(over)}</span>
      ) : capacity - assigned >= 8 ? (
        <span className="text-xs text-graphite">{hours(capacity - assigned)} free</span>
      ) : null}
    </span>
  );
}
