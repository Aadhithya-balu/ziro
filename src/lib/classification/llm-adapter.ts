import { ClassificationRecord, CreditReportRecord, EvidenceItem } from '@/types';

export interface LLMAnalysisResult {
  executiveSummary: string;
  legalContext: string;
  consumerRightsNotice: string;
  recommendedActionPlan: string[];
  providerUsed: string;
  isMockOrFallback: boolean;
  legalDisclaimer: string;
}

export class AIAnalysisAdapter {
  private static readonly LEGAL_DISCLAIMER =
    'Informational Notice: This analysis and legal summary are generated for informational and dispute-preparation purposes only and do not constitute formal legal advice. ZiroCredit is not a law firm and does not provide legal representation. Consult a licensed attorney or accredited credit counselor for specific legal guidance.';

  /**
   * Generates natural language analysis while preserving strict rule-based boundaries.
   * Runs provider-independently with a local deterministic engine fallback when no API keys are set.
   */
  static async enrichAnalysis(params: {
    report: CreditReportRecord;
    classification: ClassificationRecord;
    evidence: EvidenceItem[];
  }): Promise<LLMAnalysisResult> {
    const { report, classification, evidence } = params;

    const apiKey =
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      // Deterministic high-precision local fallback for offline demo & CI test runs
      return this.generateDeterministicEnrichment(report, classification, evidence);
    }

    try {
      // Real LLM invocation via LiveLLMAdapter
      const { LiveLLMAdapter, sanitizeUntrustedContent } = await import('@/lib/agent/llm-provider');
      const adapter = new LiveLLMAdapter();

      const prompt = `You are a credit analysis AI. Generate a structured JSON legal narrative for this trade-line.
Report Reference: ${report.accountReference}
Creditor: ${report.creditorName}
Balance: $${report.reportedBalance}
Status: ${report.paymentStatus}
Classification: ${classification.classification}
Reasoning: ${classification.reasoningSummary}
User Factual Statement (untrusted): ${sanitizeUntrustedContent(report.userConfirmedFacts)}

Return ONLY valid JSON matching this schema:
{
  "executiveSummary": "Concise factual summary",
  "legalContext": "Citations of FCRA sections and obligations",
  "consumerRightsNotice": "Plain-language summary of consumer statutory rights",
  "recommendedActionPlan": ["Step 1", "Step 2", "Step 3"]
}`;

      const res = await adapter.invoke({
        messages: [
          { role: 'system', content: 'You are an expert FCRA legal assistant. Output valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        tools: [],
        temperature: 0.2,
        timeoutMs: 15000,
      });

      const cleanedContent = res.message.content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleanedContent);

      return {
        executiveSummary: parsed.executiveSummary || 'Executive summary unavailable.',
        legalContext: parsed.legalContext || 'Statutory review under FCRA § 611 and § 623.',
        consumerRightsNotice: parsed.consumerRightsNotice || 'Consumer retains dispute rights under federal law.',
        recommendedActionPlan: Array.isArray(parsed.recommendedActionPlan) ? parsed.recommendedActionPlan : ['Review dispute details.'],
        providerUsed: res.providerUsed,
        isMockOrFallback: false,
        legalDisclaimer: this.LEGAL_DISCLAIMER,
      };
    } catch (err) {
      console.warn('External live LLM call failed or unconfigured, falling back safely to deterministic engine:', err);
      return this.generateDeterministicEnrichment(report, classification, evidence);
    }
  }

