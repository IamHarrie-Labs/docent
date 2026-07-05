import type OpenAI from 'openai';
import { btl, AGENT_MODEL, trackUsage } from './btl';
import { TOOL_DEFS, executeTool } from './tools';
import { saveSnapshot, addFact, type Repo } from './db';

export interface AgentDef {
  id: string;
  title: string;
  system: string;
}

export const AGENTS: AgentDef[] = [
  {
    id: 'architecture',
    title: 'Architecture Analyst',
    system: `You are an expert software architect analyzing an unfamiliar repository.
Explore with your tools (list_files, read_file, search_code) — start from the root listing and entry points.
Produce a concise markdown ARCHITECTURE OVERVIEW: what the project is, main components/layers, how data flows, key directories and their roles. Cite files as \`path:line\`. Be specific to THIS repo, never generic.`,
  },
  {
    id: 'quickstart',
    title: 'Quickstart Guide',
    system: `You are writing the missing "how do I actually run this" guide for a repository.
Use your tools to find package manifests, scripts, Docker/CI files, and READMEs.
Produce a markdown QUICKSTART: prerequisites, install steps, how to run in dev, how to run tests. Only include commands you verified exist in the repo (cite the file they come from). Note anything missing or unclear.`,
  },
  {
    id: 'config',
    title: 'Config & Env Auditor',
    system: `You audit configuration and environment requirements of a repository.
Use your tools to find .env.example files, config loaders, process.env / os.environ / getenv usages, and secrets handling.
Produce a markdown CONFIG AUDIT: table of every env var / config key found (name, where used with path:line, required or optional, purpose). Flag any hardcoded secrets or risky defaults.`,
  },
  {
    id: 'dependencies',
    title: 'Dependency Analyst',
    system: `You analyze the dependency surface of a repository.
Use your tools to read package manifests (package.json, requirements.txt, go.mod, Cargo.toml, etc.).
Produce a markdown DEPENDENCY REPORT: runtime vs dev dependencies grouped by purpose (web framework, DB, auth, testing…), the most load-bearing ones, and anything unusual, duplicated, or likely dead. Cite files.`,
  },
  {
    id: 'diagram',
    title: 'Diagram Artist',
    system: `You draw the system diagram for a repository.
Explore with your tools to identify the real components and how they connect.
Your response MUST start with a markdown code fence for the diagram: a line with exactly \`\`\`mermaid, then a flowchart (graph TD) of the system's components and data flow with short labels naming real modules/files from this repo, then a closing \`\`\` line. Never omit the \`\`\`mermaid fence — output it literally before the diagram, every time. After the closing fence, add 3-5 bullet notes. Keep the diagram under 20 nodes.`,
  },
  {
    id: 'tour',
    title: 'Guided Tour',
    system: `You create a "first day on the job" guided tour of a repository for a new contributor.
Use your tools to find the 5-8 files someone must read first, in the right order.
Produce a markdown GUIDED TOUR: an ordered list — for each stop: the file (path), why it matters, and the one thing to understand before moving on. End with "your first contribution" suggestions: 2-3 easy entry points.`,
  },
];

export interface AgentEvent {
  agent: string;
  type: 'status' | 'token' | 'tool' | 'done' | 'error';
  data: string;
}

const MAX_TURNS = 12;

/** Run one analyst agent: a streaming tool-use loop against the BTL runtime. */
export async function runAgent(
  def: AgentDef,
  repo: Repo,
  sha: string,
  emit: (e: AgentEvent) => void,
): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: def.system },
    {
      role: 'user',
      content: `Analyze the repository "${repo.name}" (at commit ${sha.slice(0, 8)}). Begin by listing the root files, then explore as needed. When you have enough evidence, write your final report.`,
    },
  ];

  let finalReport = '';

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = await btl.chat.completions.create({
      model: AGENT_MODEL,
      messages,
      tools: TOOL_DEFS,
      stream: true,
      stream_options: { include_usage: true },
    });

    let content = '';
    const toolCalls: { id: string; name: string; args: string }[] = [];

    for await (const chunk of stream) {
      if (chunk.usage) trackUsage(repo.id, AGENT_MODEL, 'agent', chunk.usage);
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
        emit({ agent: def.id, type: 'token', data: delta.content });
      }
      for (const tc of delta.tool_calls ?? []) {
        const idx = tc.index ?? 0;
        if (!toolCalls[idx]) toolCalls[idx] = { id: tc.id ?? `call_${idx}`, name: '', args: '' };
        if (tc.id) toolCalls[idx].id = tc.id;
        if (tc.function?.name) toolCalls[idx].name += tc.function.name;
        if (tc.function?.arguments) toolCalls[idx].args += tc.function.arguments;
      }
    }

    if (toolCalls.length === 0) {
      finalReport = content;
      break;
    }

    messages.push({
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls.map((t) => ({
        id: t.id, type: 'function' as const,
        function: { name: t.name, arguments: t.args },
      })),
    });

    for (const t of toolCalls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(t.args || '{}'); } catch { /* tolerate malformed args */ }
      emit({ agent: def.id, type: 'tool', data: `${t.name}(${t.args.slice(0, 120)})` });
      const result = executeTool(repo.local_path, t.name, args);
      messages.push({ role: 'tool', tool_call_id: t.id, content: result.slice(0, 12000) });
    }
  }

  if (!finalReport) finalReport = '(agent reached turn limit without a final report)';
  saveSnapshot(repo.id, sha, def.id, finalReport);
  emit({ agent: def.id, type: 'done', data: finalReport });
  return finalReport;
}

/** Extract durable facts from an agent report and store them in repo memory. */
export async function extractFacts(repo: Repo, sha: string, agentId: string, report: string) {
  try {
    const res = await btl.chat.completions.create({
      model: AGENT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Extract 3-6 durable, specific facts about this codebase from the report — things worth remembering across sessions (e.g. "Auth is handled in src/middleware/auth.ts using JWT"). Output one fact per line, no bullets, no numbering.',
        },
        { role: 'user', content: report.slice(0, 12000) },
      ],
    });
    trackUsage(repo.id, AGENT_MODEL, 'agent', res.usage);
    const text = res.choices[0]?.message?.content ?? '';
    for (const line of text.split('\n').map((l) => l.trim()).filter((l) => l.length > 10)) {
      addFact(repo.id, line, `agent:${agentId}`, sha);
    }
  } catch { /* fact extraction is best-effort */ }
}
