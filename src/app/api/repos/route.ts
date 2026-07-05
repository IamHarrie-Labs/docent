import { NextResponse } from 'next/server';
import { listRepos } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/repos — previously analyzed repos (Docent remembers them). */
export async function GET() {
  return NextResponse.json({ repos: listRepos() });
}
