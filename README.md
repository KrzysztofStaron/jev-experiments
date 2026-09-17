# jev-experiments

TypeSafe Jev experiments via Vercel AI Gateway (`typesafe-ai/jev`).

## Setup

```bash
# Install dependencies
pnpm install

# Configure API key
cp .env.example .env
# Edit .env and add your AI_GATEWAY_API_KEY from Vercel AI Gateway
```

### Environment Variables

- **`AI_GATEWAY_API_KEY`** (required for live mode): Obtain from [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)
- **`JEV_MOCK=1`** (optional): Run in mock mode without API keys for CI/testing

## Experiment 1: Pixel B&W/Grayscale Images

Generate simple images pixel-by-pixel using TypeSafe Jev to decide each pixel's intensity.

### Quick Start

```bash
# Generate a 32x32 image
pnpm exp:image --prompt "a white circle on black" --size 32

# Binary mode (black/white only)
pnpm exp:image --prompt "diagonal stripes" --size 24 --mode binary

# Mock mode (no API key needed)
pnpm exp:image --prompt "test pattern" --size 16 --mock

# Or via environment
JEV_MOCK=1 pnpm exp:image --prompt "test" --size 16
```

### Options

- `--prompt <text>`: Image description (required)
- `--size <n>`: Image size in pixels, 16-64 (default: 32)
- `--mode <mode>`: Generation mode
  - `score`: Ordered grayscale `["black","dark","mid","light","white"]` (default)
  - `binary`: Binary choice `["black","white"]`
- `--mock`: Use mock mode (random decisions, no API calls)
- `--out <dir>`: Output directory (default: `out/`)

### How It Works

1. **Raster Order**: For each pixel (x,y) from top-left to bottom-right
2. **Context**: Each Jev call includes the target description + summary of already-decided neighbor pixels (left and above)
3. **Batching**: Processes one row at a time (≤255 pixels per Gateway call)
4. **Output**: Generates PNG image + JSON decision log

### Output

Each run produces:
- **PNG**: Grayscale image (`out/<prompt>-<size>x<size>-<mode>-<date>.png`)
- **JSON**: Decision log with all pixel choices and metadata

### Cost & Latency Notes

**Important**: Jev (`typesafe-ai/jev`) is **NOT** an image generation model. This experiment uses Jev's decision-making API to choose pixel intensities sequentially.

- **API Calls**: `size × size` decisions (e.g., 32×32 = 1,024 calls)
- **Batching**: Rows are batched (up to 255 pixels per Gateway call)
- **Mock Mode**: For testing without API costs, use `--mock` or `JEV_MOCK=1`

**Example timings** (estimated, varies by network):
- 16×16 (256 pixels): ~5-15 seconds
- 32×32 (1,024 pixels): ~20-60 seconds
- 64×64 (4,096 pixels): ~2-5 minutes

### Testing

```bash
# Dry run (mock mode, no API key required)
pnpm test:dry

# Verify: check that out/ contains a PNG and JSON file
ls -lh out/
```

## Architecture

```
src/
  jev.ts                 # Shared Jev client wrapper
  exp-image/
    cli.ts              # CLI entry point
    generator.ts        # Image generation logic
```

### Shared Infrastructure (`src/jev.ts`)

Typed wrapper around AI SDK's `experimental_evaluate`:

- **Methods**:
  - `evaluateChoice(query, choices, state?)`: Returns one choice
  - `evaluateScore(query, scores, state?)`: Returns one score
  - `evaluateBoolean(query, state?)`: Returns boolean
  - `batchEvaluateChoice/Score()`: Batch processing (≤255 per call)
- **Mock Mode**: When `mock: true`, returns random valid answers without API calls

## License

MIT
