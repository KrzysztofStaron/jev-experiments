import { readFile } from "fs/promises";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { program } from "commander";
import { generateText } from "ai";
import chalk from "chalk";
import { getChatModel } from "../lib/gateway.js";
import { batchEvaluateSessionRelevance } from "../lib/jev.js";

interface LongMemEvalInstance {
  question: string;
  answer: string;
  sessions: string[];
  metadata?: {
    id?: string;
    split?: string;
    num_sessions?: number;
    total_tokens?: number;
  };
}

interface EvalResult {
  instanceId: string;
  question: string;
  goldAnswer: string;
  baselinePrediction: string;
  baselineCorrect: boolean;
  jevPrediction: string;
  jevCorrect: boolean;
  totalSessions: number;
  keptSessions: number;
  keepRate: number;
  baselineTokens: number;
  jevTokens: number;
  jevLatencyMs: number;
  baselineLatencyMs: number;
}

program
  .option("--limit <n>", "Number of instances to evaluate", "20")
  .option("--offset <n>", "Start offset", "0")
  .option("--split <s>", "Dataset split: s or oracle", "s")
  .option("--mock", "Use mock fixture data instead of real dataset")
  .parse();

const opts = program.opts();
const LIMIT = parseInt(opts.limit);
const OFFSET = parseInt(opts.offset);
const SPLIT = opts.split;
const MOCK = opts.mock;

async function loadDataset(): Promise<LongMemEvalInstance[]> {
  if (MOCK) {
    console.log(chalk.yellow("📦 Using mock fixture data"));
    const fixturePath = `/workspace/fixtures/longmemeval/mock-${SPLIT}.json`;
    const data = await readFile(fixturePath, "utf-8");
    return JSON.parse(data);
  }

  const dataPath = `/workspace/data/longmemeval/longmemeval_${SPLIT}_cleaned.json`;
  
  if (!existsSync(dataPath)) {
    console.error(chalk.red(`❌ Dataset not found: ${dataPath}`));
    console.error(chalk.yellow(`Run: pnpm download:longmemeval`));
    process.exit(1);
  }

  console.log(chalk.blue(`📂 Loading dataset from ${dataPath}...`));
  const data = await readFile(dataPath, "utf-8");
  const instances = JSON.parse(data);
  
  return instances.slice(OFFSET, OFFSET + LIMIT);
}

function normalizeAnswer(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s]/g, "");
}

function checkCorrect(predicted: string, gold: string): boolean {
  const normPred = normalizeAnswer(predicted);
  const normGold = normalizeAnswer(gold);
  
  return normPred.includes(normGold) || normGold.includes(normPred);
}

async function runBaseline(instance: LongMemEvalInstance): Promise<{
  prediction: string;
  latencyMs: number;
  tokens: number;
}> {
  const start = Date.now();
  
  const fullHistory = instance.sessions.join("\n\n");
  const prompt = `${fullHistory}\n\nQuestion: ${instance.question}\n\nAnswer concisely based on the conversation history above.`;
  
  const result = await generateText({
    model: getChatModel() as any,
    prompt,
    maxOutputTokens: 100,
  });
  
  const latencyMs = Date.now() - start;
  const tokens = fullHistory.length / 4;
  
  return {
    prediction: result.text.trim(),
    latencyMs,
    tokens: Math.round(tokens),
  };
}

async function runJevFiltered(instance: LongMemEvalInstance): Promise<{
  prediction: string;
  keptSessions: number;
  latencyMs: number;
  tokens: number;
}> {
  const start = Date.now();
  
  const relevance = await batchEvaluateSessionRelevance(
    instance.question,
    instance.sessions,
    { threshold: 0.5, batchSize: 512 }
  );
  
  const keptSessionTexts = instance.sessions.filter((_, i) => relevance[i]);
  const keptCount = keptSessionTexts.length;
  
  const filteredHistory = keptSessionTexts.join("\n\n");
  const prompt = `${filteredHistory}\n\nQuestion: ${instance.question}\n\nAnswer concisely based on the conversation history above.`;
  
  const result = await generateText({
    model: getChatModel() as any,
    prompt,
    maxOutputTokens: 100,
  });
  
  const latencyMs = Date.now() - start;
  const tokens = filteredHistory.length / 4;
  
  return {
    prediction: result.text.trim(),
    keptSessions: keptCount,
    latencyMs,
    tokens: Math.round(tokens),
  };
}

