import type { AIProvider, AIRequest, AIResponse } from './provider';

// Vertex AI adapter. In production this would call
// https://aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{LOCATION}/
// with ADC auth. We keep the interface and env surface so swapping is a change
// of provider name only, and fall back to the deterministic engine otherwise.
export class VertexProvider implements AIProvider {
  readonly name = 'vertex';
  private readonly project: string | null;
  private readonly location: string | null;

  constructor(project?: string, location?: string) {
    this.project = project?.trim() || process.env.VERTEX_PROJECT?.trim() || null;
    this.location = location?.trim() || process.env.VERTEX_LOCATION?.trim() || null;
  }

  configured(): boolean {
    return Boolean(this.project && this.location);
  }

  async recommend(_req: AIRequest): Promise<AIResponse> {
    // Not wired to a live endpoint in this build; deterministic engine covers it.
    return { rankedIds: [], live: false };
  }
}