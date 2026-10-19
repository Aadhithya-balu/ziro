import { NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/db/seed';


export async function POST(request: Request) {
  try {
    let force = false;
    try {
      const body = await request.json();
      force = Boolean(body?.force);
    } catch {
      // default force = false
    }

    const res = seedDatabase(force);
    return NextResponse.json({ success: true, ...res });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Seed error' }, { status: 500 });
  }
}
