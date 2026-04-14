interface TablePanelProps {
  title: string;
  children: React.ReactNode;
}

export function TablePanel({ title, children }: TablePanelProps) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        padding: '0.9rem',
        boxShadow: '0 1px 8px rgba(0,0,0,0.15)',
        border: '1px solid rgba(255,255,255,0.04)',
        maxWidth: '340px',
      }}
    >
      <div
        style={{
          fontSize: '0.6rem',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          color: 'rgba(255,255,255,0.3)',
          fontWeight: 600,
          marginBottom: '0.6rem',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
