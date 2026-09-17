export default function FleetTable({ rows, total, columns, sort, onSort, sourceName }) {
  const shown = columns.filter((c) => c.on);

  return (
    <div className="card">
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              {shown.map((c) => (
                <th key={c.key} onClick={() => onSort(c.key)} className={sort.key === c.key ? 'sorted' : ''}>
                  {c.title}{sort.key === c.key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.driverId || d.driverName} className={d.violations.length ? 'flagged' : ''}>
                {shown.map((c) => <td key={c.key}>{c.cell ? c.cell(d) : d[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!rows.length && (
        <div className="blank">
          <div className="h">No matching drivers</div>
          <div>Try a different search term or clear the status filter.</div>
        </div>
      )}

      <div className="foot">
        <span>Showing {rows.length} of {total} drivers</span>
        <span>Source: {sourceName}</span>
      </div>
    </div>
  );
}
