#!/usr/bin/env node
import 'dotenv/config';
import { generateImage, ImageMode } from './generator.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    prompt: '',
    size: 32,
    mode: 'score' as ImageMode,
    mock: false,
    outputDir: 'out',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--prompt':
        config.prompt = args[++i];
        break;
      case '--size':
        config.size = parseInt(args[++i], 10);
        break;
      case '--mode':
        config.mode = args[++i] as ImageMode;
        break;
      case '--mock':
        config.mock = true;
        break;
      case '--out':
        config.outputDir = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
Jev Image Generator - Generate B&W/grayscale images using TypeSafe Jev

Usage:
  pnpm exp:image --prompt "description" [options]

Options:
  --prompt <text>    Image description (required)
  --size <n>         Image size in pixels (16-64, default: 32)
  --mode <mode>      Generation mode:
                     - score: ordered grayscale ["black","dark","mid","light","white"]
                     - binary: binary choice [black, white] (default: score)
  --mock             Use mock mode (no API calls)
  --out <dir>        Output directory (default: out/)
  -h, --help         Show this help

Environment:
  AI_GATEWAY_API_KEY Required for live mode (from Vercel AI Gateway)
  JEV_MOCK=1         Enable mock mode via environment

Examples:
  pnpm exp:image --prompt "a white circle on black" --size 32
  pnpm exp:image --prompt "diagonal stripes" --size 24 --mode binary
  pnpm exp:image --prompt "gradient" --size 16 --mock
  JEV_MOCK=1 pnpm exp:image --prompt "test" --size 16
`);
}

async function main() {
  const config = parseArgs();

  if (!config.prompt) {
    console.error('Error: --prompt is required');
    printHelp();
    process.exit(1);
  }

  if (config.size < 16 || config.size > 64) {
    console.error('Error: --size must be between 16 and 64');
    process.exit(1);
  }

  if (!['score', 'binary'].includes(config.mode)) {
    console.error('Error: --mode must be "score" or "binary"');
    process.exit(1);
  }

  const mockMode = config.mock || process.env.JEV_MOCK === '1';
  const apiKey = process.env.AI_GATEWAY_API_KEY || 'mock-key';

  if (!mockMode && !process.env.AI_GATEWAY_API_KEY) {
    console.error('Error: AI_GATEWAY_API_KEY environment variable not set');
    console.error('Set it in .env or use --mock / JEV_MOCK=1 for testing');
    process.exit(1);
  }

  try {
    const startTime = Date.now();
    
    const result = await generateImage({
      prompt: config.prompt,
      size: config.size,
      mode: config.mode,
      apiKey,
      mock: mockMode,
      outputDir: config.outputDir,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✓ Complete in ${elapsed}s`);
    console.log(`  PNG: ${result.pngPath}`);
    console.log(`  JSON: ${result.jsonPath}`);
    
    if (mockMode) {
      console.log('\n⚠ Mock mode: results are random, not Jev-powered');
    }
  } catch (error) {
    console.error('\n✗ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
