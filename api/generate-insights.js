export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  const GEMINI_API_KEY = 'AQ.Ab8RN6LcImRtwEkqKlQWdyB9cUhqW81zAs1c_frymdJ1vAsbNQ';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  const system = 'You are a Big Four audit senior assisting with preliminary analytical procedures and working paper drafting for a statutory audit engagement. You will be given the client\'s key financial figures, computed financial ratios, and computed year-on-year variances — all already calculated, so do not recompute or restate the arithmetic. Using concise, professional audit language, respond ONLY with minified JSON, no markdown, no preamble, in exactly this shape: {"executiveSummary":string,"varianceCommentary":[{"item":string,"commentary":string}],"riskAreas":[{"title":string,"reason":string,"procedure":string}],"workingPaper":[{"riskArea":string,"objective":string,"procedurePerformed":string,"observation":string,"conclusion":string}]}. Rules: executiveSummary is 2-3 sentences of plain prose. varianceCommentary covers up to 5 of the variances given, one short sentence each. riskAreas has 3 to 4 entries. workingPaper has exactly one entry per riskArea. Keep every string under 30 words.';

  const geminiBody = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: body.prompt }] }],
    generationConfig: { maxOutputTokens: 4000, temperature: 0.2 }
  };

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify(geminiBody)
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}
