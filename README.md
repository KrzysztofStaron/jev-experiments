# jev-experiments

TypeSafe Jev experiments via Vercel AI Gateway (typesafe-ai/jev).

1. Pixel B&W / gray images by scoring intensity per pixel
2. Long-context relevance filter bench (Base LLM vs Base+Jev)

## Experiment 2: Memory / Long-Context Relevance Filter

Benchmarks two pipelines for question-answering over long documents:

- **Base**: Full text → LLM → answer
- **Base+Jev**: Each line → Jev Boolean filter → relevant lines → LLM → answer

### Setup

```bash
pnpm install
export AI_GATEWAY_API_KEY=your_key_here
```

### Run

```bash
# Mock mode (no API calls)
pnpm exp:memory --mock
# or
JEV_MOCK=1 pnpm exp:memory

# Live mode (requires AI_GATEWAY_API_KEY)
pnpm exp:memory
```

### Metrics

- **Accuracy**: Correct answers / Total questions
- **Avg Tokens**: Average tokens per question (input + output)
- **Avg Latency**: Average milliseconds per question
- **Keep Rate**: % of lines retained after Jev filtering (Base+Jev only)
- **Cost Estimate**: Estimated API cost based on token usage

Results are appended to `evals/memory-bench.jsonl`.