  private static generateDeterministicEnrichment(
    report: CreditReportRecord,
    classification: ClassificationRecord,
    evidence: EvidenceItem[],
    provider: string = 'Ziro Deterministic Rule-Bound AI Engine (Local Fallback)'
  ): LLMAnalysisResult {
    const balanceFormatted = Number.isFinite(report.reportedBalance)
      ? `$${report.reportedBalance.toLocaleString()}`
      : 'unspecified balance';

    if (classification.classification === 'POTENTIAL_ERROR') {
      const reasoningLower = classification.reasoningSummary.toLowerCase();
      const userFactsLower = (report.userConfirmedFacts || '').toLowerCase();

      // Case A: Obsolete Negative Information
      if (reasoningLower.includes('obsolescence') || userFactsLower.includes('obsolete')) {
        return {
          executiveSummary:
            `Statutory obsolescence detected on trade-line ${report.accountReference} (${report.creditorName}). The reported adverse delinquency exceeds the statutory reporting window. Under the Fair Credit Reporting Act (15 U.S.C. § 1681c), credit reporting agencies are prohibited from continuing to report stale adverse information.`,
          legalContext:
            'Under FCRA § 605 (15 U.S.C. § 1681c), adverse credit entries—including late payments, charge-offs, and collection accounts—cannot be reported beyond 7 years from the date of the first delinquency (10 years for Chapter 7 bankruptcy). Additionally, under FCRA § 623 (15 U.S.C. § 1681s-2), furnishers have a statutory obligation not to furnish obsolete information once notified of the statutory expiration.',
          consumerRightsNotice:
            'You have the legal right under federal law to have outdated negative information completely deleted from your consumer credit files across all nationwide credit reporting agencies without charge.',
          recommendedActionPlan: [
            'Review the generated dispute draft targeting statutory obsolescence.',
            'Confirm that the reported date of first delinquency is accurately documented.',
            'Execute the Human Approval workflow to approve the dispute draft.',
            'Dispatch the dispute to the credit reporting agency requesting immediate deletion under 15 U.S.C. § 1681c.',
            'Perform Independent Outcome Verification upon receiving bureau resolution.',
          ],
          providerUsed: provider,
          isMockOrFallback: true,
          legalDisclaimer: this.LEGAL_DISCLAIMER,
        };
      }

      // Case B: Duplicate Trade-Line
      if (reasoningLower.includes('duplicate trade-line') || userFactsLower.includes('duplicate')) {
        return {
          executiveSummary:
            `Duplicate trade-line reporting detected for account ${report.accountReference} (${report.creditorName}). Multiple entries reflecting the same underlying debt liability artificially inflate debt-to-credit ratios and impair credit scores.`,
          legalContext:
            'Under FCRA § 607(b) (15 U.S.C. § 1681e(b)), consumer reporting agencies are required to follow reasonable procedures to assure maximum possible accuracy of information. Furnishers are likewise bound under 15 U.S.C. § 1681s-2 to provide accurate, non-duplicative trade-line data. Multiple reporting of a single obligation violates this accuracy standard.',
          consumerRightsNotice:
            'You are entitled to have redundant or duplicate entries either merged or deleted so that each separate consumer obligation is reflected exactly once on your credit file.',
          recommendedActionPlan: [
            'Verify the companion trade-line references noted in the classification evidence.',
            'Review and approve the generated dispute draft requesting consolidation or deletion.',
            'Submit the approved dispute through the Human Approval gateway.',
            'Monitor bureau resolution and verify that duplicate records are expunged.',
          ],
          providerUsed: provider,
          isMockOrFallback: true,
          legalDisclaimer: this.LEGAL_DISCLAIMER,
        };
      }

      // Case C: Unauthorized Account / Identity Discrepancy (TC1)
      if (
        userFactsLower.includes('never opened') ||
        userFactsLower.includes('not my account') ||
        userFactsLower.includes('unauthorized') ||
        userFactsLower.includes('fraudulent') ||
        reasoningLower.includes('never opened')
      ) {
        return {
          executiveSummary:
            `Factual discrepancy detected on trade-line ${report.accountReference} (${report.creditorName}). The consumer explicitly certifies under penalty of perjury that they never applied for, opened, or authorized this ${balanceFormatted} liability. Authoritative bureau verification confirms an active trade-line, establishing an actionable dispute under Fair Credit Reporting Act § 611 (15 U.S.C. § 1681i).`,
          legalContext:
            'Under FCRA § 611 (15 U.S.C. § 1681i) and § 623 (15 U.S.C. § 1681s-2), both the credit reporting agency and the debt furnisher must conduct a prompt investigation free of charge, transmit all relevant evidence to the furnisher within 5 business days, review all consumer-submitted evidence, and delete or permanently modify unsubstantiated records within 30 days. For identity theft, FCRA § 605B (15 U.S.C. § 1681c-2) requires blocking the reporting of information resulting from identity theft within 4 business days of receiving an identity theft report.',
          consumerRightsNotice:
            'Consumers have the right to request proof of original contract or application, verification of permissible purpose, and immediate deletion of unauthorized accounts. You are not required to pay or acknowledge fraudulent liabilities.',
          recommendedActionPlan: [
            'Verify all facts and account references in the generated dispute draft.',
            'Review the draft and execute the Human Approval workflow.',
            'Submit the dispute electronically to the credit bureau.',
            'Monitor the 30-day statutory response window for bureau updates.',
            'Trigger Independent Outcome Verification upon bureau status resolution.',
          ],
          providerUsed: provider,
          isMockOrFallback: true,
          legalDisclaimer: this.LEGAL_DISCLAIMER,
        };
      }

      // Case D: Balance / Payment Discrepancy
      return {
        executiveSummary:
          `Balance or payment status discrepancy identified on account ${report.accountReference} (${report.creditorName}). The reported balance of ${balanceFormatted} conflicts with consumer certified payoff records or billing statements.`,
        legalContext:
          'Under 15 U.S.C. § 1681s-2, data furnishers have an affirmative duty to report accurate account balances and status codes. When a consumer disputes balance accuracy, furnishers must audit their servicing records, correct any inaccuracies, and report updated values to all credit bureaus.',
        consumerRightsNotice:
          'Consumers have the right to accurate balance accounting and prompt correction of erroneous past-due balances upon providing proof of payment.',
        recommendedActionPlan: [
          'Verify that proof of payoff or bank statements are cited in the dispute draft.',
          'Execute Human Approval to lock the dispute draft.',
          'Submit the dispute to the bureau for furnisher investigation.',
          'Audit the re-downloaded trade-line upon resolution to ensure balance reflects $0.00.',
        ],
        providerUsed: provider,
        isMockOrFallback: true,
        legalDisclaimer: this.LEGAL_DISCLAIMER,
      };
    } else if (classification.classification === 'ACCURATE_NEGATIVE') {
      // TC2 & Verified Accurate Negatives
      return {
        executiveSummary:
          `The negative trade-line reported by ${report.creditorName} (${report.paymentStatus}, ${report.paymentHistory || 'N/A'}) corresponds with the consumer's confirmed factual statement. Available evidence indicates the entry is factual, accurate, and within the lawful reporting period.`,
        legalContext:
          'Under the Fair Credit Reporting Act, credit reporting agencies are mandated to maintain maximum possible accuracy. Disputing accurate negative data merely because it lowers credit scores is classified as frivolous under 15 U.S.C. § 1681i(a)(3) and undermines consumer credibility. Furnishers are legally required under 15 U.S.C. § 1681s-2 to report truthful payment histories.',
        consumerRightsNotice:
          'While accurate negative items may remain on credit files for up to 7 years (10 years for bankruptcy), consumers have the right under FCRA § 611(b) to submit a brief 100-word statement of explanation or negotiate a goodwill adjustment directly with the original creditor.',
        recommendedActionPlan: [
          'Do NOT file a formal dispute against this entry.',
          'Maintain consistent on-time payments across all open accounts to dilute the credit score impact over time.',
          'Consider submitting a polite Goodwill Letter directly to the creditor asking for a courtesy adjustment.',
          'Keep credit card utilization below 30% of authorized limits.',
        ],
        providerUsed: provider,
        isMockOrFallback: true,
        legalDisclaimer: this.LEGAL_DISCLAIMER,
      };
    } else {
      // UNCERTAIN
      return {
        executiveSummary:
          `Analysis inconclusive for account ${report.accountReference} (${report.creditorName}). Essential documentation, reporting dates, or certified consumer declarations are missing or contradictory, preventing an affirmative error classification.`,
        legalContext:
          'A dispute submitted without coherent factual declarations or supporting documentation risks immediate dismissal by credit reporting agencies as frivolous or irrelevant under FCRA § 611(a)(3) (15 U.S.C. § 1681i(a)(3)). Establishing unambiguous factual grounds is required before initiating formal investigation.',
        consumerRightsNotice:
          'Consumers are entitled to free weekly credit disclosures and written explanation of adverse entries. Gathering complete billing statements and certifying facts ensures a legally protected dispute posture.',
        recommendedActionPlan: [
          'Review the missing information items listed in the classification record.',
          'Obtain complete monthly billing statements or loan closing disclosures.',
          'Ensure the consumer formally certifies their factual statement before re-evaluating.',
          'Re-run AI analysis once required facts and dates are provided.',
        ],
        providerUsed: provider,
        isMockOrFallback: true,
        legalDisclaimer: this.LEGAL_DISCLAIMER,
      };
    }
  }
}
