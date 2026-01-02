interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export default function StockTable() {
  const stocks: Stock[] = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 178.50, change: 2.30, changePercent: 1.31 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 142.80, change: -1.20, changePercent: -0.83 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', price: 412.20, change: 5.10, changePercent: 1.25 },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 245.60, change: -3.50, changePercent: -1.40 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.90, change: 1.80, changePercent: 1.02 },
  ];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '16px', textAlign: 'left', color: 'var(--text-secondary)' }}>Symbol</th>
            <th style={{ padding: '16px', textAlign: 'left', color: 'var(--text-secondary)' }}>Name</th>
            <th style={{ padding: '16px', textAlign: 'right', color: 'var(--text-secondary)' }}>Price</th>
            <th style={{ padding: '16px', textAlign: 'right', color: 'var(--text-secondary)' }}>Change</th>
            <th style={{ padding: '16px', textAlign: 'right', color: 'var(--text-secondary)' }}>Change %</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => (
            <tr
              key={stock.symbol}
              style={{
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-elevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '16px', fontWeight: '600' }}>{stock.symbol}</td>
              <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{stock.name}</td>
              <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600' }}>
                ${stock.price.toFixed(2)}
              </td>
              <td
                style={{ padding: '16px', textAlign: 'right' }}
                className={stock.change >= 0 ? 'price-up' : 'price-down'}
              >
                {stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}
              </td>
              <td
                style={{ padding: '16px', textAlign: 'right' }}
                className={stock.changePercent >= 0 ? 'price-up' : 'price-down'}
              >
                {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
