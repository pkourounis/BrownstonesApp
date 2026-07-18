export type StripDay = { key: string; abbr: string; sched: number; reco: number; count: number };

const toneFor = (reco: number, sched: number) => {
  if (reco <= 0) return 'bg-brand-50 text-brand-400';
  const gap = reco - sched;
  return gap > 4 ? 'bg-brick-500/10 text-brick-600' : gap < -4 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
};

/**
 * Week-at-a-glance strip: scheduled vs recommended hours per day, color-coded
 * by coverage. Used in the builder, the schedule, and the Home Screen.
 */
export function WeekStrip({
  days,
  title,
  linkBase,
  compact,
}: {
  days: StripDay[];
  title?: string;
  linkBase?: string; // e.g. '#day-' to jump to a builder day
  compact?: boolean;
}) {
  return (
    <section>
      {title && (
        <div className="mb-1.5 flex items-baseline justify-between">
          <h2 className="font-semibold text-brand-900">{title}</h2>
          <span className="text-[11px] text-brand-500">scheduled / recommended hrs</span>
        </div>
      )}
      <div className="-mx-1 grid grid-cols-7 gap-1 px-1">
        {days.map((o) => {
          const cls = `rounded-lg p-1.5 text-center ${toneFor(o.reco, o.sched)}`;
          const inner = (
            <>
              <p className="text-[10px] font-bold uppercase">{o.abbr}</p>
              <p className={`mt-0.5 font-bold tabular-nums ${compact ? 'text-xs' : 'text-sm'}`}>{o.sched.toFixed(0)}</p>
              <p className="text-[9px] font-medium tabular-nums opacity-80">of {o.reco > 0 ? o.reco.toFixed(0) : '—'}h</p>
              {!compact && <p className="mt-0.5 text-[9px] opacity-70">{o.count} shift{o.count === 1 ? '' : 's'}</p>}
            </>
          );
          const title = `${o.abbr}: ${o.sched.toFixed(0)}h scheduled vs ${o.reco > 0 ? o.reco.toFixed(0) + 'h recommended' : 'no recommendation'} · ${o.count} shifts`;
          return linkBase ? (
            <a key={o.key} href={`${linkBase}${o.key}`} className={cls} title={title}>{inner}</a>
          ) : (
            <div key={o.key} className={cls} title={title}>{inner}</div>
          );
        })}
      </div>
      {!compact && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-brand-500">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-green-100 ring-1 ring-green-300" /> On target</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-brick-500/10 ring-1 ring-brick-400" /> Understaffed</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-amber-100 ring-1 ring-amber-400" /> Overstaffed</span>
        </div>
      )}
    </section>
  );
}
