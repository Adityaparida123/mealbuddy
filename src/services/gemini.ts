import type { MenuItem } from '../types/menu';
import type { ExtractedPrefs } from '../engine/intent';

const DEFAULT_MODEL = 'gemini-1.5-flash';

export function getGeminiApiKey(): string | null {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const key = (env.VITE_GEMINI_API_KEY as string | undefined) ?? null;
  if (key && key.trim()) return key.trim();
  return null;
}

export function getGeminiModel(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return (env.VITE_GEMINI_MODEL as string | undefined) || DEFAULT_MODEL;
}

export function isGeminiConfigured(): boolean {
  return getGeminiApiKey() !== null;
}

const SYSTEM_INSTRUCTION = `You are the ranking and explanation layer of Meal Buddy, a college canteen assistant.

You MUST ONLY select from the supplied VALID CANDIDATES (real items from today's menu).
You MUST NOT invent menu items, names, prices, ingredients, allergens, dietary types, preparation times, calories, availability or categories.
You MUST NOT recommend an item that is not present in VALID CANDIDATES under any circumstances.
You MUST prioritize the user's explicit food request over generic popularity or preference.
You MUST respect every supplied constraint (budget, diet, allergen exclusions, preparation time, dislikes).
Allergy safety has already been applied as a hard constraint — the VALID CANDIDATES are already allergy-safe; never reintroduce a conflicting item.
All valid candidates are currently available and satisfy every hard rule.
If no candidate is suitable, say so honestly instead of inventing one.
Base every factual statement ONLY on the supplied VALID CANDIDATES data.
Be concise, friendly and conversational.`;

export interface GeminiReply {
  bestId: string;
  alternativeIds: string[];
  explanation: string;
}

interface GeminiCallOptions {
  userMessage: string;
  candidates: MenuItem[];
  prefs: ExtractedPrefs;
}

export async function rankCandidatesWithGemini(opts: GeminiCallOptions): Promise<GeminiReply | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  if (opts.candidates.length === 0) return null;

  const candidateJson = opts.candidates.map(c => ({
    id: c.id,
    name: c.name,
    price: c.price,
    category: c.category,
    ingredients: c.ingredients,
    allergens: c.allergens,
    diet: c.diet,
    dietType: c.dietType,
    prepTime: c.prepTime,
    available: c.available,
    tags: c.tags,
  }));

  const userPrefs = {
    desiredFood: opts.prefs.foodQuery,
    craving: opts.prefs.cravings,
    mood: opts.prefs.mood,
    budget: opts.prefs.budget,
    allergies: opts.prefs.allergens,
    diet: opts.prefs.diet,
    maxPrepTime: opts.prefs.time,
    dislikes: opts.prefs.dislikes,
  };

  const prompt = [
    `Student message: "${opts.userMessage}"`,
    `USER PREFERENCES (already extracted, hard rules already enforced on the candidate list):`,
    JSON.stringify(userPrefs, null, 2),
    `VALID CANDIDATES (real, currently-available menu items that passed every hard filter):`,
    JSON.stringify(candidateJson, null, 2),
    `\nChoose the single best candidate and up to 2 alternatives strictly from VALID CANDIDATES.`,
    `Prioritize the student's explicit food request above all.`,
  ].join('\n');

  const requestBody = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              prompt +
              '\n\nRespond ONLY with valid JSON of the form: {"best": "<item id>", "alternatives": ["<item id>", ...], "explanation": "<1-2 sentence friendly student-facing explanation>"}.' +
              ' The "best" and every "alternatives" entry MUST be real ids from VALID CANDIDATES.' +
              ' If no candidate is genuinely suitable, respond with {"best": "", "alternatives": [], "explanation": "<honest explanation>"}.',
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 600,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('');
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const rec = parsed as { best?: unknown; alternatives?: unknown; explanation?: unknown };

    const bestId = String(rec.best ?? '').trim();
    const alternativeIds = Array.isArray(rec.alternatives)
      ? rec.alternatives.map(String).filter(x => x && x !== bestId)
      : [];

    // hard gate: only ids that really exist in the supplied candidate pool
    const validIds = new Set(opts.candidates.map(c => c.id));
    const isBestValid = bestId !== '' && validIds.has(bestId);
    const validAlts = alternativeIds.filter(id => validIds.has(id) && id !== bestId).slice(0, 2);

    return {
      bestId: isBestValid ? bestId : '',
      alternativeIds: validAlts,
      explanation: String(rec.explanation ?? ''),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}