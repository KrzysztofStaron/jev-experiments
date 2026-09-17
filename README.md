# jev-experiments

Experiments with **TypeSafe Jev** via Vercel AI Gateway (`typesafe-ai/jev`).

This repository demonstrates Jev's relevance filtering capabilities through two main experiments:

1. **Toy memory experiment** – Simple smoke test for Jev integration
2. **LongMemEval benchmark** – Official long-context memory benchmark comparing Base LLM vs Base+Jev

## What is Jev?

Jev is a relevance evaluation model that can filter large context windows to keep only relevant information. This is useful for:
- Reducing token costs in long-context applications
- Improving response quality by removing noise
- Enabling efficient retrieval-augmented generation (RAG)

## What is LongMemEval?

**LongMemEval** is an official benchmark for evaluating long-context memory in conversational AI systems.

- **Paper & Code**: https://github.com/xiaowu0162/LongMemEval
- **Dataset**: [xiaowu0162/longmemeval-cleaned](https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned) on Hugging Face
- **Task**: Answer questions based on information scattered across ~40 conversation sessions (~115k tokens)
- **Splits**:
  - `s` (standard): Full haystack with ~40 sessions, some irrelevant
  - `oracle`: Evidence-only sessions for sanity checking

### Why LongMemEval?

It tests whether a system can:
1. Find relevant information in very long conversation histories
2. Ignore irrelevant distractors
3. Synthesize answers from scattered evidence

**Base+Jev** uses Jev to filter sessions before the base LLM answers, reducing tokens while maintaining or improving accuracy.

## Setup

### Prerequisites

- Node.js ≥20
- pnpm (or npm)
- Vercel AI Gateway API key with access to `typesafe-ai/jev`

### Installation

```bash
pnpm install
```

### Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Add your Vercel AI Gateway API key:
   ```env
   AI_GATEWAY_API_KEY=your_key_here
   ```

3. (Optional) Override default models:
   ```env
   BASE_MODEL=gpt-4o-mini
   JEV_MODEL=typesafe-ai/jev
   ```

## Experiments

### 1. Toy Memory Experiment (Smoke Test)

Quick smoke test to verify Jev integration works:

```bash
pnpm exp:memory
```

This runs a simple 4-session example and shows which sessions Jev considers relevant.

**Without API key**: Prints mock results  
**With API key**: Makes live Jev evaluation call

### 2. LongMemEval Benchmark

Official long-context memory benchmark comparing Base LLM vs Base+Jev.

## Dataset

### Data Already on Machine

The LongMemEval dataset is **already on your machine**:
- **Windows**: `C:\Users\kisie\Documents\jev-experiments\data\longmemeval_s_cleaned.json` (~277MB)
- **Expected path**: `/workspace/data/longmemeval_s_cleaned.json`

**To use the data**:

On **Windows** (recommended - symlink):
```powershell
# From project root
New-Item -ItemType SymbolicLink -Path "data\longmemeval_s_cleaned.json" -Target "C:\Users\kisie\Documents\jev-experiments\data\longmemeval_s_cleaned.json"
```

