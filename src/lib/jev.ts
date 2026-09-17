import { experimental_evaluate as evaluate } from "ai";
import type { Experimental_EvaluationQuestion } from "ai";
import { getJevModel } from "./gateway.js";

export type JevQuestion = Experimental_EvaluationQuestion;

export interface JevEvaluateInput {
  state: string;
  questions: Record<string, JevQuestion>;
}

export interface JevEvaluateResult {
  responses: Record<string, boolean | string | number>;
  rawResult: any;
}

/**
 * Evaluate relevance using Jev's experimental_evaluate API.
 * 
 * Pattern from AI SDK docs:
 * ```ts
 * await evaluate({
 *   model: "typesafe-ai/jev",
 *   state: "...",
 *   questions: {
 *     s0: { type: "boolean", instructions: "Is session 0 relevant?" }
 *   }
 * });
 * ```
 * 
 * Can batch many session questions in ONE call (tested with ~1024 short questions).
 */
export async function evaluateWithJev(
  input: JevEvaluateInput
): Promise<JevEvaluateResult> {
  const model = getJevModel();
  
  const result = await evaluate({
    model,
    state: input.state,
    questions: input.questions,
  });

  const responses: Record<string, boolean | string | number> = {};
  
  for (const [key, question] of Object.entries(input.questions)) {
    const answer = (result.answers as any)[key];
    
    if (question.type === "boolean") {
      responses[key] = typeof answer === "object" && "probability" in answer ? answer.probability >= 0.5 : answer >= 0.5;
    } else if (question.type === "score") {
      responses[key] = typeof answer === "object" && "score" in answer ? answer.score : parseFloat(String(answer));
    } else {
      responses[key] = String(answer);
    }
  }

  return {
    responses,
    rawResult: result,
  };
}

/**
 * Batch evaluate session relevance for LongMemEval.
 * Returns array of booleans (true = keep session).
 */
export async function batchEvaluateSessionRelevance(
  query: string,
  sessions: string[],
  options: {
    threshold?: number;
    batchSize?: number;
  } = {}
): Promise<boolean[]> {
  const { threshold = 0.5, batchSize = 512 } = options;
  const results: boolean[] = new Array(sessions.length).fill(false);

  for (let i = 0; i < sessions.length; i += batchSize) {
    const batch = sessions.slice(i, Math.min(i + batchSize, sessions.length));
    const questions: Record<string, JevQuestion> = {};

    batch.forEach((session, idx) => {
      const globalIdx = i + idx;
      questions[`s${globalIdx}`] = {
        type: "boolean" as const,
        instructions: `Is session ${globalIdx} relevant to answering the question?\n\nSession ${globalIdx}:\n${session.slice(0, 2000)}`,
      };
    });

    const state = `Question: ${query}\n\nEvaluate which sessions contain information relevant to answering this question.`;

    const { responses } = await evaluateWithJev({ state, questions });

    batch.forEach((_, idx) => {
      const globalIdx = i + idx;
      const key = `s${globalIdx}`;
      const value = responses[key];
      results[globalIdx] = typeof value === "boolean" ? value : (typeof value === "number" ? value >= threshold : false);
    });
  }

  return results;
}
