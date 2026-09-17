/** Jadval uchun umumiy amallar — ikkala sahifa ham shulardan foydalanadi. */

export function filterRows(drivers, { query = '', status = 'all', match = null } = {}) {
  const q = query.trim().toLowerCase();
  return drivers
    .filter((d) => (match ? match(d) : true))
    .filter((d) => status === 'all' || d.status === status)
    .filter((d) => !q || [d.driverName, d.truck, d.location, d.driverId]
      .some((v) => String(v).toLowerCase().includes(q)));
}

export function sortRows(rows, { key, dir }) {
  return [...rows].sort((a, b) => {
    const [x, y] = [a[key], b[key]];
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
  });
}

export function toCsv(rows, columns, filename) {
  const shown = columns.filter((c) => c.on);
  const head = shown.map((c) => c.title).join(',');
  const body = rows.map((d) => shown.map((c) => {
    const v = c.key === 'violations' ? d.violations.join('; ') : d[c.key];
    return `"${String(v ?? '').replace(/"/g, '""')}"`;
  }).join(',')).join('\n');

  const url = URL.createObjectURL(new Blob([head + '\n' + body], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