Or **copy** (if symlink doesn't work):
```bash
# Create data directory
mkdir -p data

# Copy the file
cp "C:\Users\kisie\Documents\jev-experiments\data\longmemeval_s_cleaned.json" data/
```

On **Linux/Mac**:
```bash
mkdir -p data
ln -s ~/path/to/longmemeval_s_cleaned.json data/longmemeval_s_cleaned.json
```

### Dataset Schema

Each instance contains:
- `question_id`, `question_type`, `question`, `question_date`, `answer`
- `answer_session_ids`: Ground truth relevant session IDs
- `haystack_session_ids`: All session IDs in haystack
- `haystack_sessions`: Array of sessions (each session = array of `{role, content}` messages)

Example: `question_type=single-session-user`, ~53 sessions in haystack, question="What degree did I graduate with?", answer="Business Administration"

**Note**: `answer_session_ids` are used only for measuring filter recall (not as input to Jev).

#### Run the Benchmark

#### Run the Benchmark

**Mock mode** (uses 2 small fixture instances, requires API key):
```bash
pnpm exec tsx src/experiments/memory-longmemeval.ts --mock
```

**Live evaluation** (20 instances, ~$2, good for testing):
```bash
pnpm exec tsx src/experiments/memory-longmemeval.ts --limit 20
```

**Specific range**:
```bash
pnpm exec tsx src/experiments/memory-longmemeval.ts --limit 5 --offset 10
```

**Full benchmark** (⚠️ expensive, ~$50-100):
```bash
pnpm exec tsx src/experiments/memory-longmemeval.ts --limit 500
```

#### CLI Options

```bash
pnpm exec tsx src/experiments/memory-longmemeval.ts [options]

Options:
  --limit <n>      Number of instances to evaluate (default: 20)
  --offset <n>     Start offset (default: 0)
  --split <s>      Dataset split: s or oracle (default: s)
  --mock           Use mock fixture data (still requires API key)
```

#### Expected Results

The benchmark compares two approaches:

| Approach | Description |
|----------|-------------|
| **Baseline** | Full conversation history passed to LLM |
| **Base+Jev** | Jev filters relevant sessions → LLM answers on subset |

#### Expected Results

The benchmark compares two approaches and tracks filter quality:

| Approach | Description |
|----------|-------------|
| **Baseline** | Full conversation history passed to LLM |
| **Base+Jev** | Jev filters relevant sessions → LLM answers on subset |

**Sample output**:

```
📊 Results Summary

┌─────────────────────┬──────────────┬──────────────┐
│ Metric              │ Baseline     │ Base+Jev     │
├─────────────────────┼──────────────┼──────────────┤
│ Accuracy            │        85.0% │        87.5% │
│ Avg Tokens          │        28000 │         7500 │
│ Avg Latency (ms)    │         4500 │         2800 │
│ Avg Keep Rate       │            - │        26.8% │
│ Filter Recall       │            - │        94.2% │
└─────────────────────┴──────────────┴──────────────┘

💡 Token savings: 73.2%
```

**Filter Recall**: % of ground-truth answer sessions that Jev kept (measured via `answer_session_ids`).

Results are saved to `evals/longmemeval-results.jsonl` with per-instance details including:
- `filterRecall`: Recall of answer sessions
- `answerSessionsFound` / `answerSessionsTotal`: How many gold sessions were kept
- Full predictions and correctness

### Cost Warnings

**LongMemEval is expensive to run at scale**:
- Each instance processes ~115k tokens (input) + answer generation
- Jev evaluation adds additional API calls
- **Estimated costs** (gpt-4o-mini pricing):
  - 5 instances: ~$0.50
  - 20 instances: ~$2
  - 100 instances: ~$10
  - 500 instances: ~$50-100

**Recommendations**:
1. Start with `--mock` to test the pipeline
2. Run `--limit 5` for quick validation
3. Use `--limit 20` (default) for representative results
4. Only run full benchmark if you understand the costs

## Project Structure

```
jev-experiments/
├── src/
│   ├── lib/
│   │   ├── gateway.ts           # Vercel AI Gateway setup
│   │   └── jev.ts                # Jev evaluation API wrapper
│   └── experiments/
│       ├── memory-toy.ts         # Simple smoke test
│       └── memory-longmemeval.ts # LongMemEval benchmark
├── scripts/
│   └── download-longmemeval.ts   # HuggingFace dataset downloader
├── fixtures/
│   └── longmemeval/              # Mock data for testing
├── data/
│   └── longmemeval/              # Downloaded datasets (gitignored)
├── evals/                        # Evaluation results (gitignored)
└── README.md
```

## How Jev Integration Works

This repo uses the **correct** Jev API pattern with AI SDK's `experimental_evaluate`:

```typescript
import { experimental_evaluate as evaluate } from "ai";

const result = await evaluate({
  model: "typesafe-ai/jev",
  state: "Question: ...\n\nEvaluate which sessions are relevant.",
  questions: {
    s0: { type: "boolean", instructions: "Is session 0 relevant?" },
    s1: { type: "boolean", instructions: "Is session 1 relevant?" },
    // ... batch up to ~512-1024 questions per call
  },
});
```

**Key points**:
- Use `experimental_evaluate`, **not** `generateObject`
- `state` contains the query and instructions
- `questions` maps session IDs to relevance questions (boolean)
- Can batch many sessions in one call (tested with 512-1024)
- Returns probability per question; threshold at 0.5 for keep/discard

**Session filtering**:
1. Convert each haystack session (array of `{role, content}`) to text
2. Ask Jev: "Is session N relevant to answering the question?"
3. Keep sessions with probability ≥ 0.5
4. Measure filter recall against `answer_session_ids` (not used as input!)

See [`src/lib/jev.ts`](src/lib/jev.ts) for the implementation.

## Development

```bash
# Type check
pnpm typecheck

# Run experiments
pnpm exp:memory              # Toy smoke test
pnpm exp:memory:longmemeval  # LongMemEval benchmark

# Download dataset
pnpm download:longmemeval
```

## References

- **LongMemEval Paper**: https://github.com/xiaowu0162/LongMemEval
- **Dataset**: https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned
- **Vercel AI SDK**: https://sdk.vercel.ai/docs
- **TypeSafe Jev**: https://typesafe.ai

## License

MIT
