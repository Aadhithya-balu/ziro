import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { z } from 'zod';


const ConsentSchema = z.object({
  consentGiven: z.boolean(),
  documentType: z.enum(['GOVERNMENT_PHOTO_ID', 'UTILITY_BILL', 'PASSPORT']),
  consumerDeclaration: z.string().min(3),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const json = await request.json();
    const validated = ConsentSchema.parse(json);

    if (!validated.consentGiven) {
      return NextResponse.json(
        { error: 'Explicit affirmative consent is strictly required before identity documentation can be processed.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE cases
      SET consent_given_for_id_upload = 1, workflow_status = 'UNDER_REVIEW', updated_at = ?
      WHERE id = ?
    `).run(now, caseId);

    // Also update dispute in mock bureau
    const disputeRow = db.prepare(`SELECT id FROM mock_bureau_disputes WHERE case_id = ?`).get(caseId) as any;
    if (disputeRow) {
      db.prepare(`
        UPDATE mock_bureau_disputes
        SET current_status = 'UNDER_REVIEW', last_bureau_update_timestamp = ?
        WHERE id = ?
      `).run(now, disputeRow.id);
    }

    logAuditEvent({
      caseId,
      eventType: 'CONSUMER_ID_CONSENT_GRANTED',
      previousState: 'ADDITIONAL_INFORMATION_REQUIRED',
      newState: 'UNDER_REVIEW',
      actionResult: `Consumer explicitly authorized transmission of ${validated.documentType} to Mock Bureau.`,
      metadata: {
        documentType: validated.documentType,
        declaration: validated.consumerDeclaration,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Explicit consent recorded. Simulated ID document transmitted securely to Mock Bureau. Workflow resumed to UNDER_REVIEW.',
      workflowStatus: 'UNDER_REVIEW',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
