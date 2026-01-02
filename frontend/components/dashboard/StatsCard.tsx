interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: string;
}

export default function StatsCard({ title, value, change, isPositive, icon }: StatsCardProps) {
  return (
    <div className="glass-card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>{icon}</div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
        {title}
      </p>
      <h3 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
        {value}
      </h3>
      <p className={isPositive ? 'price-up' : 'price-down'} style={{ fontSize: '14px' }}>
        {isPositive ? '↑' : '↓'} {change}
      </p>
    </div>
  );
}
