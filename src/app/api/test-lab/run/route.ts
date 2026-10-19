import { NextResponse } from 'next/server';
import { TestScenarioRunner } from '@/lib/scenarios/runner';
import { z } from 'zod';


const RunSchema = z.object({
  scenarioId: z.enum(['TC1', 'TC2', 'TC3', 'TC4', 'ALL']),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const validated = RunSchema.parse(json);

    let results;
    if (validated.scenarioId === 'TC1') {
      results = [await TestScenarioRunner.runTC1()];
    } else if (validated.scenarioId === 'TC2') {
      results = [await TestScenarioRunner.runTC2()];
    } else if (validated.scenarioId === 'TC3') {
      results = [await TestScenarioRunner.runTC3()];
    } else if (validated.scenarioId === 'TC4') {
      results = [await TestScenarioRunner.runTC4()];
    } else {
      results = await TestScenarioRunner.runAll();
    }

    const allPassed = results.every((r) => r.status === 'PASS');

    return NextResponse.json({
      success: true,
      allPassed,
      count: results.length,
      results,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 });
    }
    console.error('Test execution error:', error);
    return NextResponse.json({ error: error.message || 'Test execution failed' }, { status: 500 });
  }
}
