import {
  AgentMessage,
  AgentToolDefinition,
  ModelAdapter,
  ModelInvocationResult,
  ToolCallRequest,
} from './types';
import { getCaseSnapshot } from './tools';

/**
 * Prompt injection defense: sanitize and escape untrusted text
 */
export function sanitizeUntrustedContent(raw: string): string {
  if (!raw) return '';
  // Wrap in untrusted boundary tags and escape conflicting brackets
  const cleaned = raw.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<untrusted_content>\n${cleaned}\n</untrusted_content>`;
}

/**
 * Built-in Deterministic Rule Agent Model (Local Offline Fallback)
 * Replaces live LLM when no API keys are present.
 * Inspects case status and goals to step through the statutory dispute lifecycle deterministically.
 */
export class DeterministicRuleAgentModel implements ModelAdapter {
  private readonly providerName = 'Ziro Deterministic Rule-Bound AI Engine (Offline Fallback)';

  async invoke(params: {
    messages: AgentMessage[];
    tools: AgentToolDefinition[];
    temperature?: number;
    timeoutMs?: number;
  }): Promise<ModelInvocationResult> {
    const { messages } = params;

    // Find the latest user message or initial prompt
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const userText = lastUserMsg?.content || '';

    // Extract caseId from user message or tool responses
    const caseIdMatch = userText.match(/CASE-[A-Za-z0-9_-]+/i) || userText.match(/"caseId":\s*"([^"]+)"/i);
    let caseId = caseIdMatch ? caseIdMatch[1] || caseIdMatch[0] : '';

    // If not found in user text, inspect previous tool results
    if (!caseId) {
      for (const m of messages) {
        if (m.role === 'tool' && m.content) {
          const match = m.content.match(/"caseId":\s*"([^"]+)"/i) || m.content.match(/CASE-[A-Za-z0-9_-]+/i);
          if (match) {
            caseId = match[1] || match[0];
            break;
          }
        }
      }
    }

    // Examine conversation history for executed tools
    const executedToolNames = messages
      .filter((m) => m.role === 'tool' && m.name)
      .map((m) => m.name as string);

    // If caseId could not be determined, return informative text
    if (!caseId) {
      return {
        message: {
          role: 'assistant',
          content: 'No valid Case ID found in the prompt or conversation history to operate on.',
        },
        finishReason: 'stop',
        providerUsed: this.providerName,
        isMockOrFallback: true,
      };
    }

    // Inspect real database state of case
    let snapshot;
    try {
      snapshot = getCaseSnapshot(caseId);
    } catch {
      return {
        message: {
          role: 'assistant',
          content: `Unable to retrieve snapshot for case "${caseId}". Case does not exist in database.`,
        },
        finishReason: 'stop',
        providerUsed: this.providerName,
        isMockOrFallback: true,
      };
    }

    // Step 1: If inspect_case hasn't been executed, call inspect_case
    if (!executedToolNames.includes('inspect_case')) {
      return {
        message: {
          role: 'assistant',
          content: `Inspecting trade-line and case metadata for ${caseId}.`,
          toolCalls: [
            {
              id: `call_${Date.now()}_inspect`,
              name: 'inspect_case',
              arguments: { caseId },
            },
          ],
        },
        finishReason: 'tool_calls',
        providerUsed: this.providerName,
        isMockOrFallback: true,
      };
    }

    // Step 1b: Prioritize advanced bureau dispute lifecycle states if already submitted, paused for consent, or resolved
    if (
      snapshot.latestDispute ||
      ['SUBMITTED', 'ADDITIONAL_INFORMATION_REQUIRED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'].includes(
        snapshot.caseRecord.workflowStatus
      )
    ) {
      // Check Consent Boundary (TC4)
      if (
        (snapshot.latestDispute?.currentStatus === 'ADDITIONAL_INFORMATION_REQUIRED' ||
          snapshot.caseRecord.workflowStatus === 'ADDITIONAL_INFORMATION_REQUIRED') &&
        !snapshot.caseRecord.consentGivenForIdUpload
      ) {
        return {
          message: {
            role: 'assistant',
            content:
              `Mock Bureau requires KYC identity verification (FCRA § 605B). ` +
              `Workflow paused safely at Consent Boundary: Explicit consumer consent is strictly required before any identity documentation can be transmitted. ` +
              `Pending consumer affirmative authorization.`,
          },
          finishReason: 'stop',
          providerUsed: this.providerName,
          isMockOrFallback: true,
        };
      }

      // Check Outcome Verification (TC3)
      if (
        (snapshot.latestDispute?.currentStatus === 'RESOLVED' ||
          snapshot.caseRecord.workflowStatus === 'RESOLVED') &&
        !snapshot.latestVerification &&
        !executedToolNames.includes('verify_report_correction')
      ) {
        return {
          message: {
            role: 'assistant',
            content: `Mock Bureau reports dispute as RESOLVED. Performing independent trade-line outcome audit.`,
            toolCalls: [
              {
                id: `call_${Date.now()}_verify`,
                name: 'verify_report_correction',
                arguments: { caseId },
              },
            ],
          },
          finishReason: 'tool_calls',
          providerUsed: this.providerName,
          isMockOrFallback: true,
        };
      }

      // Summarize verified outcome if already verified
      if (snapshot.latestVerification) {
        return {
          message: {
            role: 'assistant',
            content:
              `Independent Outcome Verification Concluded: ${snapshot.latestVerification.outcome}. ` +
              `${snapshot.latestVerification.explanation}`,
          },
          finishReason: 'stop',
          providerUsed: this.providerName,
          isMockOrFallback: true,
        };
      }
    }

    // Step 2: Evidence gathering if no evidence yet
    if (snapshot.evidence.length === 0 && !executedToolNames.includes('gather_bureau_evidence')) {
      return {
        message: {
          role: 'assistant',
          content: `Retrieving official bureau trade-line records to corroborate consumer file.`,
          toolCalls: [
            {
              id: `call_${Date.now()}_gather`,
              name: 'gather_bureau_evidence',
              arguments: {
                caseId,
                accountReference: snapshot.caseRecord.accountReference,
              },
            },
          ],
        },
        finishReason: 'tool_calls',
        providerUsed: this.providerName,
        isMockOrFallback: true,
      };
    }

    // Step 3: Classification evaluation if not evaluated
    if (!snapshot.latestClassification && !executedToolNames.includes('evaluate_classification')) {
      return {
        message: {
          role: 'assistant',
          content: `Evaluating credit trade-line against statutory FCRA standards and consumer certified statements.`,
          toolCalls: [
            {
              id: `call_${Date.now()}_eval`,
              name: 'evaluate_classification',
              arguments: {
                caseId,
                userFactsConfirmed: snapshot.report?.userFactConfirmed ?? true,
                userStatement: snapshot.report?.userConfirmedFacts ?? '',
              },
            },
          ],
        },
        finishReason: 'tool_calls',
        providerUsed: this.providerName,
        isMockOrFallback: true,
      };
    }

    // Step 4: If classification is ACCURATE_NEGATIVE (TC2 scenario)
    if (snapshot.latestClassification?.classification === 'ACCURATE_NEGATIVE') {
      return {
        message: {
          role: 'assistant',
          content:
            `Case Analysis Complete: The trade-line ${snapshot.caseRecord.accountReference} represents a verified accurate adverse entry (ACCURATE_NEGATIVE). ` +
            `Consumer admission confirms the delinquency. Pursuant to FCRA § 623 (15 U.S.C. § 1681s-2) and anti-frivolous dispute suppression rules, no dispute draft was created and no submission will occur.`,
        },
        finishReason: 'stop',
        providerUsed: this.providerName,
        isMockOrFallback: true,
      };
    }

    // Step 5: If classification is UNCERTAIN
    if (snapshot.latestClassification?.classification === 'UNCERTAIN') {
      return {
        message: {
          role: 'assistant',
          content:
            `Case Analysis Inconclusive: Missing critical statutory documentation or factual certifications. ` +
            `Dispute generation halted pending consumer factual clarification: ${snapshot.latestClassification.missingInformation.join(', ')}.`,
        },
        finishReason: 'stop',
        providerUsed: this.providerName,
        isMockOrFallback: true,
      };
    }

    // Step 6: If POTENTIAL_ERROR, generate dispute draft if not already generated
    if (!snapshot.activeDraft && !executedToolNames.includes('generate_dispute_draft')) {
      return {
        message: {
          role: 'assistant',
          content: `Trade-line identified as POTENTIAL_ERROR. Generating formal statutory dispute draft.`,
          toolCalls: [
            {
              id: `call_${Date.now()}_draft`,
              name: 'generate_dispute_draft',
              arguments: { caseId },
            },
          ],
        },
        finishReason: 'tool_calls',
        providerUsed: this.providerName,
        isMockOrFallback: true,
      };
    }

    // Step 7: Post-Drafting - Check Approval Boundary!
    // Check if human approval exists
    if (
      snapshot.activeDraft &&
      (!snapshot.activeApproval ||
        !snapshot.activeApproval.submissionEligibility ||
        snapshot.activeApproval.approvedDraftVersion !== snapshot.activeDraft.version)
    ) {
      // The agent reaches the MANDATORY APPROVAL BOUNDARY!
      // Must NOT submit without human approval!
      return {
        message: {
          role: 'assistant',
          content:
            `Dispute Draft v${snapshot.activeDraft.version} formulated successfully. ` +
            `HUMAN APPROVAL REQUIRED: In compliance with statutory safeguards, automated submission is strictly prohibited. ` +
            `Awaiting affirmative consumer / case officer approval on Draft v${snapshot.activeDraft.version} before any bureau dispatch.`,
        },
        finishReason: 'stop',
        providerUsed: this.providerName,
        isMockOrFallback: true,
      };
    }

    // Step 8: If approved, submit if not submitted yet
    if (
      snapshot.activeDraft &&
      snapshot.activeApproval?.submissionEligibility &&
      snapshot.activeApproval.approvedDraftVersion === snapshot.activeDraft.version &&
      !snapshot.latestDispute &&
      !executedToolNames.includes('submit_approved_dispute')
    ) {
      return {
        message: {
          role: 'assistant',
          content: `Affirmative human approval verified for Draft v${snapshot.activeDraft.version}. Submitting dispute to Mock Credit Bureau.`,
          toolCalls: [
            {
              id: `call_${Date.now()}_submit`,
              name: 'submit_approved_dispute',
              arguments: { caseId },
            },
          ],
        },
        finishReason: 'tool_calls',
        providerUsed: this.providerName,
        isMockOrFallback: true,
      };
    }

    // Step 9: If bureau dispute exists and status is ADDITIONAL_INFORMATION_REQUIRED (TC4)
    if (
      snapshot.latestDispute?.currentStatus === 'ADDITIONAL_INFORMATION_REQUIRED' &&
      !snapshot.caseRecord.consentGivenForIdUpload
    ) {
      return {
        message: {
          role: 'assistant',
          content:
            `Mock Bureau requires KYC identity verification (FCRA § 605B). ` +
            `WORKFLOW PAUSED: Explicit consumer consent is strictly required before any identity documentation can be transmitted. ` +
            `Pending consumer affirmative authorization.`,
        },
        finishReason: 'stop',
        providerUsed: this.providerName,
        isMockOrFallback: true,
      };
    }

    // Step 10: If bureau dispute exists and is RESOLVED or UNDER_REVIEW (TC3)
    if (
      snapshot.latestDispute?.currentStatus === 'RESOLVED' &&
      !snapshot.latestVerification &&
      !executedToolNames.includes('verify_report_correction')
    ) {
      return {
        message: {
          role: 'assistant',
          content: `Mock Bureau reports dispute as RESOLVED. Performing independent trade-line outcome audit.`,
          toolCalls: [
            {
              id: `call_${Date.now()}_verify`,
              name: 'verify_report_correction',
              arguments: { caseId },
            },
          ],
        },
        finishReason: 'tool_calls',
        providerUsed: this.providerName,
        isMockOrFallback: true,
      };
    }

    // If verification has been performed, summarize final outcome
    if (snapshot.latestVerification) {
      return {
        message: {
          role: 'assistant',
          content:
            `Independent Outcome Verification Concluded: ${snapshot.latestVerification.outcome}. ` +
            `${snapshot.latestVerification.explanation}`,
        },
        finishReason: 'stop',
        providerUsed: this.providerName,
        isMockOrFallback: true,
      };
    }

    // Default stopping point
    return {
      message: {
        role: 'assistant',
        content: `Workflow reached a stable state at status "${snapshot.caseRecord.workflowStatus}". No further automated actions required.`,
      },
      finishReason: 'stop',
      providerUsed: this.providerName,
      isMockOrFallback: true,
    };
  }
}

/**
 * Live LLM Client supporting OpenAI, Anthropic, and Gemini
 */
export class LiveLLMAdapter implements ModelAdapter {
  private readonly apiKey: string;
  private readonly provider: 'openai' | 'anthropic' | 'gemini';
  private readonly model: string;

  constructor(options?: {
    apiKey?: string;
    provider?: 'openai' | 'anthropic' | 'gemini';
    model?: string;
  }) {
    if (options?.apiKey) {
      this.apiKey = options.apiKey;
      this.provider = options.provider || 'openai';
      this.model = options.model || (this.provider === 'gemini' ? 'gemini-2.5-flash' : this.provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o');
    } else if (process.env.OPENAI_API_KEY) {
      this.apiKey = process.env.OPENAI_API_KEY;
      this.provider = 'openai';
      this.model = process.env.AI_MODEL || 'gpt-4o';
    } else if (process.env.ANTHROPIC_API_KEY) {
      this.apiKey = process.env.ANTHROPIC_API_KEY;
      this.provider = 'anthropic';
      this.model = process.env.AI_MODEL || 'claude-3-5-sonnet-20241022';
    } else if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      this.provider = 'gemini';
      this.model = process.env.AI_MODEL || 'gemini-2.5-flash';
    } else {
      throw new Error('No API key provided and no OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY set.');
    }
  }

  getProviderName(): string {
    return `Live LLM (${this.provider.toUpperCase()}: ${this.model})`;
  }

  async invoke(params: {
    messages: AgentMessage[];
    tools: AgentToolDefinition[];
    temperature?: number;
    timeoutMs?: number;
  }): Promise<ModelInvocationResult> {
    const timeout = params.timeoutMs || 20000;
    const signal = AbortSignal.timeout(timeout);

    if (this.provider === 'openai') {
      return this.invokeOpenAI(params, signal);
    } else if (this.provider === 'anthropic') {
      return this.invokeAnthropic(params, signal);
    } else {
      return this.invokeGemini(params, signal);
    }
  }

  private async invokeOpenAI(
    params: { messages: AgentMessage[]; tools: AgentToolDefinition[]; temperature?: number },
    signal: AbortSignal
  ): Promise<ModelInvocationResult> {
    const openAiTools = params.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const openAiMessages = params.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.toolCallId || 'call_default',
        };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return {
        role: m.role,
        content: m.content,
      };
    });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: openAiMessages,
        tools: openAiTools.length > 0 ? openAiTools : undefined,
        temperature: params.temperature ?? 0.1,
      }),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API returned HTTP ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as any;
    const choice = json.choices?.[0];
    const message = choice?.message;

    const toolCalls: ToolCallRequest[] = [];
    if (message?.tool_calls && Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        try {
          const args = JSON.parse(tc.function.arguments || '{}');
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: args,
          });
        } catch {
          // malformed args
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: {},
          });
        }
      }
    }

    return {
      message: {
        role: 'assistant',
        content: message?.content || '',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
      providerUsed: this.getProviderName(),
      isMockOrFallback: false,
      rawResponse: json,
    };
  }

  private async invokeAnthropic(
    params: { messages: AgentMessage[]; tools: AgentToolDefinition[]; temperature?: number },
    signal: AbortSignal
  ): Promise<ModelInvocationResult> {
    const systemMsg = params.messages.find((m) => m.role === 'system')?.content || '';
    const nonSystem = params.messages.filter((m) => m.role !== 'system');

    const anthropicTools = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

    const anthropicMessages = nonSystem.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId || 'call_default',
              content: m.content,
            },
          ],
        };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        const blocks: any[] = [];
        if (m.content) {
          blocks.push({ type: 'text', text: m.content });
        }
        for (const tc of m.toolCalls) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        return {
          role: 'assistant',
          content: blocks,
        };
      }
      return {
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      };
    });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        system: systemMsg,
        messages: anthropicMessages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
        max_tokens: 1500,
        temperature: params.temperature ?? 0.1,
      }),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API returned HTTP ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as any;
    let content = '';
    const toolCalls: ToolCallRequest[] = [];

    if (Array.isArray(json.content)) {
      for (const block of json.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input || {},
          });
        }
      }
    }

    return {
      message: {
        role: 'assistant',
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
      providerUsed: this.getProviderName(),
      isMockOrFallback: false,
      rawResponse: json,
    };
  }

  private async invokeGemini(
    params: { messages: AgentMessage[]; tools: AgentToolDefinition[]; temperature?: number },
    signal: AbortSignal
  ): Promise<ModelInvocationResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const systemInstruction = params.messages.find((m) => m.role === 'system')?.content;

    const contents = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'function',
            parts: [
              {
                functionResponse: {
                  name: m.name || 'tool_response',
                  response: { content: m.content },
                },
              },
            ],
          };
        }
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          return {
            role: 'model',
            parts: m.toolCalls.map((tc) => ({
              functionCall: {
                name: tc.name,
                args: tc.arguments,
              },
            })),
          };
        }
        return {
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        };
      });

    const functionDeclarations = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        contents,
        tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
        generationConfig: {
          temperature: params.temperature ?? 0.1,
        },
      }),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API returned HTTP ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as any;
    const candidate = json.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let content = '';
    const toolCalls: ToolCallRequest[] = [];

    for (const part of parts) {
      if (part.text) {
        content += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args || {},
        });
      }
    }

    return {
      message: {
        role: 'assistant',
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
      providerUsed: this.getProviderName(),
      isMockOrFallback: false,
      rawResponse: json,
    };
  }
}

/**
 * Factory to obtain the active model adapter
 */
export function getActiveModelAdapter(preferred?: ModelAdapter): ModelAdapter {
  if (preferred) return preferred;

  const hasKey =
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (hasKey) {
    try {
      return new LiveLLMAdapter();
    } catch (err) {
      console.warn('Failed to initialize LiveLLMAdapter despite key; falling back to DeterministicRuleAgentModel:', err);
      return new DeterministicRuleAgentModel();
    }
  }

  return new DeterministicRuleAgentModel();
}
