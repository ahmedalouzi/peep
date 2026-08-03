import type { ModelRouteContext, ModelRouteDecision } from './types';
import { ModelRegistry } from './registry';

export class ModelOrchestrator {
  private registry: ModelRegistry;

  constructor() {
    this.registry = new ModelRegistry();
  }

  route(context: ModelRouteContext): ModelRouteDecision {
    // MANUAL MODE: No silent fallback. Return exactly what was requested.
    if (context.isManualMode && context.manualModel) {
      const selected = context.manualModel;
      const profile = this.registry.get(selected);
      return {
        selectedModel: selected,
        actualModel: selected,
        provider: context.provider,
        isFallback: false,
        reason: 'Manual mode explicitly requested this model.',
        estimatedCostMultiplier: profile ? (profile.costInput + profile.costOutput) : 1
      };
    }

    // AUTO MODE
    let targetTier: 'fast' | 'strong' | 'ultra' = 'fast';

    if (
      context.task.complexity === 'high' ||
      context.task.complexity === 'critical' ||
      context.task.category === 'architecture_planning' ||
      context.task.category === 'multi_file_refactor' ||
      context.task.category === 'build_error_analysis' ||
      context.task.category === 'runtime_error_analysis'
    ) {
      targetTier = 'strong';
    }

    const selectedProfile = this.registry.findBestModel(context.provider, { tier: targetTier });

    return {
      selectedModel: 'auto',
      actualModel: selectedProfile.modelId,
      provider: context.provider,
      isFallback: false,
      reason: `Auto-routed to ${selectedProfile.modelId} based on task category [${context.task.category}] and complexity [${context.task.complexity}]. Tier chosen: ${targetTier}.`,
      estimatedCostMultiplier: selectedProfile.costInput + selectedProfile.costOutput
    };
  }
}
