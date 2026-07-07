import { NextRequest, NextResponse } from 'next/server';
import { getSnapshots } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/snapshot?repoId=1&sha=abc123
 * Every agent report (plus the debate and memory briefing, saved under the
 * pseudo-agent ids "debate" and "memory") for a given repo at a given commit.
 * Lets the analyze page restore a past session — reload, come back tomorrow,
 * whatever — instead of losing chat and the reports the moment the tab closes.
 */
export async function GET(req: NextRequest) {
  const repoId = Number(req.nextUrl.searchParams.get('repoId'));
  const sha = req.nextUrl.searchParams.get('sha');
  if (!repoId || !sha) {
    return NextResponse.json({ error: 'repoId and sha required' }, { status: 400 });
  }
  return NextResponse.json({ snapshots: getSnapshots(repoId, sha) });
}
