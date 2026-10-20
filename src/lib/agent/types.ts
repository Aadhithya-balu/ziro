import {
  WorkflowStatus,
  ClassificationType,
  OutcomeVerificationStatus,
  CaseRecord,
  CreditReportRecord,
  EvidenceItem,
  ClassificationRecord,
  DisputeDraftRecord,
  ApprovalRecord,
  MockBureauDisputeRecord,
  VerificationResultRecord,
} from '@/types';

/**
 * Standard Tool Definition in Agent Registry
 */
export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  permissionBoundary: string;
  effectOnWorkflowState: string;
}

/**
 * A requested tool invocation from the model or orchestrator
 */
export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Execution outcome of a tool invocation
 */
export interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  success: boolean;
  output: unknown;
  error?: string;
  executionTimestamp: string;
  durationMs: number;
}

/**
 * Chat/Conversation Message for Model Invocation
 */
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCallRequest[];
  toolCallId?: string;
  name?: string;
}

/**
 * Result returned by a Model Adapter invocation
 */
export interface ModelInvocationResult {
  message: {
    role: 'assistant';
    content: string;
    toolCalls?: ToolCallRequest[];
  };
  finishReason: 'tool_calls' | 'stop' | 'length' | 'error';
  providerUsed: string;
  isMockOrFallback: boolean;
  rawResponse?: unknown;
}

/**
 * Pluggable Model Adapter Interface
 */
export interface ModelAdapter {
  invoke(params: {
    messages: AgentMessage[];
    tools: AgentToolDefinition[];
    temperature?: number;
    timeoutMs?: number;
  }): Promise<ModelInvocationResult>;
}

/**
 * Full case context assembled for agent deliberation
 */
export interface CaseSnapshot {
  caseRecord: CaseRecord;
  report: CreditReportRecord | null;
  evidence: EvidenceItem[];
  latestClassification: ClassificationRecord | null;
  activeDraft: DisputeDraftRecord | null;
  drafts: DisputeDraftRecord[];
  activeApproval: ApprovalRecord | null;
  latestDispute: MockBureauDisputeRecord | null;
  latestVerification: VerificationResultRecord | null;
}

/**
 * Options configuring an agent run
 */
export interface AgentRunOptions {
  caseId: string;
  goal?: string;
  maxIterations?: number;
  modelAdapter?: ModelAdapter;
  requireLiveModel?: boolean;
}

/**
 * Structured Agent Execution Result returned to API and UI
 */
export interface AgentExecutionResult {
  caseId: string;
  workflowStatus: WorkflowStatus;
  goal: string;
  completed: boolean;
  iterationsRun: number;
  actionsAttempted: string[];
  toolsExecuted: ToolCallResult[];
  toolOutcomes: Record<string, string>;
  evidenceReferences: string[];
  classification?: {
    type: ClassificationType;
    confidenceScore: number;
    reasoning: string;
  };
  draft?: {
    id: string;
    version: number;
    disputedField: string;
  };
  approvalRequirement?: {
    required: boolean;
    approved: boolean;
    reason: string;
    draftVersion?: number;
  };
  mockDisputeId?: string;
  latestBureauStatus?: string;
  independentVerification?: {
    outcome: OutcomeVerificationStatus;
    explanation: string;
    auditMismatchDetected: boolean;
  };
  unresolvedItems: string[];
  requiresHumanAction?: 'APPROVAL_REQUIRED' | 'CONSENT_REQUIRED' | 'NONE';
  providerUsed: string;
  isMockOrFallback: boolean;
  finalSummary: string;
  error?: string;
}
