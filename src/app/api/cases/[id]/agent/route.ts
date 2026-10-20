import { NextResponse } from 'next/server';
import { AgentOrchestrator } from '@/lib/agent/orchestrator';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is allowed
    }

    const result = await AgentOrchestrator.runCase({
      caseId,
      goal: body.goal,
      maxIterations: body.maxIterations,
      requireLiveModel: body.requireLiveModel,
    });

    return NextResponse.json({
      success: true,
      agentResult: result,
      message: result.finalSummary,
    });
  } catch (error: any) {
    console.error('Agent run failed:', error);
    return NextResponse.json(
      { error: error.message || 'Agent orchestration error' },
      { status: 500 }
    );
  }
}
