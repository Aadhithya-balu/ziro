import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';


export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM test_runs ORDER BY run_timestamp DESC LIMIT 50`).all() as any[];

    const results = rows.map((r) => ({
      id: r.id,
      scenarioId: r.scenario_id,
      title: r.title,
      status: r.status,
      result: JSON.parse(r.result_payload || '{}'),
      runTimestamp: r.run_timestamp,
    }));

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
