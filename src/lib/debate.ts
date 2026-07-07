import { btl, SYNTH_MODEL, trackUsage } from './btl';
import { saveSnapshot, type Repo } from './db';
import type { AgentEvent } from './agents';
import type { AgentDef } from './agents';

/**
 * The six analyst agents work independently and don't see each other's reports.
 * This step gives them a table: where do their independent findings actually
 * conflict, and where do they reinforce each other? Ends in a ranked consensus.
 */
export async function generateDebate(
  repo: Repo,
  sha: string,
  reports: { def: AgentDef; report: string }[],
  emit: (e: AgentEvent) => void,
): Promise<string> {
  emit({ agent: 'debate', type: 'status', data: 'Convening the team…' });

  const reportBlock = reports
    .map(({ def, report }) => `## ${def.role}\n${report.slice(0, 4000)}`)
    .join('\n\n');

  const stream = await btl.chat.completions.create({
    model: SYNTH_MODEL,
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      {
        role: 'system',
        content: `Six engineers each independently analyzed the repository "${repo.name}" and filed the reports below: Architect, DevOps Engineer, Security Engineer, Dependency Engineer, Systems Cartographer, Mentor.
Moderate a short debate between them, written as flowing prose a senior engineer would actually say out loud, not a fragment-heavy audit dump:
1. Points of tension: a short paragraph on where two or more of their findings actually conflict or trade off against each other (e.g. one flags a risk another's findings make acceptable). Quote each side briefly and attribute it by role. Every point must trace to something concretely stated in a report below, never invent a disagreement that isn't there.
2. Where they reinforce each other: a short paragraph on this, or say plainly that the reports mostly agree instead of manufacturing conflict.
3. Consensus: end with a short ranked list (High / Medium / Low priority, a genuine sequence so a list is right here) of what this team would tell the next person to work on, one line of reasoning each, tracing back to whichever role(s) raised it.
Use at most one or two headers to separate these three parts. Be specific and honest. If there is genuinely little tension between the reports, say that, do not fabricate drama for the sake of it.`,
      },
      { role: 'user', content: reportBlock },
    ],
  });

  let debate = '';
  for await (const chunk of stream) {
    if (chunk.usage) trackUsage(repo.id, SYNTH_MODEL, 'chat', chunk.usage);
    const tok = chunk.choices?.[0]?.delta?.content;
    if (tok) {
      debate += tok;
      emit({ agent: 'debate', type: 'token', data: tok });
    }
  }

  saveSnapshot(repo.id, sha, 'debate', debate);
  emit({ agent: 'debate', type: 'done', data: debate });
  return debate;
}
