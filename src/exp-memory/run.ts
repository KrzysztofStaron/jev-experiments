import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createGatewayProvider, getJevModel, getChatModel } from '../lib/gateway.js';
import { runBasePipeline, runJevPipeline, calculateMetrics, type EvaluationCase, type PipelineResult } from '../lib/evaluate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '../..');

interface BenchmarkResult {
  timestamp: string;
  mock: boolean;
  base: {
    accuracy: number;
    avgTokens: number;
    avgLatency: number;
    costEstimate: number;
  };
  jev: {
    accuracy: number;
    avgTokens: number;
    avgLatency: number;
    avgKeepRate: number;
    costEstimate: number;
  };
}

async function main() {
  const mock = process.env.JEV_MOCK === '1' || process.argv.includes('--mock');
  
  console.log(`\n🧪 Running Memory Experiment (${mock ? 'MOCK' : 'LIVE'} mode)\n`);

  const haystackPath = join(ROOT_DIR, 'fixtures/memory/haystack.txt');
  const questionsPath = join(ROOT_DIR, 'fixtures/memory/questions.jsonl');

  const haystack = readFileSync(haystackPath, 'utf-8');
  const questionsRaw = readFileSync(questionsPath, 'utf-8');
  const cases: EvaluationCase[] = questionsRaw
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));

  console.log(`📄 Loaded haystack: ${haystack.split('\n').length} lines`);
  console.log(`❓ Loaded questions: ${cases.length} cases\n`);

  let chatModel;
  let jevModel;

  if (!mock) {
    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      console.error('❌ AI_GATEWAY_API_KEY environment variable is required for live mode');
      process.exit(1);
    }

    const provider = createGatewayProvider(apiKey);
    chatModel = getChatModel(provider);
    jevModel = getJevModel(provider);
  } else {
    chatModel = null as any;
    jevModel = null as any;
  }

  console.log('🔵 Running Base pipeline...');
  const baseResults: PipelineResult[] = [];
  for (const testCase of cases) {
    const result = await runBasePipeline(chatModel, haystack, testCase.question, mock);
    baseResults.push(result);
  }
  const baseMetrics = calculateMetrics(cases, baseResults);
  
  console.log('🟢 Running Base+Jev pipeline...');
  const jevResults: PipelineResult[] = [];
  for (const testCase of cases) {
    const result = await runJevPipeline(chatModel, jevModel, haystack, testCase.question, mock);
    jevResults.push(result);
  }
  const jevMetrics = calculateMetrics(cases, jevResults);

  console.log('\n📊 Results:\n');
  printComparisonTable(baseMetrics, jevMetrics);

  const benchmarkResult: BenchmarkResult = {
    timestamp: new Date().toISOString(),
    mock,
    base: {
      accuracy: baseMetrics.accuracy,
      avgTokens: baseMetrics.avgTokens,
      avgLatency: baseMetrics.avgLatency,
      costEstimate: baseMetrics.costEstimate,
    },
    jev: {
      accuracy: jevMetrics.accuracy,
      avgTokens: jevMetrics.avgTokens,
      avgLatency: jevMetrics.avgLatency,
      avgKeepRate: jevMetrics.avgKeepRate || 0,
      costEstimate: jevMetrics.costEstimate,
    },
  };

  const evalsDir = join(ROOT_DIR, 'evals');
  if (!existsSync(evalsDir)) {
    mkdirSync(evalsDir, { recursive: true });
  }

  const evalsPath = join(evalsDir, 'memory-bench.jsonl');
  appendFileSync(evalsPath, JSON.stringify(benchmarkResult) + '\n');
  
  console.log(`\n✅ Results appended to ${evalsPath}\n`);
}

function printComparisonTable(
  baseMetrics: ReturnType<typeof calculateMetrics>,
  jevMetrics: ReturnType<typeof calculateMetrics>
) {
  const formatPercent = (n: number) => `${(n * 100).toFixed(1)}%`;
  const formatNumber = (n: number) => n.toFixed(1);
  const formatCost = (n: number) => `$${n.toFixed(4)}`;

  const rows = [
    ['Metric', 'Base', 'Base+Jev', 'Diff'],
    ['─'.repeat(20), '─'.repeat(15), '─'.repeat(15), '─'.repeat(15)],
    [
      'Accuracy',
      formatPercent(baseMetrics.accuracy),
      formatPercent(jevMetrics.accuracy),
      formatPercent(jevMetrics.accuracy - baseMetrics.accuracy),
    ],
    [
      'Avg Tokens',
      formatNumber(baseMetrics.avgTokens),
      formatNumber(jevMetrics.avgTokens),
      formatNumber(jevMetrics.avgTokens - baseMetrics.avgTokens),
    ],
    [
      'Avg Latency (ms)',
      formatNumber(baseMetrics.avgLatency),
      formatNumber(jevMetrics.avgLatency),
      formatNumber(jevMetrics.avgLatency - baseMetrics.avgLatency),
    ],
    [
      'Cost Estimate',
      formatCost(baseMetrics.costEstimate),
      formatCost(jevMetrics.costEstimate),
      formatCost(jevMetrics.costEstimate - baseMetrics.costEstimate),
    ],
  ];

  if (jevMetrics.avgKeepRate !== undefined) {
    rows.push([
      'Keep Rate',
      'N/A',
      formatPercent(jevMetrics.avgKeepRate),
      'N/A',
    ]);
  }

  const colWidths = [22, 17, 17, 17];
  
  for (const row of rows) {
    const formatted = row.map((cell, i) => cell.padEnd(colWidths[i])).join('  ');
    console.log(formatted);
  }
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
