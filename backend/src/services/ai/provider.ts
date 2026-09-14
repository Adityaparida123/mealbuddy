// AI provider abstraction. Routes depend only on this interface, so we can
// swap Gemini <-> Vertex <-> deterministic without touching route code.
import type { ExtractedPrefs } from '../../../../shared/src/engine';

export interface AIRequest {
  menu: import('../../../../shared/src/types/menu').MenuItem[];
  prefs: ExtractedPrefs;
  context: { budget?: number; foodQuery?: string; dietary?: string; allergens?: string[]; dislikes?: string[]; historyLength: number };
}

export interface AIResponse {
  /** Ranked item ids, strongest first. Empty = "use engine order". */
  rankedIds: string[];
  /** Natural-language explanation when the provider produced one. */
  explanation?: string;
  /** True when a live AI backend (Gemini/Vertex) answered; false = deterministic fallback. */
  live: boolean;
}

export interface AIProvider {
  readonly name: string;
  /** True when env keys are present so a live call is possible. */
  configured(): boolean;
  recommend(req: AIRequest): Promise<AIResponse>;
}

const NO_RAG_HINT = "I'm a lean demo build: for now I rely on the deterministic menu matcher. Configure GEMINI_API_KEY / VERTEX_* to enable grounded AI answers.";