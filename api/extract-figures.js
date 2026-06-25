export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const GEMINI_API_KEY = 'AQ.Ab8RN6LcImRtwEkqKlQWdyB9cUhqW81zAs1c_frymdJ1vAsbNQ';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;

  const system = 'You are a Big Four audit senior. Extract these financial line items for current year and prior year from the uploaded statement: revenue from operations, cost of goods sold, finance cost, net profit after tax, total current assets, inventory, trade receivables, total current liabilities, total equity. Respond ONLY with minified JSON, no markdown, no commentary, in exactly this shape: {"revenue":{"cy":number|null,"py":number|null},"cogs":{"cy":number|null,"py":number|null},"financeCost":{"cy":number|null,"py":number|null},"netProfit":{"cy":number|null,"py":number|null},"currentAssets":{"cy":number|null,"py":number|null},"inventory":{"cy":number|null,"py":number|null},"receivables":{"cy":number|null,"py":number|null},"currentLiabilities":{"cy":number|null,"py":number|null},"totalEquity":{"cy":number|null,"py":number|null}}. Use null where not found. Plain numbers only.';

  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: req.body.mediaType, data: req.body.base64 } },
        { text: 'Extract the financial figures.' }
      ]
    }],
    generationConfig: { maxOutputTokens: 2000, temperature: 0.2 }
  };

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify(body)
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}
