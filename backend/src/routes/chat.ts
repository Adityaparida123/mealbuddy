import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { getStores } from '../lib/resolvers';
import { getRecommendation } from '../../../shared/src/engine';
import { emptyContext } from '../../../shared/src/types/chat';
import { gateRag } from '../services/rag/knowledge';
import { getAIProvider } from '../services/ai';
import type { ExtractedPrefs } from '../../../shared/src/engine';

const router = Router();

function emptyPrefs(message: string): ExtractedPrefs {
  return {
    message,
    lowerMessage: message.toLowerCase(),
    intent: 'menu_query',
    budget: null,
    time: null,
    diet: null,
    allergens: [],
    cravings: [],
    dislikes: [],
    mood: [],
    foodQuery: [],
    wantedFood: null,
    foodRequestLike: false,
    wantsCheaper: false,
    wantsFaster: false,
    wantsVegRefine: false,
    wantsAvailability: false,
    isGreeting: false,
    isGeneralConversation: false,
    isMenuQuery: true,
    hasFoodRequest: true,
    answered: [],
  };
}


const chatSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  conversationId: z.string().optional(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).default([]),
});

router.post('/', requireAuth, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed.', details: parsed.error.flatten() });
    return;
  }
  const message = parsed.data.message;
  const conversationId = parsed.data.conversationId;
  const stores = await getStores();

  const conversation = conversationId ? await stores.users.listConversation(conversationId) : null;
  if (conversation) {
    await stores.users.addMessage(conversationId!, { role: 'user', content: message, createdAt: new Date().toISOString() });
  }

  // 1) Deterministic RAG knowledge gate (no menu items needed).
  const rag = gateRag(message);
  if (rag.kind === 'knowledge' && rag.answer) {
    if (conversation) {
      await stores.users.addMessage(conversationId!, { role: 'assistant', content: rag.answer, createdAt: new Date().toISOString() });
    }
    res.json({ kind: 'knowledge', answer: rag.answer, recommendation: null, aiUsed: false });
    return;
  }

  // 2) Menu engine is the source of truth (hard constraints, ranking, rescue).
  const items = await stores.menu.listMenu();
  const engine = await getRecommendation(message, items, emptyContext());

  // 3) Optional AI rerank over the engine's validated candidates only.
  const provider = getAIProvider();
  let aiUsed = false;
  if (engine.recommendation && provider.configured() && engine.recommendation.best) {
    try {
      const prefs = engine.prefs as ExtractedPrefs | undefined;
      const ai = await provider.recommend({
        menu: items,
        prefs: (prefs ?? emptyPrefs(message)),
        context: {
          budget: prefs?.budget ?? undefined,
          foodQuery: message,
          historyLength: parsed.data.history.length,
        },
      });
      if (ai.live && ai.rankedIds.length > 0) {
        const reranked = [...items].sort((a, b) => ai.rankedIds.indexOf(a.id) - ai.rankedIds.indexOf(b.id));
        const bestReranked = reranked.find(i => ai.rankedIds.includes(i.id));
        if (bestReranked) {
          aiUsed = true;
          engine.recommendation = {
            ...engine.recommendation,
            best: { item: bestReranked, score: engine.recommendation.best?.score ?? 100, reasons: engine.recommendation.best?.reasons ?? {} },
            explanation: ai.explanation ? `[AI] ${ai.explanation}` : engine.recommendation.explanation,
            aiUsed: true,
          };
        }
      }
    } catch {
      // deterministic fallback: keep engine output
    }
  }

  const reply = engine.recommendation ?? { best: null, alternatives: [], explanation: '', aiUsed: false };
  if (conversation) {
    await stores.users.addMessage(conversationId!, {
      role: 'assistant',
      content: reply.explanation || JSON.stringify(reply),
      createdAt: new Date().toISOString(),
    });
  }

  res.json({ kind: 'menu', recommendation: reply, aiUsed });
});

export default router;