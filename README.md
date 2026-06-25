# AuditPilot AI

An AI-assisted preliminary analytical review tool for Chartered Accountants and audit teams.

## Architecture

```
auditpilot/
├── public/
│   └── index.html          # Frontend — UI only, no API keys
├── api/
│   ├── extract-figures.js  # POST /api/extract-figures
│   ├── generate-insights.js# POST /api/generate-insights
│   └── review-manager.js   # POST /api/review-manager
├── vercel.json
├── package.json
└── .env.example
```

The Anthropic API key **never** reaches the browser. All Claude calls happen inside Vercel Serverless Functions with automatic retry on 429/5xx.

## Deploy to Vercel (one-time setup)

1. **Fork / clone** this repo and push to GitHub.
2. In [Vercel](https://vercel.com), click **Add New Project** → import your repo.
3. In **Project Settings → Environment Variables**, add:
   ```
   ANTHROPIC_API_KEY = sk-ant-xxxxxxxxxxxxxxxx
   ```
4. Click **Deploy**. Done.

## Local development

```bash
npm install -g vercel   # install Vercel CLI once
cp .env.example .env.local
# edit .env.local and paste your real API key

vercel dev              # starts local server at http://localhost:3000
```

> **Never** commit `.env.local` — it's listed in `.gitignore` by default.

## API endpoints

| Endpoint | Body | Returns |
|---|---|---|
| `POST /api/extract-figures` | `{ base64: string, mediaType: string }` | `{ text: string }` (JSON) |
| `POST /api/generate-insights` | `{ prompt: string }` | `{ text: string }` (JSON) |
| `POST /api/review-manager` | `{ workingPaper: array }` | `{ text: string }` (JSON) |

All endpoints retry up to 3× with exponential back-off on 429 / 5xx errors.

## Disclaimer

AuditPilot AI assists in preparing **preliminary** analytical procedures and documentation. Final audit procedures, conclusions, and professional judgment remain the responsibility of the engagement team.