async function evaluateInstance(
  instance: LongMemEvalInstance,
  index: number
): Promise<EvalResult> {
  const instanceId = instance.metadata?.id || `instance-${index}`;
  
  console.log(chalk.cyan(`\n[${index + 1}] Evaluating: ${instanceId}`));
  console.log(chalk.gray(`Question: ${instance.question.slice(0, 80)}...`));
  console.log(chalk.gray(`Sessions: ${instance.sessions.length}, Gold: ${instance.answer}`));
  
  const baseline = await runBaseline(instance);
  console.log(chalk.blue(`  Baseline: "${baseline.prediction}"`));
  
  const jev = await runJevFiltered(instance);
  console.log(chalk.green(`  Jev+Base: "${jev.prediction}" (kept ${jev.keptSessions}/${instance.sessions.length})`));
  
  const baselineCorrect = checkCorrect(baseline.prediction, instance.answer);
  const jevCorrect = checkCorrect(jev.prediction, instance.answer);
  
  return {
    instanceId,
    question: instance.question,
    goldAnswer: instance.answer,
    baselinePrediction: baseline.prediction,
    baselineCorrect,
    jevPrediction: jev.prediction,
    jevCorrect,
    totalSessions: instance.sessions.length,
    keptSessions: jev.keptSessions,
    keepRate: jev.keptSessions / instance.sessions.length,
    baselineTokens: baseline.tokens,
    jevTokens: jev.tokens,
    baselineLatencyMs: baseline.latencyMs,
    jevLatencyMs: jev.latencyMs,
  };
}

async function main() {
  console.log(chalk.bold("\n🎯 LongMemEval Benchmark: Base vs Base+Jev\n"));
  
  console.log(chalk.gray(`Config: split=${SPLIT}, limit=${LIMIT}, offset=${OFFSET}, mock=${MOCK}\n`));

  if (!process.env.AI_GATEWAY_API_KEY && !MOCK) {
    console.error(chalk.red("❌ AI_GATEWAY_API_KEY not set"));
    console.error(chalk.yellow("Set it in .env or use --mock for testing"));
    process.exit(1);
  }

  const instances = await loadDataset();
  console.log(chalk.green(`✅ Loaded ${instances.length} instances\n`));

  const results: EvalResult[] = [];

  for (let i = 0; i < instances.length; i++) {
    const result = await evaluateInstance(instances[i], OFFSET + i);
    results.push(result);
  }

  await mkdir("/workspace/evals", { recursive: true });
  const outputPath = `/workspace/evals/longmemeval-results.jsonl`;
  const lines = results.map((r) => JSON.stringify(r)).join("\n");
  await writeFile(outputPath, lines + "\n");

  console.log(chalk.bold("\n📊 Results Summary\n"));
  
  const baselineAcc = results.filter((r) => r.baselineCorrect).length / results.length;
  const jevAcc = results.filter((r) => r.jevCorrect).length / results.length;
  const avgKeepRate = results.reduce((sum, r) => sum + r.keepRate, 0) / results.length;
  const avgBaselineTokens = results.reduce((sum, r) => sum + r.baselineTokens, 0) / results.length;
  const avgJevTokens = results.reduce((sum, r) => sum + r.jevTokens, 0) / results.length;
  const avgBaselineLatency = results.reduce((sum, r) => sum + r.baselineLatencyMs, 0) / results.length;
  const avgJevLatency = results.reduce((sum, r) => sum + r.jevLatencyMs, 0) / results.length;

  console.log("┌─────────────────────┬──────────────┬──────────────┐");
  console.log("│ Metric              │ Baseline     │ Base+Jev     │");
  console.log("├─────────────────────┼──────────────┼──────────────┤");
  console.log(`│ Accuracy            │ ${(baselineAcc * 100).toFixed(1).padStart(11)}% │ ${(jevAcc * 100).toFixed(1).padStart(11)}% │`);
  console.log(`│ Avg Tokens          │ ${avgBaselineTokens.toFixed(0).padStart(12)} │ ${avgJevTokens.toFixed(0).padStart(12)} │`);
  console.log(`│ Avg Latency (ms)    │ ${avgBaselineLatency.toFixed(0).padStart(12)} │ ${avgJevLatency.toFixed(0).padStart(12)} │`);
  console.log(`│ Avg Keep Rate       │ ${'-'.padStart(12)} │ ${(avgKeepRate * 100).toFixed(1)}%`.padEnd(14) + "│");
  console.log("└─────────────────────┴──────────────┴──────────────┘");

  console.log(chalk.gray(`\n📁 Detailed results: ${outputPath}`));
  
  const tokenSavings = ((1 - avgJevTokens / avgBaselineTokens) * 100).toFixed(1);
  console.log(chalk.green(`\n💡 Token savings: ${tokenSavings}%`));
  
  if (!MOCK && LIMIT < instances.length) {
    const estimatedFullCost = (results.length / LIMIT) * 5;
    console.log(chalk.yellow(`\n⚠️  Full dataset (~${instances.length} instances) estimated cost: ~$${estimatedFullCost.toFixed(2)}`));
  }
}

main().catch((error) => {
  console.error(chalk.red("\n❌ Error:"), error);
  process.exit(1);
});
