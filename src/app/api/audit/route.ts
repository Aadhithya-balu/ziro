import { NextResponse } from 'next/server';
import { getAuditEvents } from '@/lib/audit/logger';


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId') || undefined;
    const limit = Number(searchParams.get('limit') || 100);

    const events = getAuditEvents(caseId, limit);
    return NextResponse.json({ events, count: events.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
