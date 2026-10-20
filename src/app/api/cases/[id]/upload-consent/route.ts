import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { z } from 'zod';


const ConsentSchema = z.object({
  consentGiven: z.boolean(),
  documentType: z.enum(['GOVERNMENT_PHOTO_ID', 'UTILITY_BILL', 'PASSPORT']),
  consumerDeclaration: z.string().min(3),
  simulateUploadFailure: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const json = await request.json();
    const validated = ConsentSchema.parse(json);

    const db = getDb();
    const caseRow = db.prepare(`SELECT * FROM cases WHERE id = ?`).get(caseId) as any;
    if (!caseRow) {
      return NextResponse.json({ error: `Case ${caseId} not found.` }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (!validated.consentGiven) {
      logAuditEvent({
        caseId,
        eventType: 'CONSUMER_ID_CONSENT_DECLINED',
        previousState: caseRow.workflow_status,
        newState: caseRow.workflow_status,
        actionResult: `Consumer declined consent for ${validated.documentType} upload. Workflow remains paused at ${caseRow.workflow_status}.`,
        metadata: {
          documentType: validated.documentType,
          consentGiven: false,
        },
      });

      return NextResponse.json(
        { error: 'Explicit affirmative consent is strictly required before identity documentation can be processed.' },
        { status: 400 }
      );
    }

    // Consent was affirmatively granted
    if (validated.simulateUploadFailure) {
      // Record consent, but upload itself fails - workflow does NOT resume to UNDER_REVIEW
      db.prepare(`
        UPDATE cases
        SET consent_given_for_id_upload = 1, updated_at = ?
        WHERE id = ?
      `).run(now, caseId);

      logAuditEvent({
        caseId,
        eventType: 'CONSUMER_ID_UPLOAD_FAILED',
        previousState: caseRow.workflow_status,
        newState: caseRow.workflow_status,
        actionResult: `Consent recorded for ${validated.documentType}, but mock document upload transmission failed. Workflow remains paused.`,
        errorDetails: 'Simulated bureau upload transmission error.',
        metadata: {
          documentType: validated.documentType,
          consentGiven: true,
          uploadSuccess: false,
        },
      });

      return NextResponse.json(
        {
          success: false,
          consentRecorded: true,
          uploadSuccess: false,
          error: 'Document upload transmission failed: Simulated network/bureau ingestion error.',
        },
        { status: 502 }
      );
    }

    // Affirmative consent AND successful document upload
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
      actionResult: `Consumer explicitly authorized transmission of ${validated.documentType} to Mock Bureau. Document transmitted successfully.`,
      metadata: {
        documentType: validated.documentType,
        declaration: validated.consumerDeclaration,
        consentGiven: true,
        uploadSuccess: true,
      },
    });

    return NextResponse.json({
      success: true,
      consentRecorded: true,
      uploadSuccess: true,
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
