import { experimental_evaluate as aiEvaluate } from 'ai';

export type JevChoice = string;
export type JevScore = string;
export type JevBoolean = boolean;

interface JevConfig {
  apiKey: string;
  model?: string;
  mock?: boolean;
}

interface EvaluateChoiceParams {
  query: string;
  choices: string[];
  state?: string;
}

interface EvaluateScoreParams {
  query: string;
  scores: string[];
  state?: string;
}

interface EvaluateBooleanParams {
  query: string;
  state?: string;
}

const DEFAULT_MODEL = 'typesafe-ai/jev';

export class JevClient {
  private config: JevConfig;

  constructor(config: JevConfig) {
    this.config = config;
  }

  private mockChoice(choices: string[]): string {
    return choices[Math.floor(Math.random() * choices.length)];
  }

  private mockScore(scores: string[]): string {
    return scores[Math.floor(Math.random() * scores.length)];
  }

  private mockBoolean(): boolean {
    return Math.random() > 0.5;
  }

  async evaluateChoice(params: EvaluateChoiceParams): Promise<JevChoice> {
    if (this.config.mock) {
      return this.mockChoice(params.choices);
    }

    const result = await aiEvaluate({
      model: this.config.model || DEFAULT_MODEL,
      apiKey: this.config.apiKey,
      query: params.query,
      choices: params.choices,
      state: params.state,
    });

    return result.choice as string;
  }

  async evaluateScore(params: EvaluateScoreParams): Promise<JevScore> {
    if (this.config.mock) {
      return this.mockScore(params.scores);
    }

    const result = await aiEvaluate({
      model: this.config.model || DEFAULT_MODEL,
      apiKey: this.config.apiKey,
      query: params.query,
      scores: params.scores,
      state: params.state,
    });

    return result.score as string;
  }

  async evaluateBoolean(params: EvaluateBooleanParams): Promise<JevBoolean> {
    if (this.config.mock) {
      return this.mockBoolean();
    }

    const result = await aiEvaluate({
      model: this.config.model || DEFAULT_MODEL,
      apiKey: this.config.apiKey,
      query: params.query,
      state: params.state,
    });

    return result.boolean as boolean;
  }

  async batchEvaluateChoice(
    queries: EvaluateChoiceParams[]
  ): Promise<JevChoice[]> {
    if (queries.length === 0) return [];
    
    if (this.config.mock) {
      return queries.map(q => this.mockChoice(q.choices));
    }

    const chunkSize = 255;
    const results: JevChoice[] = [];

    for (let i = 0; i < queries.length; i += chunkSize) {
      const chunk = queries.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map(q => this.evaluateChoice(q))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  async batchEvaluateScore(
    queries: EvaluateScoreParams[]
  ): Promise<JevScore[]> {
    if (queries.length === 0) return [];
    
    if (this.config.mock) {
      return queries.map(q => this.mockScore(q.scores));
    }

    const chunkSize = 255;
    const results: JevScore[] = [];

    for (let i = 0; i < queries.length; i += chunkSize) {
      const chunk = queries.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map(q => this.evaluateScore(q))
      );
      results.push(...chunkResults);
    }

    return results;
  }
}

export function createJevClient(apiKey: string, options?: { mock?: boolean }): JevClient {
  return new JevClient({
    apiKey,
    mock: options?.mock || false,
  });
}
