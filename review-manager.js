// api/review-manager.js — CommonJS for Vercel compatibility
const GEMINI_MODEL = 'gemini-1.5-flash';

const SYSTEM_PROMPT =
  'You are an audit manager reviewing a senior\'s preliminary working paper draft. ' +
  'Respond ONLY with minified JSON, no markdown, no preamble, in exactly this shape: ' +
  '{"comments":[{"refersTo":string,"field":string,"comment":string}]}. ' +
  'refersTo must exactly match a riskArea value given, or be "general". ' +
  'field must be one of: "objective","procedurePerformed","observation","conclusion","general". ' +
  'comment: one short constructive review query under 25 words. Produce 3 to 5 comments total.';

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

  const { workingPaper } = req.body || {};
  if (!workingPaper || !Array.isArray(workingPaper)) return res.status(400).json({ error: 'Missing workingPaper array.' });

  const prompt = 'Working paper draft to review:\n' + JSON.stringify(workingPaper);

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
  return res.status(lastError?.status === 429 ? 429 : 502).json({ error: lastError?.message || 'Failed to generate review.' });
};
