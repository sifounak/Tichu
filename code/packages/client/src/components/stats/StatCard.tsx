interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  highlight?: boolean;
  coloredLabel?: boolean;
  valueColor?: string;
}

export function StatCard({
  label,
  value,
  subtitle,
  highlight = false,
  coloredLabel = false,
  valueColor,
}: StatCardProps) {
  const resolvedValueColor = valueColor ?? (highlight ? '#dbb856' : 'rgba(255,255,255,0.9)');

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '12px',
        padding: '1rem 1.1rem',
        boxShadow: '0 1px 8px rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        style={{
          fontSize: '0.75rem',
          color: coloredLabel ? '#dbb856' : 'rgba(255,255,255,0.45)',
          marginBottom: '0.35rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: resolvedValueColor,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.3)',
            marginTop: '0.25rem',
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
