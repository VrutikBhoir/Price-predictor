import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1m&range=1d'
    );
    const data = await response.json();

    if (
      data &&
      data.chart &&
      data.chart.result &&
      data.chart.result.length > 0
    ) {
      const result = data.chart.result[0];
      const meta = result.meta;
      const timestamps = result.timestamp;
      const closes = result.indicators.quote[0].close;
      const highs = result.indicators.quote[0].high;
      const lows = result.indicators.quote[0].low;
      const volumes = result.indicators.quote[0].volume;

      const latestIndex = closes.length - 1;

      return res.status(200).json({
        symbol: meta.symbol,
        latestPrice: closes[latestIndex],
        high: highs[latestIndex],
        low: lows[latestIndex],
        volume: volumes[latestIndex],
        time: new Date(timestamps[latestIndex] * 1000).toLocaleString(),
      });
    }

    res.status(500).json({ error: 'Invalid data format from Yahoo Finance' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
}
