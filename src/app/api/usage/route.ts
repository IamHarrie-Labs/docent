import { NextRequest, NextResponse } from 'next/server';
import { getUsageSummary } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/usage?repoId=1 — live cost meter data. */
export async function GET(req: NextRequest) {
  const repoId = req.nextUrl.searchParams.get('repoId');
  const summary = getUsageSummary(repoId ? Number(repoId) : undefined);
  return NextResponse.json({
    calls: summary.calls ?? 0,
    prompt_tokens: summary.prompt_tokens ?? 0,
    completion_tokens: summary.completion_tokens ?? 0,
    est_cost_usd: summary.est_cost_usd ?? 0,
  });
}
