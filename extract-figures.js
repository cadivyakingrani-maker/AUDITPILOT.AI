// api/extract-figures.js
// Vercel Serverless Function — calls Google Gemini (free tier).
// Accepts { base64, mediaType } and returns extracted financial figures as JSON string.

const GEMINI_MODEL = 'gemini-1.5-flash';

const EXTRACT_SYSTEM_PROMPT =
  'You are a Big Four audit senior assisting with preliminary analytical procedures. ' +
  'Extract the following financial line items for the current year (most recent) and the immediately preceding prior year ' +
  'from the uploaded financial statement: revenue from operations, cost of goods sold, finance cost, net profit after tax, ' +
  'total current assets, inventory, trade receivables, total current liabilities, total equity. ' +
  'Respond ONLY with minified JSON, no markdown, no commentary, no preamble, in exactly this shape: ' +
  '{"revenue":{"cy":number|null,"py":number|null},"cogs":{"cy":number|null,"py":number|null},' +
  '"financeCost":{"cy":number|null,"py":number|null},"netProfit":{"cy":number|null,"py":number|null},' +
  '"currentAssets":{"cy":number|null,"py":number|null},"inventory":{"cy":number|null,"py":number|null},' +
  '"receivables":{"cy":number|null,"py":number|null},"currentLiabilities":{"cy":number|null,"py":number|null},' +
  '"totalEquity":{"cy":number|null,"py":number|null}}. ' +
  'Use null where a figure cannot be found. Use plain numbers without currency symbols or thousand separators.';

async function callGemini(apiKey, parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: EXTRACT_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: 1000, temperature: 0.1 }
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(`Gemini API error ${res.status}`);
    err.status = res.status;
    err.detail = errText;
    throw err;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No text content in Gemini response.');
  return text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set.' });

  const { base64, mediaType } = req.body || {};
  if (!base64 || !mediaType) return res.status(400).json({ error: 'Missing base64 or mediaType.' });

  // Build Gemini parts — supports PDF and images
  const filePart = { inline_data: { mime_type: mediaType, data: base64 } };
  const parts = [filePart, { text: 'Extract the financial figures.' }];

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    try {
      const text = await callGemini(apiKey, parts);
      return res.status(200).json({ text });
    } catch (err) {
      lastError = err;
      if (err.status && err.status !== 429 && err.status < 500) break;
    }
  }

  const status = lastError?.status === 429 ? 429 : 502;
  return res.status(status).json({ error: lastError?.message || 'Failed to extract figures.' });
}
