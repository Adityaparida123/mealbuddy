import type { MenuItem } from './menu';

export interface MatchReasons {
  craving?: boolean;
  tag?: boolean;
  diet?: boolean;
  budget?: boolean;
  time?: boolean;
  calorie?: boolean;
}

export interface MatchResult {
  item: MenuItem;
  score: number; // 0-100, computed from real criteria
  reasons: MatchReasons;
}

export type QuestionId = 'craving' | 'budget' | 'diet' | 'allergy' | 'time';

export interface ClarificationOption {
  label: string;
  payload: string;
}

export interface Clarification {
  questionId: QuestionId;
  text: string;
  options: ClarificationOption[];
}

export interface Recommendation {
  best: MatchResult | null;
  alternatives: MatchResult[];
  explanation: string;
  aiUsed: boolean;
  clarification?: Clarification | null;
  budgetRescue?: {
    desired: MenuItem | null;
    overBudget: number;
  } | null;
  requestedUnavailable?: string | null;
  noSafeMatch?: boolean;
}

export interface EngineOptions {
  usedAi: boolean;
  hardConstraintsMet: boolean;
  candidateCount: number;
}