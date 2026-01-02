import Card from '../common/Card';
import { useEffect, useState } from 'react';

interface LivePriceCardProps {
  ticker: string;
  price: number | null;
  lastUpdate: string | null;
  latestHistoricalPrice?: number | null;
}

export default function LivePriceCard({ ticker, price, lastUpdate, latestHistoricalPrice }: LivePriceCardProps) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (price) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 500);
      return () => clearTimeout(timer);
    }
  }, [price]);

  const changeFromHistorical = price && latestHistoricalPrice ? price - latestHistoricalPrice : null;
  const changePercent = changeFromHistorical && latestHistoricalPrice 
    ? (changeFromHistorical / latestHistoricalPrice) * 100 
    : null;

  return (
    <Card
      style={{
        background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.15), rgba(34, 197, 94, 0.05))',
        border: '1px solid rgba(74, 222, 128, 0.3)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated pulse effect */}
      {pulse && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(74, 222, 128, 0.2)',
            animation: 'pulse 0.5s ease-out',
            pointerEvents: 'none',
          }}
        />
      )}
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4ade80',
            boxShadow: '0 0 8px rgba(74, 222, 128, 0.6)',
            animation: 'blink 2s infinite',
          }}
        />
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#4ade80' }}>LIVE PRICE</span>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{ticker}</p>
          <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
            ${price?.toFixed(2) ?? '--'}
          </h3>
          {changeFromHistorical && changePercent && (
            <p
              className={changeFromHistorical >= 0 ? 'price-up' : 'price-down'}
              style={{ fontSize: '13px', marginTop: '4px' }}
            >
              {changeFromHistorical >= 0 ? '+' : ''}${changeFromHistorical.toFixed(2)} ({changePercent.toFixed(2)}%)
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'Now'}
          </p>
          <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Updated {lastUpdate ? Math.round((Date.now() - new Date(lastUpdate).getTime()) / 1000) : 0}s ago
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.05); }
        }
      `}</style>
    </Card>
  );
}
