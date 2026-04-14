interface CompactTableProps {
  rows: Array<{ label: string; value: string | number }>;
  headers?: [string, string];
}

export function CompactTable({ rows, headers }: CompactTableProps) {
  return (
    <table
      style={{
        width: '100%',
        maxWidth: '340px',
        fontSize: '0.85rem',
        borderCollapse: 'collapse',
      }}
    >
      {headers && (
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: '0.3rem 0.5rem',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'rgba(255,255,255,0.3)',
                fontWeight: 600,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {headers[0]}
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '0.3rem 0.5rem',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'rgba(255,255,255,0.3)',
                fontWeight: 600,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {headers[1]}
            </th>
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map(({ label, value }, i) => (
          <tr
            key={i}
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <td
              style={{
                textAlign: 'left',
                padding: '0.4rem 0.5rem',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              {label}
            </td>
            <td
              style={{
                textAlign: 'right',
                padding: '0.4rem 0.5rem',
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 700,
              }}
            >
              {value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
