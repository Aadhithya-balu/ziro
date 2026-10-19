import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ClassificationEngine } from '@/lib/classification/engine';
import { AIAnalysisAdapter } from '@/lib/classification/llm-adapter';
import { logAuditEvent } from '@/lib/audit/logger';
import { MockCreditBureauPortal } from '@/lib/bureau/mock-portal';
import { CreditReportRecord, EvidenceItem } from '@/types';


export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const db = getDb();

    const caseRow = db.prepare(`SELECT * FROM cases WHERE id = ?`).get(caseId) as any;
    if (!caseRow) {
      return NextResponse.json({ error: `Case ${caseId} not found.` }, { status: 404 });
    }

    const reportRow = db.prepare(`SELECT * FROM credit_reports WHERE case_id = ?`).get(caseId) as any;
    if (!reportRow) {
      return NextResponse.json(
        { error: `No credit report data found on case ${caseId}.` },
        { status: 400 }
      );
    }

    const report: CreditReportRecord = {
      id: reportRow.id,
      caseId: reportRow.case_id,
      accountReference: reportRow.account_reference,
      creditorName: reportRow.creditor_name,
      accountType: reportRow.account_type,
      reportedBalance: Number(reportRow.reported_balance),
      paymentStatus: reportRow.payment_status,
      paymentHistory: reportRow.payment_history,
      openedDate: reportRow.opened_date,
      reportedDate: reportRow.reported_date,
      delinquencyDate: reportRow.delinquency_date,
      userConfirmedFacts: reportRow.user_confirmed_facts,
      discrepancyReason: reportRow.discrepancy_reason,
      userFactConfirmed: Boolean(reportRow.user_fact_confirmed),
      sourceReportRef: reportRow.source_report_ref,
      extractionTimestamp: reportRow.extraction_timestamp,
      extractedValues: JSON.parse(reportRow.extracted_values || '{}'),
      attachedEvidenceNotes: reportRow.attached_evidence_notes,
    };

    // Ensure authoritative bureau evidence is gathered
    let evidenceRows = db.prepare(`SELECT * FROM evidence WHERE case_id = ?`).all(caseId) as any[];
    if (evidenceRows.length === 0) {
      MockCreditBureauPortal.generateEvidenceFromBureau(caseId, report.accountReference);
      evidenceRows = db.prepare(`SELECT * FROM evidence WHERE case_id = ?`).all(caseId) as any[];
    }

    const evidence: EvidenceItem[] = evidenceRows.map((e) => ({
      id: e.id,
      caseId: e.case_id,
      sourceName: e.source_name,
      mockSourceRecordId: e.mock_source_record_id,
      retrievalTimestamp: e.retrieval_timestamp,
      relevantExtractedValues: JSON.parse(e.relevant_extracted_values || '{}'),
      sourceUrlOrRoute: e.source_url_or_route,
      verificationStatus: e.verification_status,
      label: e.label,
      details: e.details,
    }));

    // Evaluate classification
    const evalResult = ClassificationEngine.evaluate({
      report,
      evidence,
      userFacts: {
        confirmed: report.userFactConfirmed,
        statement: report.userConfirmedFacts,
      },
    });

    const classificationRecord = ClassificationEngine.saveClassification(
      caseId,
      evalResult,
      evidence.map((e) => e.id)
    );

    // AI narrative enrichment (legal citations, rights summary, provider independence)
    const aiEnrichment = await AIAnalysisAdapter.enrichAnalysis({
      report,
      classification: classificationRecord,
      evidence,
    });

    // Draft dispute if POTENTIAL_ERROR
    let draft = null;
    if (classificationRecord.classification === 'POTENTIAL_ERROR') {
      draft = ClassificationEngine.generateDraft(report, classificationRecord, evidence);
    }

    logAuditEvent({
      caseId,
      eventType: 'CLASSIFICATION_ANALYSIS_COMPLETED',
      previousState: caseRow.workflow_status,
      newState: classificationRecord.classification === 'POTENTIAL_ERROR' ? 'AWAITING_APPROVAL' : 'ANALYZED',
      actionResult: `Analyzed case with result: ${classificationRecord.classification} (Confidence: ${classificationRecord.confidenceScore})`,
      metadata: {
        classification: classificationRecord.classification,
        hasDraft: !!draft,
        draftId: draft?.id,
      },
    });

    return NextResponse.json({
      success: true,
      classification: classificationRecord,
      aiEnrichment,
      draft,
    });
  } catch (error: any) {
    console.error('Failed to run analysis:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
