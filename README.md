# jev-experiments

TypeSafe Jev experiments via Vercel AI Gateway (`typesafe-ai/jev`).

1. **Pixel image** — Score gray levels / B&W per pixel → PNG
2. **Memory filter** — Jev relevance filter → LLM vs base LLM

## Setup

```bash
pnpm install
# PowerShell: load Gateway key
Get-Content $env:USERPROFILE\.vercel-ai-gateway.env | ForEach-Object { if ($_ -match '^AI_GATEWAY_API_KEY=(.+)$') { $env:AI_GATEWAY_API_KEY=$Matches[1] } }
```

## Experiment 1 — Pixel

```bash
pnpm exp:image --mock --prompt "white circle on black" --size 16
pnpm exp:image --prompt "white circle on black" --size 16
```

## Experiment 2 — Memory

```bash
pnpm exp:memory --mock
pnpm exp:memory
```
