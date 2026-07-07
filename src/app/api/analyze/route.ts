import { NextRequest } from 'next/server';
import { cloneOrUpdate, indexRepo } from '@/lib/ingest';
import { AGENTS, runAgent, extractFacts, type AgentEvent, type AgentDef } from '@/lib/agents';
import { generateChangeBriefing } from '@/lib/memory';
import { generateDebate } from '@/lib/debate';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

/**
 * POST /api/analyze  { url: string }
 * Streams SSE events: ingest progress, then all analyst agents in parallel,
 * plus the memory change-briefing when the repo has been seen before.
 */
export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url || typeof url !== 'string') {
    return new Response(JSON.stringify({ error: 'url required' }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };
      const emit = (e: AgentEvent) => send('agent', e);

      try {
        send('phase', { phase: 'clone', detail: `Cloning ${url}…` });
        const { repo, sha } = await cloneOrUpdate(url);
        send('phase', { phase: 'ingest', detail: 'Indexing repository…', repoId: repo.id, sha });

        await indexRepo(repo, sha, (p) => send('phase', { ...p, phase: 'ingest', repoId: repo.id, sha }));

        send('phase', { phase: 'agents', detail: 'Agent swarm launching…', repoId: repo.id, sha, agents: AGENTS.map((a) => ({ id: a.id, title: a.title })) });

        // Memory briefing runs alongside the swarm — it's the returning-visit hero moment.
        const memoryPromise = generateChangeBriefing(repo, sha, emit).catch((e) => {
          emit({ agent: 'memory', type: 'error', data: String(e?.message ?? e) });
          return null;
        });

        // All analyst agents in parallel, each streaming into its own pane.
        const reports: { def: AgentDef; report: string }[] = [];
        await Promise.all(
          AGENTS.map(async (def) => {
            try {
              const report = await runAgent(def, repo, sha, emit);
              reports.push({ def, report });
              await extractFacts(repo, sha, def.id, report);
            } catch (e) {
              emit({ agent: def.id, type: 'error', data: String((e as Error)?.message ?? e) });
            }
          }),
        );

        // The team debate needs every report in hand, so it runs after the swarm finishes.
        if (reports.length > 1) {
          await generateDebate(repo, sha, reports, emit).catch((e) => {
            emit({ agent: 'debate', type: 'error', data: String(e?.message ?? e) });
          });
        }

        await memoryPromise;
        send('phase', { phase: 'done', detail: 'Analysis complete', repoId: repo.id, sha });
      } catch (e) {
        send('phase', { phase: 'error', detail: String((e as Error)?.message ?? e) });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
