import type { AIProvider, AIRequest, AIResponse } from './provider';
import { GeminiProvider } from './gemini';
import { VertexProvider } from './vertex';

export type AiProviderName = 'gemini' | 'vertex' | 'deterministic';

export function getAIProvider(name?: AiProviderName): AIProvider {
  const chosen = name ?? process.env.AI_PROVIDER?.toLowerCase() as AiProviderName | undefined;
  if (chosen === 'gemini') {
    const g = new GeminiProvider();
    if (g.configured()) return g;
  }
  if (chosen === 'vertex') {
    const v = new VertexProvider();
    if (v.configured()) return v;
  }
  // deterministic fallback: no rankedIds signal tells the caller to keep engine order
  const det: AIProvider = {
    name: 'deterministic',
    configured: () => true,
    recommend: async (_req: AIRequest): Promise<AIResponse> => ({ rankedIds: [], live: false }),
  };
  return det;
}

export { GeminiProvider, VertexProvider };
export type { AIProvider, AIRequest, AIResponse };