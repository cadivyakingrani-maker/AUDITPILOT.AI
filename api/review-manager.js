export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const GEMINI_API_KEY = 'AQ.Ab8RN6LcImRtwEkqKlQWdyB9cUhqW81zAs1c_frymdJ1vAsbNQ';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;

  const system = 'You are an audit manager reviewing a senior\'s preliminary working paper draft, in the style of a real engagement-file review note. You will be given the working paper draft as JSON. Respond ONLY with minified JSON, no markdown, no preamble, in exactly this shape: {"comments":[{"refersTo":string,"field":string,"comment":string}]}. refersTo must exactly match one of the riskArea values given, or be the literal string "general". field must be one of "objective","procedurePerformed","observation","conclusion","general". comment is one short, specific, constructive review query a real audit manager would mark up. Produce 3 to 5 comments total, each under 25 words.';

  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: 'Working paper draft to review:\n' + JSON.stringify(req.body.workingPaper) }] }],
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
