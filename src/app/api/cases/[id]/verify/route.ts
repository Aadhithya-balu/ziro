import { NextResponse } from 'next/server';
import { IndependentVerificationEngine } from '@/lib/verification/engine';


export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const verification = IndependentVerificationEngine.verifyOutcome(caseId);

    return NextResponse.json({
      success: true,
      verification,
      message: `Independent outcome verification concluded: ${verification.outcome}.`,
    });
  } catch (error: any) {
    console.error('Verification failed:', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 });
  }
}
