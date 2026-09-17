import { createOpenAI } from '@ai-sdk/openai';

export function createGatewayProvider(apiKey: string) {
  return createOpenAI({
    baseURL: 'https://gateway.ai.cloudflare.com/v1',
    apiKey,
  });
}

export function getJevModel(provider: ReturnType<typeof createGatewayProvider>) {
  return provider('typesafe-ai/jev');
}

export function getChatModel(provider: ReturnType<typeof createGatewayProvider>) {
  return provider('openai/gpt-4.1-mini');
}
