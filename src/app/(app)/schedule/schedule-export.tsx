'use client';

import { Printer, Download } from 'lucide-react';

export type ExportRow = { date: string; time: string; hours: string; who: string; role: string; cost: string };

export function ScheduleExport({ rows, title }: { rows: ExportRow[]; title: string }) {
  const csv = () => {
    const header = ['Date', 'Time', 'Hours', 'Employee', 'Role', 'Labor cost'];
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [header, ...rows.map((r) => [r.date, r.time, r.hours, r.who, r.role, r.cost])]
      .map((cols) => cols.map((c) => escape(String(c ?? ''))).join(','))
      .join('\n');
    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="no-print flex gap-2">
      <button onClick={() => window.print()} className="btn-secondary h-9 flex-1 justify-center text-xs">
        <Printer size={14} /> Print
      </button>
      <button onClick={csv} disabled={rows.length === 0} className="btn-secondary h-9 flex-1 justify-center text-xs">
        <Download size={14} /> Export CSV
      </button>
    </div>
  );
}
