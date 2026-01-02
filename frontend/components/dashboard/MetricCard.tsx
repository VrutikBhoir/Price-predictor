import Card from '../common/Card';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon?: string;
  subtitle?: string;
}

export default function MetricCard({ title, value, change, isPositive, icon, subtitle }: MetricCardProps) {
  return (
    <Card hover={true} style={{ textAlign: 'center' }}>
      {icon && <div style={{ fontSize: '36px', marginBottom: '12px' }}>{icon}</div>}
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
        {title}
      </p>
      <h3 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>
        {value}
      </h3>
      {change && (
        <p className={isPositive ? 'price-up' : 'price-down'} style={{ fontSize: '14px', fontWeight: '600' }}>
          {isPositive ? '↑' : '↓'} {change}
        </p>
      )}
      {subtitle && (
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          {subtitle}
        </p>
      )}
    </Card>
  );
}
