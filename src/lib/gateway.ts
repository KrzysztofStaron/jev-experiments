import { createOpenAI } from "@ai-sdk/openai";

const API_KEY = process.env.AI_GATEWAY_API_KEY;
const BASE_URL = "https://gateway.ai.cloudflare.com/v1/typesafe-ai/jev-experiments/openai";

if (!API_KEY && process.env.NODE_ENV !== "test") {
  console.warn("⚠️  AI_GATEWAY_API_KEY not set. Live evaluation will fail.");
}

export const gateway = createOpenAI({
  apiKey: API_KEY || "mock-key",
  baseURL: BASE_URL,
});

export function getChatModel(modelName?: string) {
  const model = modelName || process.env.BASE_MODEL || "gpt-4o-mini";
  return gateway(model);
}

export function getJevModel() {
  return process.env.JEV_MODEL || "typesafe-ai/jev";
}
