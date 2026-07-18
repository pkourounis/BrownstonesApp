export type PrintRow = { name: string; role: string | null; cells: Record<string, string[]> };

/**
 * Landscape, print-only weekly work schedule: employees (rows) × days (columns).
 * Hidden on screen; shown only when printing.
 */
export function PrintScheduleGrid({
  storeName,
  weekLabel,
  days,
  rows,
}: {
  storeName: string | null;
  weekLabel: string;
  days: { key: string; label: string }[];
  rows: PrintRow[];
}) {
  return (
    <div className="hidden text-brand-950 print:block">
      <style>{`@page{size:landscape;margin:0.4in}`}</style>
      <div className="mb-2 flex items-baseline justify-between">
        <h1 className="font-display text-xl font-bold">{storeName ?? 'Brownstones Coffee'} — Weekly Schedule</h1>
        <span className="text-sm">{weekLabel}</span>
      </div>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="border border-brand-300 bg-brand-100 px-2 py-1 text-left">Employee</th>
            {days.map((d) => (
              <th key={d.key} className="border border-brand-300 bg-brand-100 px-2 py-1 text-center">{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={days.length + 1} className="border border-brand-300 px-2 py-4 text-center text-brand-500">No shifts scheduled this week.</td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                <td className="border border-brand-300 px-2 py-1 align-top">
                  <span className="font-semibold">{r.name}</span>
                  {r.role && <span className="block text-[9px] text-brand-500">{r.role}</span>}
                </td>
                {days.map((d) => (
                  <td key={d.key} className="border border-brand-300 px-2 py-1 text-center align-top">
                    {(r.cells[d.key] ?? []).map((t, j) => (
                      <span key={j} className="block whitespace-nowrap">{t}</span>
                    ))}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="mt-2 text-[9px] text-brand-400">Brownstones Coffee · printed schedule</p>
    </div>
  );
}
