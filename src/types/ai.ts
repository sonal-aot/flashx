import { JiraIssue } from './jira';
import { BranchNamingConfig } from './settings';

export type ProviderId = 'gemini' | 'openai' | 'claude';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  isFreeTier?: boolean;
}

export interface BranchGenerationRequest {
  issue: JiraIssue;
  config: BranchNamingConfig;
  apiKey: string;
  model: string;
}

export interface BranchGenerationResult {
  recommended: string;
  alternatives: string[];
  reason: string;
  detectedPrefix?: string;
  tokensUsed?: number;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  modelTested?: string;
  latencyMs?: number;
  errorDetails?: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly defaultModel: string;
  getAvailableModels(): Promise<ModelInfo[]>;
  generateBranchName(request: BranchGenerationRequest): Promise<BranchGenerationResult>;
  testConnection(apiKey: string, model?: string): Promise<ConnectionTestResult>;
  validateConfiguration(apiKey: string, model?: string): Promise<ValidationResult>;
}
