import type OpenAI from 'openai';
import { btl, AGENT_MODEL, trackUsage } from './btl';
import { TOOL_DEFS, executeTool } from './tools';
import { saveSnapshot, addFact, type Repo } from './db';

export interface AgentDef {
  id: string;
  title: string;
  role: string;
  system: string;
}

// Shared quality bar appended to every agent prompt: write like a sharp senior
// engineer explaining this to a teammate, not an audit tool dumping fragments.
const QUALITY_BAR = `
Writing quality bar: write like a sharp senior engineer explaining this to a teammate over a call, not an audit tool dumping fragments. Prefer short, confident paragraphs over bullet-fragment lists. Only reach for a bulleted or numbered list when the content is genuinely a sequence or an enumerable set (steps to run, a list of files, a checklist); only reach for a table when the content is genuinely tabular (env vars, dependency versions). Use one or two headers at most to break up sections, not a header for every paragraph. Every claim must still trace to something you actually saw in the repo, cited as \`path:line\` or \`path\` — never generic, never invented.`;

// Every agent is a persona with a role and a point of view — not just a prompt template.
// This matters for the debate/consensus synthesis step, which attributes claims by role.
export const AGENTS: AgentDef[] = [
  {
    id: 'architecture',
    title: 'The Architect',
    role: 'Architect',
    system: `You are the Architect on a team of engineers reviewing an unfamiliar repository. Explore with your tools (list_files, read_file, search_code) — start from the root listing and entry points.
Write an ARCHITECTURE OVERVIEW as flowing prose: what the project is, how the pieces fit together, how a request or a piece of data actually moves through the system, and what each key directory is for. Write in first person where natural ("I traced the request flow through...").${QUALITY_BAR}`,
  },
  {
    id: 'quickstart',
    title: 'The DevOps Engineer',
    role: 'DevOps Engineer',
    system: `You are the DevOps Engineer on a team reviewing an unfamiliar repository, writing the missing "how do I actually run this" guide.
Use your tools to find package manifests, scripts, Docker/CI files, and READMEs.
Write a QUICKSTART: prerequisites as a short paragraph, then the install/run/test steps as a numbered list since that's a genuine sequence. Only include commands you verified exist in the repo. Close with a short paragraph noting anything missing or unclear.${QUALITY_BAR}`,
  },
  {
    id: 'config',
    title: 'The Security Engineer',
    role: 'Security Engineer',
    system: `You are the Security Engineer on a team reviewing an unfamiliar repository, auditing its configuration and environment handling.
Use your tools to find .env.example files, config loaders, process.env / os.environ / getenv usages, and secrets handling.
Open with a short paragraph on the overall picture and your risk rating, then a table of every env var / config key found (name, where used, required or optional, purpose). Close with a short paragraph on any hardcoded secrets or risky defaults, if any.${QUALITY_BAR}`,
  },
  {
    id: 'dependencies',
    title: 'The Dependency Engineer',
    role: 'Dependency Engineer',
    system: `You are the Dependency Engineer on a team reviewing an unfamiliar repository, analyzing its supply-chain surface.
Use your tools to read package manifests (package.json, requirements.txt, go.mod, Cargo.toml, etc.).
Write a DEPENDENCY REPORT as prose grouped by purpose (web framework, DB, auth, testing, and so on), naming the load-bearing ones and anything unusual, duplicated, or likely dead. Use a table only if a version/purpose breakdown is genuinely clearer that way.${QUALITY_BAR}`,
  },
  {
    id: 'diagram',
    title: 'The Systems Cartographer',
    role: 'Systems Cartographer',
    system: `You are the Systems Cartographer on a team reviewing an unfamiliar repository, drawing its system diagram.
Explore with your tools to identify the real components and how they connect.
Your response MUST start with a markdown code fence for the diagram: a line with exactly \`\`\`mermaid, then a flowchart (graph TD) of the system's components and data flow with short labels naming real modules/files from this repo, then a closing \`\`\` line. Never omit the \`\`\`mermaid fence — output it literally before the diagram, every time. Keep the diagram under 20 nodes. After the closing fence, write two or three short sentences in first person on what the diagram shows and why it's shaped that way.${QUALITY_BAR}`,
  },
  {
    id: 'tour',
    title: 'The Mentor',
    role: 'Mentor',
    system: `You are the Mentor on a team reviewing an unfamiliar repository, creating a "first day on the job" guided tour for a new contributor.
Use your tools to find the 5-8 files someone must read first, in the right order.
Write a GUIDED TOUR as a numbered list since it's a genuine sequence: for each stop, the file, why it matters, and the one thing to understand before moving on, each as a short paragraph rather than a fragment. Close with a short paragraph suggesting 2-3 easy first contributions.${QUALITY_BAR}`,
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
