import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ApprovalEngine } from '@/lib/approval/engine';
import { z } from 'zod';


const UpdateDraftSchema = z.object({
  disputedField: z.string().optional(),
  userConfirmedStatement: z.string().optional(),
  explanationOfDiscrepancy: z.string().optional(),
  requestedCorrection: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const db = getDb();
    const draft = db
      .prepare(`SELECT * FROM dispute_drafts WHERE case_id = ? ORDER BY version DESC LIMIT 1`)
      .get(caseId) as any;

    if (!draft) {
      return NextResponse.json({ error: 'No draft found for this case' }, { status: 404 });
    }

    return NextResponse.json({
      draft: {
        id: draft.id,
        caseId: draft.case_id,
        version: Number(draft.version),
        bureauAccountReference: draft.bureau_account_reference,
        disputedField: draft.disputed_field,
        userConfirmedStatement: draft.user_confirmed_statement,
        relevantSupportingEvidence: draft.relevant_supporting_evidence,
        explanationOfDiscrepancy: draft.explanation_of_discrepancy,
        requestedCorrection: draft.requested_correction,
        evidenceReferences: JSON.parse(draft.evidence_references || '[]'),
        createdAt: draft.created_at,
        updatedAt: draft.updated_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const json = await request.json();
    const validated = UpdateDraftSchema.parse(json);

    const updatedDraft = ApprovalEngine.updateDraft({
      caseId,
      disputedField: validated.disputedField,
      userConfirmedStatement: validated.userConfirmedStatement,
      explanationOfDiscrepancy: validated.explanationOfDiscrepancy,
      requestedCorrection: validated.requestedCorrection,
    });

    return NextResponse.json({
      success: true,
      message: `Draft updated to version v${updatedDraft.version}. Prior approvals have been invalidated. Re-approval is required before submission.`,
      draft: updatedDraft,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
