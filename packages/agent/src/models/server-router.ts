import type { ModelTier } from '@peep/shared';

export interface ServerModelConfig {
  providerId: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
  costInputPerMillion: number;
  costOutputPerMillion: number;
  fallback?: {
    providerId: string;
    modelId: string;
  };
}

export class ServerModelRouter {
  // Configured strictly server-side
  private routes: Record<ModelTier, ServerModelConfig> = {
    fast: {
      providerId: 'google',
      modelId: 'gemini-3.6-flash',
      maxTokens: 4096,
      temperature: 0.2,
      costInputPerMillion: 0.075,
      costOutputPerMillion: 0.30,
      fallback: {
        providerId: 'openai',
        modelId: 'gpt-4o-mini'
      }
    },
    reasoning: {
      providerId: 'openai',
      modelId: 'gpt-4o',
      maxTokens: 8192,
      temperature: 0.0,
      costInputPerMillion: 5.00,
      costOutputPerMillion: 15.00,
      fallback: {
        providerId: 'google',
        modelId: 'gemini-1.5-pro'
      }
    },
    premium: {
      providerId: 'google',
      modelId: 'gemini-3.1-pro',
      maxTokens: 8192,
      temperature: 0.3,
      costInputPerMillion: 3.00,
      costOutputPerMillion: 15.00,
      fallback: {
        providerId: 'openai',
        modelId: 'gpt-4o'
      }
    }
  };

  route(tier: ModelTier, plan = 'pro'): ServerModelConfig {
    const config = this.routes[tier];
    if (!config) {
      throw new Error(`Unsupported model tier: ${tier}`);
    }

    // Plan boundary checking
    if (tier === 'premium' && plan === 'free') {
      throw new Error('Premium tier requires a paid active subscription plan.');
    }

    return config;
  }
}
