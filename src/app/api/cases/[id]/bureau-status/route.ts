import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { MockCreditBureauPortal } from '@/lib/bureau/mock-portal';
import { logAuditEvent } from '@/lib/audit/logger';
import { z } from 'zod';


const UpdateBureauStatusSchema = z.object({
  newStatus: z.enum([
    'SUBMITTED',
    'UNDER_REVIEW',
    'ADDITIONAL_INFORMATION_REQUIRED',
    'RESOLVED',
    'REJECTED',
    'FAILED',
  ]),
  notes: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const db = getDb();
    const dispute = db
      .prepare(`SELECT * FROM mock_bureau_disputes WHERE case_id = ? ORDER BY submission_timestamp DESC LIMIT 1`)
      .get(caseId) as any;

    if (!dispute) {
      return NextResponse.json({ error: 'No dispute submitted for this case yet.' }, { status: 404 });
    }

    return NextResponse.json({
      disputeId: dispute.id,
      status: dispute.current_status,
      lastUpdated: dispute.last_bureau_update_timestamp,
      verificationStatus: dispute.verification_status,
      idRequestReason: dispute.id_request_reason,
      mockPortalReference: dispute.mock_portal_reference,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const json = await request.json();
    const validated = UpdateBureauStatusSchema.parse(json);

    const db = getDb();
    const dispute = db
      .prepare(`SELECT * FROM mock_bureau_disputes WHERE case_id = ? ORDER BY submission_timestamp DESC LIMIT 1`)
      .get(caseId) as any;

    if (!dispute) {
      return NextResponse.json({ error: 'No dispute found to update' }, { status: 404 });
    }

    const previousStatus = dispute.current_status;

    // Update in mock bureau
    MockCreditBureauPortal.updateDisputeStatus(dispute.id, validated.newStatus, validated.notes);

    // Update case workflow status
    db.prepare(`
      UPDATE cases
      SET workflow_status = ?, updated_at = ?
      WHERE id = ?
    `).run(validated.newStatus, new Date().toISOString(), caseId);

    // Record audit event
    logAuditEvent({
      caseId,
      eventType: 'BUREAU_STATUS_UPDATED',
      previousState: previousStatus,
      newState: validated.newStatus,
      actionResult: `Mock Bureau updated dispute ${dispute.id} status to ${validated.newStatus}. Notes: ${validated.notes || 'None'}`,
      metadata: {
        disputeId: dispute.id,
        notes: validated.notes,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Dispute status transitioned from ${previousStatus} to ${validated.newStatus}.`,
      currentStatus: validated.newStatus,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
