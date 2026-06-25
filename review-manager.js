// api/review-manager.js
// Vercel Serverless Function — calls Google Gemini (free tier).

const GEMINI_MODEL = 'gemini-1.5-flash';

const MANAGER_SYSTEM_PROMPT =
  'You are an audit manager reviewing a senior\'s preliminary working paper draft, in the style of a real engagement-file review note. ' +
  'You will be given the working paper draft as JSON. Respond ONLY with minified JSON, no markdown, no preamble, in exactly this shape: ' +
  '{"comments":[{"refersTo":string,"field":string,"comment":string}]}. ' +
  'refersTo must exactly match one of the riskArea values given, or be the literal string "general". ' +
  'field must be one of "objective","procedurePerformed","observation","conclusion","general". ' +
  'comment is one short, specific, constructive review query a real audit manager would mark up — ' +
  'e.g. a missing cross-reference, a gap in evidence, or an unclear conclusion. ' +
  'Produce 3 to 5 comments total, each under 25 words.';

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: MANAGER_SYSTEM_PROMPT }] },
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

  const { workingPaper } = req.body || {};
  if (!workingPaper || !Array.isArray(workingPaper)) return res.status(400).json({ error: 'Missing workingPaper array.' });

  const prompt = 'Working paper draft to review:\n' + JSON.stringify(workingPaper);

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
  return res.status(status).json({ error: lastError?.message || 'Failed to generate manager review.' });
}
