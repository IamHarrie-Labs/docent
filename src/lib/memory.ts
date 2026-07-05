import { simpleGit } from 'simple-git';
import { btl, SYNTH_MODEL, trackUsage } from './btl';
import { getSnapshots, getPreviousAnalyzedCommit, addFact, getFacts, type Repo } from './db';
import type { AgentEvent } from './agents';

/**
 * Docent's hero feature: memory that compounds.
 * When a repo is re-analyzed at a new commit, compare against the previous
 * snapshot and produce a "what changed since I last saw this codebase" briefing.
 */
export async function generateChangeBriefing(
  repo: Repo,
  newSha: string,
  emit: (e: AgentEvent) => void,
): Promise<string | null> {
  const prevSha = getPreviousAnalyzedCommit(repo.id, newSha);
  if (!prevSha) return null; // first visit — nothing to remember yet

  emit({ agent: 'memory', type: 'status', data: `Recalling previous analysis at ${prevSha.slice(0, 8)}…` });

  // Raw evidence: git diff between the two analyzed commits
  const git = simpleGit(repo.local_path);
  let diffStat = '';
  let diffSample = '';
  try {
    diffStat = await git.diff(['--stat', `${prevSha}..${newSha}`]);
    diffSample = (await git.diff([`${prevSha}..${newSha}`, '--unified=2'])).slice(0, 30000);
  } catch {
    diffStat = '(diff unavailable — shallow clone may not contain the previous commit)';
  }

  const prevReports = getSnapshots(repo.id, prevSha)
    .map((s) => `## Previous ${s.agent} report\n${s.report.slice(0, 4000)}`)
    .join('\n\n');
  const knownFacts = getFacts(repo.id, 30).map((f) => `- ${f.fact}`).join('\n');

  const stream = await btl.chat.completions.create({
    model: SYNTH_MODEL,
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      {
        role: 'system',
        content: `You are Docent, a codebase companion with persistent memory. You analyzed this repository before at commit ${prevSha.slice(0, 8)}; it is now at ${newSha.slice(0, 8)}.
Write a "WHAT CHANGED SINCE MY LAST VISIT" briefing in markdown:
1. A 2-3 sentence summary of the evolution.
2. Notable changes, each citing files (path) and, where possible, referencing what you previously knew ("auth used to live in X — it moved to Y").
3. Which of your previous conclusions are now stale.
4. What a returning contributor should look at first.
Be specific and evidence-based; use the diff and your prior reports. If the diff is unavailable, reason from the reports alone and say so.`,
      },
      {
        role: 'user',
        content: `MY REMEMBERED FACTS ABOUT THIS REPO:\n${knownFacts || '(none yet)'}\n\nMY PREVIOUS REPORTS:\n${prevReports || '(none)'}\n\nGIT DIFF STAT:\n${diffStat}\n\nDIFF (truncated):\n${diffSample}`,
      },
    ],
  });

  let briefing = '';
  for await (const chunk of stream) {
    if (chunk.usage) trackUsage(repo.id, SYNTH_MODEL, 'chat', chunk.usage);
    const tok = chunk.choices?.[0]?.delta?.content;
    if (tok) {
      briefing += tok;
      emit({ agent: 'memory', type: 'token', data: tok });
    }
  }

  addFact(repo.id, `Analyzed at ${newSha.slice(0, 8)} (previously ${prevSha.slice(0, 8)}): ${briefing.slice(0, 300)}`, 'memory', newSha);
  emit({ agent: 'memory', type: 'done', data: briefing });
  return briefing;
}
