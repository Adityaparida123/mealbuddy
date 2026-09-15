import type { AIProvider, AIRequest, AIResponse } from './provider';

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_TIMEOUT_MS = 8000;

function resolveAITimeoutMs(): number {
  const raw = Number(process.env.AI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private readonly apiKey: string | null;
  private readonly model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || null;
    this.model = model?.trim() || process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  }

  configured(): boolean {
    return Boolean(this.apiKey);
  }

  async recommend(req: AIRequest): Promise<AIResponse> {
    if (!this.apiKey) return { rankedIds: [], live: false };
    const controller = new AbortController();
    const timeoutMs = resolveAITimeoutMs();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const payload = {
        contents: [{
          parts: [{ text: this.prompt(req) }],
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      };
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal },
      );
      if (!res.ok) return { rankedIds: [], live: false };
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const parsed = this.parse(text, req.menu.map(i => i.id));
      return { ...parsed, live: true };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'AbortError';
      if (timedOut) console.warn(`[ai] gemini recommend timed out after ${timeoutMs}ms — keeping deterministic engine order`);
      return { rankedIds: [], live: false };
    } finally {
      clearTimeout(timer);
    }
  }

  private prompt(req: AIRequest): string {
    const names = req.menu.map(i => `${i.id}: ${i.name} (₹${i.price}, ${i.category})`).join('\n');
    return `You rank menu items for a college canteen.
Menu:
${names}
User request: ${req.context.foodQuery ?? ''}
Budget: ${req.context.budget ?? 'no limit'}
Diet: ${req.context.dietary ?? 'any'}
Allergens to avoid: ${req.context.allergens?.join(', ') ?? 'none'}
Dislikes: ${req.context.dislikes?.join(', ') ?? 'none'}

Reply with ONLY a JSON object, no markdown:
{"rankedIds":["<id>","<id2>"],"explanation":"<under 40 words>"}
Pick the single best item as rankedIds[0]. Only use ids that exist in the menu.`;
  }

  private parse(text: string, validIds: string[]): Pick<AIResponse, 'rankedIds' | 'explanation'> {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { rankedIds: [], explanation: '' };
    try {
      const obj = JSON.parse(m[0]) as { rankedIds?: unknown; explanation?: unknown };
      const rankedIds = Array.isArray(obj.rankedIds)
        ? obj.rankedIds.filter((x): x is string => typeof x === 'string' && validIds.includes(x))
        : [];
      return { rankedIds, explanation: typeof obj.explanation === 'string' ? obj.explanation : undefined };
    } catch {
      return { rankedIds: [], explanation: '' };
    }
  }
}