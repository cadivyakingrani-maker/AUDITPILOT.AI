// api/generate-insights.js — CommonJS for Vercel compatibility
const GEMINI_MODEL = 'gemini-1.5-flash';

const SYSTEM_PROMPT =
  'You are a Big Four audit senior assisting with preliminary analytical procedures and working paper drafting. ' +
  'You will be given financial figures, computed ratios, and variances. Do not recompute the arithmetic. ' +
  'Respond ONLY with minified JSON, no markdown, no preamble, in exactly this shape: ' +
  '{"executiveSummary":string,"varianceCommentary":[{"item":string,"commentary":string}],' +
  '"riskAreas":[{"title":string,"reason":string,"procedure":string}],' +
  '"workingPaper":[{"riskArea":string,"objective":string,"procedurePerformed":string,"observation":string,"conclusion":string}]}. ' +
  'executiveSummary: 2-3 sentences of plain prose. varianceCommentary: up to 5 items, one short sentence each. ' +
  'riskAreas: 3-4 entries from evidence in the data only. workingPaper: one entry per riskArea, riskArea must match title exactly. ' +
  'procedurePerformed: describe only preliminary analytical work, never physical inspection or substantive testing. ' +
  'conclusion: state area warrants further attention, never give a final audit opinion. Every string under 30 words.';

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1000, temperature: 0.2 }
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

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing prompt.' });

  let lastError;
  for (let i = 0; i < 3; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    try {
      const text = await callGemini(apiKey, prompt);
      return res.status(200).json({ text });
    } catch (err) {
      lastError = err;
      if (err.status && err.status !== 429 && err.status < 500) break;
    }
  }
  return res.status(lastError?.status === 429 ? 429 : 502).json({ error: lastError?.message || 'Failed to generate insights.' });
};
