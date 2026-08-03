export type TaskCategory =
  | 'project_initialization'
  | 'project_exploration'
  | 'architecture_planning'
  | 'code_search'
  | 'code_generation'
  | 'multi_file_refactor'
  | 'ui_generation'
  | 'ui_modification'
  | 'debugging'
  | 'runtime_error_analysis'
  | 'build_error_analysis'
  | 'dependency_management'
  | 'testing'
  | 'summarization';

export type TaskComplexity = 'low' | 'medium' | 'high' | 'critical';

export interface TaskClassification {
  category: TaskCategory;
  complexity: TaskComplexity;
}

export interface ModelCapabilities {
  reasoning: number;
  coding: number;
  debugging: number;
  ui_generation: number;
  vision: number;
  speed: number;
}

export interface ModelProfile {
  provider: 'openai' | 'anthropic' | 'google';
  modelId: string;
  capabilities: ModelCapabilities;
  contextWindow: number;
  costInput: number; // per 1M tokens
  costOutput: number; // per 1M tokens
  tier: 'fast' | 'strong' | 'ultra';
}

export interface ModelRouteContext {
  task: TaskClassification;
  availableBudget?: number; // max cost allowed
  isManualMode: boolean;
  manualModel?: string;
  provider: string;
}

export interface ModelRouteDecision {
  selectedModel: string; // The model requested by user or 'auto'
  actualModel: string; // The actual model being executed
  provider: string;
  isFallback: boolean;
  reason: string;
  estimatedCostMultiplier: number; // rough scale vs gpt-4o-mini
}
