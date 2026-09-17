import { generateText } from 'ai';
import type { LanguageModel } from 'ai';

export interface EvaluationCase {
  question: string;
  answer: string;
}

export interface PipelineResult {
  predicted: string;
  tokensUsed: number;
  latencyMs: number;
  keepRate?: number;
}

export interface EvaluationMetrics {
  accuracy: number;
  avgTokens: number;
  avgLatency: number;
  avgKeepRate?: number;
  costEstimate: number;
}

export async function runBasePipeline(
  model: LanguageModel,
  context: string,
  question: string,
  mock: boolean
): Promise<PipelineResult> {
  if (mock) {
    return mockAnswer(context, question);
  }

  const startTime = Date.now();
  const result = await generateText({
    model,
    prompt: `Context:\n${context}\n\nQuestion: ${question}\n\nProvide a concise answer based on the context.`,
  });

  return {
    predicted: result.text.trim(),
    tokensUsed: result.usage?.totalTokens || 0,
    latencyMs: Date.now() - startTime,
  };
}

export async function runJevPipeline(
  chatModel: LanguageModel,
  jevModel: LanguageModel,
  fullContext: string,
  question: string,
  mock: boolean
): Promise<PipelineResult> {
  const { filterWithJev } = await import('./jev.js');
  
  const lines = fullContext.split('\n').filter(l => l.trim());
  
  const filterResult = await filterWithJev({
    model: jevModel,
    query: question,
    lines,
    mock,
  });

  const filteredContext = filterResult.relevantLines.join('\n');
  
  const answerResult = await runBasePipeline(chatModel, filteredContext, question, mock);

  return {
    predicted: answerResult.predicted,
    tokensUsed: filterResult.tokensUsed + answerResult.tokensUsed,
    latencyMs: filterResult.latencyMs + answerResult.latencyMs,
    keepRate: filterResult.keepRate,
  };
}

export function calculateMetrics(
  cases: EvaluationCase[],
  results: PipelineResult[]
): EvaluationMetrics {
  let correctCount = 0;
  let totalTokens = 0;
  let totalLatency = 0;
  let totalKeepRate = 0;
  let keepRateCount = 0;

  for (let i = 0; i < cases.length; i++) {
    const predicted = results[i].predicted.toLowerCase().trim();
    const expected = cases[i].answer.toLowerCase().trim();
    
    if (predicted.includes(expected) || expected.includes(predicted)) {
      correctCount++;
    }

    totalTokens += results[i].tokensUsed;
    totalLatency += results[i].latencyMs;
    
    if (results[i].keepRate !== undefined) {
      totalKeepRate += results[i].keepRate;
      keepRateCount++;
    }
  }

  const accuracy = cases.length > 0 ? correctCount / cases.length : 0;
  const avgTokens = cases.length > 0 ? totalTokens / cases.length : 0;
  const avgLatency = cases.length > 0 ? totalLatency / cases.length : 0;
  const avgKeepRate = keepRateCount > 0 ? totalKeepRate / keepRateCount : undefined;
  
  const costEstimate = (totalTokens / 1_000_000) * 0.15;

  return {
    accuracy,
    avgTokens,
    avgLatency,
    avgKeepRate,
    costEstimate,
  };
}

function mockAnswer(context: string, question: string): PipelineResult {
  const lines = context.split('\n');
  const questionLower = question.toLowerCase();
  
  let predicted = 'Unknown';
  
  if (questionLower.includes('accuracy') && questionLower.includes('imagenet')) {
    const match = context.match(/(\d+\.?\d*)%\s+accuracy/i);
    if (match) predicted = `${match[1]}%`;
  } else if (questionLower.includes('images') && questionLower.includes('trained')) {
    const match = context.match(/(\d+)\s+million\s+images/i);
    if (match) predicted = `${match[1]} million`;
  } else if (questionLower.includes('training') && questionLower.includes('take')) {
    const match = context.match(/(\d+)\s+weeks/i);
    if (match) predicted = `${match[1]} weeks`;
  } else if (questionLower.includes('gpus')) {
    const match = context.match(/(\d+)\s+GPUs/i);
    if (match) predicted = match[1];
  } else if (questionLower.includes('cost reduction')) {
    const match = context.match(/(\d+)%\s+compared/i);
    if (match) predicted = `${match[1]}%`;
  } else if (questionLower.includes('transformer layers')) {
    const match = context.match(/(\d+)\s+transformer\s+layers/i);
    if (match) predicted = match[1];
  } else if (questionLower.includes('next year') && questionLower.includes('scheduled')) {
    const match = context.match(/March\s+\d+-\d+,\s+\d{4}/i);
    if (match) predicted = match[0];
  } else if (questionLower.includes('next year') && questionLower.includes('held')) {
    const match = context.match(/in\s+([A-Z][a-z]+,\s+[A-Z][a-z]+)/);
    if (match) predicted = match[1];
  }

  const estimatedTokens = Math.ceil(context.length / 4) + Math.ceil(question.length / 4) + 50;

  return {
    predicted,
    tokensUsed: estimatedTokens,
    latencyMs: 500 + Math.random() * 300,
  };
}
