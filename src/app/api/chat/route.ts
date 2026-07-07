import { NextRequest } from 'next/server';
import { btl, SYNTH_MODEL, trackUsage } from '@/lib/btl';
import { getRepo, getFacts, getChatHistory, addChatMessage, addFact } from '@/lib/db';
import { retrieve } from '@/lib/ingest';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat  { repoId, sha, message }
 * Retrieval (BTL embeddings) + persistent memory (facts, chat history) →
 * streamed answer with file citations.
 */
export async function POST(req: NextRequest) {
  const { repoId, sha, message } = await req.json();
  const repo = getRepo(Number(repoId));
  if (!repo || !sha || !message) {
    return new Response(JSON.stringify({ error: 'repoId, sha, message required' }), { status: 400 });
  }

  const [chunks, facts, history] = [
    await retrieve(repo.id, sha, message, 8),
    getFacts(repo.id, 20),
    getChatHistory(repo.id, 12),
  ];

  const context = chunks
    .map((c) => `--- ${c.file_path}:${c.start_line}-${c.end_line} (relevance ${c.score.toFixed(2)})\n${c.content}`)
    .join('\n\n');
  const memory = facts.map((f) => `- [${f.created_at}] ${f.fact}`).join('\n');

  addChatMessage(repo.id, 'user', message);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let answer = '';
      try {
        const res = await btl.chat.completions.create({
          model: SYNTH_MODEL,
          stream: true,
          stream_options: { include_usage: true },
          messages: [
            {
              role: 'system',
              content: `You are Docent, a codebase companion for the repository "${repo.name}". You have persistent memory of past analyses and conversations.
Answer using the retrieved code context; always cite sources as \`path:line\`. If the context is insufficient, say what you'd need to look at. Keep answers tight and practical, written as plain conversational prose. Only use a list if the answer is genuinely a sequence or an enumerable set.

THINGS YOU REMEMBER ABOUT THIS REPO:
${memory || '(first conversation)'}`,
            },
            ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
            { role: 'user', content: `RETRIEVED CODE CONTEXT:\n${context}\n\nQUESTION: ${message}` },
          ],
        });
        for await (const chunk of res) {
          if (chunk.usage) trackUsage(repo.id, SYNTH_MODEL, 'chat', chunk.usage);
          const tok = chunk.choices?.[0]?.delta?.content;
          if (tok) {
            answer += tok;
            controller.enqueue(encoder.encode(tok));
          }
        }
        addChatMessage(repo.id, 'assistant', answer);
        // Remember notable Q&A as a fact so future sessions recall it.
        if (answer.length > 100) {
          addFact(repo.id, `User asked "${message.slice(0, 120)}" — key answer: ${answer.slice(0, 200)}`, 'chat', sha);
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n[error: ${String((e as Error)?.message ?? e)}]`));
      } finally {
        try { controller.close(); } catch { /* closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
