import { generateObject } from 'ai';
import { z } from 'zod';
import type { LanguageModel } from 'ai';

export interface JevFilterOptions {
  model: LanguageModel;
  query: string;
  lines: string[];
  mock?: boolean;
}

export interface JevFilterResult {
  relevantLines: string[];
  keepRate: number;
  tokensUsed: number;
  latencyMs: number;
}

export async function filterWithJev(options: JevFilterOptions): Promise<JevFilterResult> {
  const { model, query, lines, mock } = options;
  
  if (mock) {
    return mockJevFilter(query, lines);
  }

  const startTime = Date.now();
  const relevantLines: string[] = [];
  let totalTokens = 0;

  for (const line of lines) {
    const result = await generateObject({
      model,
      schema: z.object({
        relevant: z.boolean().describe('Is this line relevant to answering the query?'),
      }),
      prompt: `Query: ${query}\n\nLine: ${line}\n\nIs this line relevant to answering the query?`,
    });

    if (result.object.relevant) {
      relevantLines.push(line);
    }

    totalTokens += result.usage?.totalTokens || 0;
  }

  const latencyMs = Date.now() - startTime;
  const keepRate = lines.length > 0 ? relevantLines.length / lines.length : 0;

  return {
    relevantLines,
    keepRate,
    tokensUsed: totalTokens,
    latencyMs,
  };
}

function mockJevFilter(query: string, lines: string[]): JevFilterResult {
  const queryLower = query.toLowerCase();
  const keywords = extractKeywords(queryLower);
  
  const relevantLines = lines.filter(line => {
    const lineLower = line.toLowerCase();
    return keywords.some(keyword => lineLower.includes(keyword));
  });

  return {
    relevantLines,
    keepRate: lines.length > 0 ? relevantLines.length / lines.length : 0,
    tokensUsed: lines.length * 50,
    latencyMs: lines.length * 10,
  };
}

function extractKeywords(query: string): string[] {
  const stopWords = new Set(['what', 'when', 'where', 'who', 'how', 'is', 'the', 'a', 'an', 'did', 'was', 'were']);
  return query
    .toLowerCase()
    .replace(/[?.,]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}
