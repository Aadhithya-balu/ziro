import { NextResponse } from 'next/server';
import { ApprovalEngine } from '@/lib/approval/engine';
import { z } from 'zod';


const ApprovalSchema = z.object({
  draftVersion: z.number().int().min(1, 'Draft version must be positive integer'),
  action: z.enum(['APPROVED', 'REJECTED', 'REQUEST_MORE_INFO']),
  reviewedBy: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const json = await request.json();
    const validated = ApprovalSchema.parse(json);

    const approval = ApprovalEngine.processApproval({
      caseId,
      draftVersion: validated.draftVersion,
      action: validated.action,
      reviewedBy: validated.reviewedBy,
      notes: validated.notes,
    });

    return NextResponse.json({
      success: true,
      approval,
      message:
        validated.action === 'APPROVED'
          ? `Dispute draft v${validated.draftVersion} successfully approved for submission.`
          : `Dispute draft marked as ${validated.action}.`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Approval processing failed' }, { status: 400 });
  }
}
