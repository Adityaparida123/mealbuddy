import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { getStores } from '../lib/resolvers';
import { getRecommendation, extractUserPreferences, type ExtractedPrefs } from '../../../shared/src/engine';
import { emptyContext, type ChatContext, type ConversationIntent } from '../../../shared/src/types/chat';
import { gateRag } from '../services/rag/knowledge';
import { getAIProvider } from '../services/ai';

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

const contextSchema = z.object({
  cravings: z.array(z.string()).optional(),
  budget: z.number().nullable().optional(),
  diet: z.string().nullable().optional(),
  allergens: z.array(z.string()).optional(),
  dislikes: z.array(z.string()).optional(),
  time: z.number().nullable().optional(),
  mood: z.array(z.string()).optional(),
  lastRecommendationId: z.string().nullable().optional(),
  lastBestPrice: z.number().nullable().optional(),
  lastIntents: z.array(z.string()).optional(),
  answered: z.array(z.string()).optional(),
  lastQuestion: z.string().nullable().optional(),
  availability: z.boolean().optional(),
  conversationIntent: z.enum(['food_recommendation', 'menu_query', 'general', 'greeting']).nullable().optional(),
});

const chatSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  conversationId: z.string().optional(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).default([]),
  context: contextSchema.optional(),
});

/**
 * ONE conversation state model (ChatContext). Each turn:
 *   1. merge the client's previous state (or replay user turns from history)
 *      with extractUserPreferences(message, context)
 *   2. return the merged state so the client sends it back next turn.
 * This guarantees craving/budget/allergy info is never lost or re-asked.
 */
export function buildContext(prefs: ExtractedPrefs, prev: ChatContext, clarification: string | null): ChatContext {
  return {
    cravings: prefs.cravings.slice(-6),
    budget: prefs.budget,
    diet: prefs.diet,
    allergens: prefs.allergens,
    dislikes: prefs.dislikes,
    time: prefs.time,
    mood: prefs.mood.slice(-4),
    lastIntents: [...prev.lastIntents, prefs.intent].slice(-5),
    answered: prefs.answered,
    lastQuestion: clarification ?? null,
    lastRecommendationId: prev.lastRecommendationId,
    lastBestPrice: prev.lastBestPrice,
    availability: prefs.wantsAvailability || prev.availability,
    conversationIntent: prefs.intent as ConversationIntent,
  };
}

// Fallback for clients that only send history: replay the user turns through
// the same extractor so state survives even without an explicit context.
export function contextFromHistory(history: { role: 'user' | 'assistant'; content: string }[]): ChatContext {
  let ctx = emptyContext();
  for (const entry of history) {
    if (entry.role !== 'user') continue;
    const prefs = extractUserPreferences(entry.content, ctx);
    ctx = buildContext(prefs, ctx, null);
  }
  return ctx;
}

router.post('/', requireAuth, async (req, res) => {
  const startMs = Date.now();
  console.log('[CHAT] request received');
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn('[CHAT] validation failed');
      res.status(400).json({ error: 'Validation failed.', details: parsed.error.flatten() });
      return;
    }
    const message = parsed.data.message;
    const conversationId = parsed.data.conversationId;
    console.log('[CHAT] authenticated');

    const context: ChatContext = {
      ...contextFromHistory(parsed.data.history),
      ...(parsed.data.context ?? {}),
    };

    // Extract intent as early as possible (pure, deterministic, no I/O).
    const prefs = extractUserPreferences(message, context);
    console.log('[CHAT] state merged');
    console.log(`[CHAT] intent extracted = ${prefs.intent}`);

    // ── Fast path: greeting / general conversation ──
    // These never touch menu stores, never load the menu, never call AI.
    // Logs stop here for these intents.
    if (prefs.isGreeting || prefs.isGeneralConversation) {
      const engine = await getRecommendation(message, [], context);
      const reply = engine.recommendation ?? { best: null, alternatives: [], explanation: '', aiUsed: false };
      const nextContext = buildContext(engine.prefs, context, null);
      console.log(`[CHAT] response sent (${prefs.intent} fast-path, ${Date.now() - startMs}ms)`);
      res.json({ kind: 'menu', recommendation: reply, aiUsed: false, context: nextContext });
      return;
    }

    // ── Deterministic RAG knowledge gate (no menu needed) ──
    const rag = gateRag(message);
    if (rag.kind === 'knowledge' && rag.answer) {
      console.log('[CHAT] response sent (knowledge)');
      res.json({ kind: 'knowledge', answer: rag.answer, recommendation: null, aiUsed: false, context });
      return;
    }

    // ── Menu engine path (requires stores + menu + optional AI) ──
    const stores = await getStores();
    console.log('[CHAT] stores ready');

    const conversation = conversationId ? await stores.users.listConversation(conversationId) : null;
    if (conversation) {
      await stores.users.addMessage(conversationId!, { role: 'user', content: message, createdAt: new Date().toISOString() });
    }

    const items = await stores.menu.listMenu();
    console.log(`[CHAT] menu loaded (${items.length} items)`);

    const engine = await getRecommendation(message, items, context);
    console.log('[CHAT] candidates filtered');

    // Optional AI rerank over the engine's validated candidates only.
    const provider = getAIProvider();
    let aiUsed = false;
    if (engine.recommendation && provider.configured() && engine.recommendation.best) {
      console.log('[CHAT] AI ranking started');
      try {
        const prefsForAI = engine.prefs as ExtractedPrefs | undefined;
        const ai = await provider.recommend({
          menu: items,
          prefs: (prefsForAI ?? emptyPrefs(message)),
          context: {
            budget: prefsForAI?.budget ?? undefined,
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
        console.log(`[CHAT] AI ranking completed (aiUsed=${aiUsed})`);
      } catch (err) {
        console.warn('[CHAT] AI ranking failed — keeping deterministic engine order', err instanceof Error ? err.message : err);
      }
    }

    const reply = engine.recommendation ?? { best: null, alternatives: [], explanation: '', aiUsed: false };
    const nextContext = buildContext(engine.prefs, context, engine.clarification?.questionId ?? null);
    if (conversation) {
      await stores.users.addMessage(conversationId!, {
        role: 'assistant',
        content: reply.explanation || JSON.stringify(reply),
        createdAt: new Date().toISOString(),
      });
    }

    console.log(`[CHAT] response sent (menu, aiUsed=${aiUsed}, ${Date.now() - startMs}ms)`);
    res.json({ kind: 'menu', recommendation: reply, aiUsed, context: nextContext });
  } catch (err) {
    console.error('[CHAT] error responding', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Something went wrong on the server.' });
    }
  }
});

export default router;
