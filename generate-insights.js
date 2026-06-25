// api/generate-insights.js
// Vercel Serverless Function — calls Google Gemini (free tier).

const GEMINI_MODEL = 'gemini-1.5-flash';

const INSIGHTS_SYSTEM_PROMPT =
  'You are a Big Four audit senior assisting with preliminary analytical procedures and working paper drafting for a statutory audit engagement. ' +
  'You will be given the client\'s key financial figures, computed financial ratios, and computed year-on-year variances — all already calculated, ' +
  'so do not recompute or restate the arithmetic. Using concise, professional audit language, respond ONLY with minified JSON, no markdown, no preamble, in exactly this shape: ' +
  '{"executiveSummary":string,"varianceCommentary":[{"item":string,"commentary":string}],' +
  '"riskAreas":[{"title":string,"reason":string,"procedure":string}],' +
  '"workingPaper":[{"riskArea":string,"objective":string,"procedurePerformed":string,"observation":string,"conclusion":string}]}. ' +
  'Rules: executiveSummary is 2-3 sentences of plain prose. varianceCommentary covers up to 5 of the variances given, one short sentence each. ' +
  'riskAreas has 3 to 4 entries, drawn only from patterns evidenced in the figures/variances given. ' +
  'workingPaper has exactly one entry per riskArea, with riskArea matching a riskAreas title exactly. ' +
  'In workingPaper, procedurePerformed must describe only preliminary analytical work — never claim physical inspection or substantive testing was performed. ' +
  'conclusion must state the area warrants further audit attention and must never state a final audit opinion. ' +
  'Keep every string under 30 words.';

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: INSIGHTS_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1000, temperature: 0.2 }
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

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing prompt string.' });

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    try {
      const text = await callGemini(apiKey, prompt);
      return res.status(200).json({ text });
    } catch (err) {
      lastError = err;
      if (err.status && err.status !== 429 && err.status < 500) break;
    }
  }

  const status = lastError?.status === 429 ? 429 : 502;
  return res.status(status).json({ error: lastError?.message || 'Failed to generate insights.' });
}
