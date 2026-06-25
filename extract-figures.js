// api/extract-figures.js — CommonJS for Vercel compatibility
const GEMINI_MODEL = 'gemini-1.5-flash';

const SYSTEM_PROMPT =
  'You are a Big Four audit senior. Extract these financial line items for current year and prior year from the uploaded statement: ' +
  'revenue from operations, cost of goods sold, finance cost, net profit after tax, total current assets, inventory, trade receivables, total current liabilities, total equity. ' +
  'Respond ONLY with minified JSON, no markdown, no commentary, in exactly this shape: ' +
  '{"revenue":{"cy":number|null,"py":number|null},"cogs":{"cy":number|null,"py":number|null},' +
  '"financeCost":{"cy":number|null,"py":number|null},"netProfit":{"cy":number|null,"py":number|null},' +
  '"currentAssets":{"cy":number|null,"py":number|null},"inventory":{"cy":number|null,"py":number|null},' +
  '"receivables":{"cy":number|null,"py":number|null},"currentLiabilities":{"cy":number|null,"py":number|null},' +
  '"totalEquity":{"cy":number|null,"py":number|null}}. Use null where not found. Plain numbers only.';

async function callGemini(apiKey, parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: 1000, temperature: 0.1 }
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    const e = new Error(`Gemini error ${res.status}`);
    e.status = res.status; e.detail = t; throw e;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');
  return text;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server.' });

  const { base64, mediaType } = req.body || {};
  if (!base64 || !mediaType) return res.status(400).json({ error: 'Missing base64 or mediaType.' });

  const parts = [
    { inline_data: { mime_type: mediaType, data: base64 } },
    { text: 'Extract the financial figures.' }
  ];

  let lastError;
  for (let i = 0; i < 3; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    try {
      const text = await callGemini(apiKey, parts);
      return res.status(200).json({ text });
    } catch (err) {
      lastError = err;
      if (err.status && err.status !== 429 && err.status < 500) break;
    }
  }
  return res.status(lastError?.status === 429 ? 429 : 502).json({ error: lastError?.message || 'Failed to extract figures.' });
};
