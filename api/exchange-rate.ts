/**
 * GET /api/exchange-rate
 * Returns USD to KRW rate (KRW per 1 USD). Used for admin cost display.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Exchange rate fetch failed');
    const data = await response.json();
    const krwPerUsd = typeof data?.rates?.KRW === 'number' ? data.rates.KRW : 1350;
    return res.status(200).json({ krwPerUsd });
  } catch (e) {
    console.error('exchange-rate error:', e);
    return res.status(200).json({ krwPerUsd: 1350 });
  }
}
