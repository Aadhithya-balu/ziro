import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ApprovalEngine } from '@/lib/approval/engine';
import { MockCreditBureauPortal } from '@/lib/bureau/mock-portal';
import { logAuditEvent } from '@/lib/audit/logger';


export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;

    // 1. Strict Server-Side Validation: Never trust frontend flags!
    const eligibility = ApprovalEngine.validateSubmissionEligibility(caseId);
    if (!eligibility.eligible || !eligibility.approval || !eligibility.draft) {
      return NextResponse.json(
        {
          error: 'Submission Rejected by Security Rules',
          reason: eligibility.reason || 'Missing required affirmative human approval or draft version mismatch.',
        },
        { status: 403 }
      );
    }

    const { approval, draft } = eligibility;
    const db = getDb();
    const caseRow = db.prepare(`SELECT * FROM cases WHERE id = ?`).get(caseId) as any;

    // Idempotency Key bound to exact case and draft version
    const idempotencyKey = `IDEMP-${caseId}-V${draft.version}`;

    // Optional simulation flag from request body
    let simulateIdRequest = false;
    try {
      const body = await request.json();
      simulateIdRequest = Boolean(body?.simulateIdRequest);
    } catch {
      // Empty body is fine
    }

    // Submit to Mock Bureau
    const submission = MockCreditBureauPortal.submitDispute({
      caseId,
      approvedDraftVersion: draft.version,
      approvalId: approval.id,
      bureauAccountRef: draft.bureauAccountReference,
      disputeReason: draft.explanationOfDiscrepancy,
      idempotencyKey,
      simulateIdRequest,
    });

    const now = new Date().toISOString();
    const newWorkflowStatus = submission.status;

    // Update case record with active dispute and new status
    db.prepare(`
      UPDATE cases
      SET active_dispute_id = ?, workflow_status = ?, updated_at = ?
      WHERE id = ?
    `).run(submission.disputeId, newWorkflowStatus, now, caseId);

    // Record audit event
    logAuditEvent({
      caseId,
      eventType: 'DISPUTE_SUBMITTED_TO_BUREAU',
      previousState: caseRow.workflow_status,
      newState: newWorkflowStatus,
      approvalReference: approval.id,
      actionResult: `Lodged dispute with Mock Bureau. Dispute ID: ${submission.disputeId}. Status: ${submission.status}.`,
      metadata: {
        disputeId: submission.disputeId,
        idempotencyKey,
        approvedDraftVersion: draft.version,
        requiresIdentification: submission.requiresIdentification,
      },
    });

    return NextResponse.json({
      success: true,
      dispute: submission,
      message: submission.message,
    });
  } catch (error: any) {
    console.error('Submission failed:', error);
    return NextResponse.json({ error: error.message || 'Submission error' }, { status: 500 });
  }
}
