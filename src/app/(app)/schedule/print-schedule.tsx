export type Dept = 'foh' | 'boh' | 'management';
export type PrintRow = { name: string; role: string | null; dept: Dept | null; cells: Record<string, string[]> };

const DEPT_ORDER: Dept[] = ['foh', 'boh', 'management'];
const DEPT_LABEL: Record<Dept, string> = { foh: 'Front of House', boh: 'Back of House', management: 'Management' };

/**
 * Landscape, print-only weekly work schedule: employees (rows) × days (columns),
 * split into a separate section per department (FOH / BOH / Management) so each
 * can be printed and handed out on its own page.
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
  // Group rows by department; anything without a department falls under FOH.
  const groups = DEPT_ORDER
    .map((dept) => ({ dept, rows: rows.filter((r) => (r.dept ?? 'foh') === dept) }))
    .filter((g) => g.rows.length > 0);

  const table = (list: PrintRow[]) => (
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
        {list.map((r, i) => (
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
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="hidden text-brand-950 print:block">
      <style>{`@page{size:landscape;margin:0.4in}`}</style>
      {groups.length === 0 ? (
        <>
          <div className="mb-2 flex items-baseline justify-between">
            <h1 className="font-display text-xl font-bold">{storeName ?? 'Brownstones Coffee'} — Weekly Schedule</h1>
            <span className="text-sm">{weekLabel}</span>
          </div>
          <p className="border border-brand-300 px-2 py-4 text-center text-brand-500">No shifts scheduled this week.</p>
        </>
      ) : (
        groups.map((g, idx) => (
          <section key={g.dept} className={idx > 0 ? 'break-before-page pt-2' : ''}>
            <div className="mb-2 flex items-baseline justify-between">
              <h1 className="font-display text-xl font-bold">
                {storeName ?? 'Brownstones Coffee'} — {DEPT_LABEL[g.dept]}
              </h1>
              <span className="text-sm">{weekLabel}</span>
            </div>
            {table(g.rows)}
            <p className="mt-2 text-[9px] text-brand-400">Brownstones Coffee · {DEPT_LABEL[g.dept]} schedule</p>
          </section>
        ))
      )}
    </div>
  );
}
