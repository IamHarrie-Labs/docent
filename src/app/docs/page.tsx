import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <h2 className="text-primary-2 text-xl sm:text-2xl font-medium mb-4">{title}</h2>
      <div className="text-gray-400 text-sm sm:text-base leading-relaxed space-y-4">{children}</div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-card border border-border rounded-lg p-4 overflow-x-auto text-xs sm:text-sm font-mono text-primary-2">
      <code>{children}</code>
    </pre>
  );
}

export default function DocsPage() {
  return (
    <main className="bg-black min-h-screen px-6 py-10 sm:py-14">
      <div className="max-w-3xl mx-auto" style={{ color: '#E1E0CC' }}>
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary mb-10">
          <ArrowLeft size={14} /> Back
        </Link>

        <h1 className="text-3xl sm:text-4xl font-medium mb-3">Docs</h1>
        <p className="text-gray-400 mb-14 max-w-xl">
          What Docent actually does when you paste a repo URL, how the team of
          agents is put together, and where every BTL Runtime call happens.
        </p>

        <Section title="What it does">
          <p>
            You give Docent a GitHub URL. It clones the repo, indexes it into a
            semantic search index, then sends six agents in after it at once —
            each with their own tools and their own job. They stream their
            findings live. Once all six are done, a seventh call reads
            everything they wrote and moderates a short debate: where do their
            findings actually disagree, and what should get fixed first. If
            you've analyzed this exact repo before, an eighth call compares the
            new commit against the last one it saw and tells you what changed.
          </p>
          <p>
            After that, you can just ask it things. &quot;Where does auth
            happen?&quot; gets answered with real file citations, pulled from
            the same semantic index the agents built.
          </p>
        </Section>

        <Section title="The team">
          <ul className="space-y-3">
            <li><b className="text-primary-2">The Architect</b> — maps the system: components, data flow, key directories.</li>
            <li><b className="text-primary-2">The DevOps Engineer</b> — writes the quickstart guide the repo is missing.</li>
            <li><b className="text-primary-2">The Security Engineer</b> — audits env vars, config, and secrets handling.</li>
            <li><b className="text-primary-2">The Dependency Engineer</b> — reads the manifests, flags supply-chain risk.</li>
            <li><b className="text-primary-2">The Systems Cartographer</b> — draws the system diagram, real modules only.</li>
            <li><b className="text-primary-2">The Mentor</b> — builds a first-day guided tour for a new contributor.</li>
          </ul>
          <p>
            All six run in parallel, in a real tool-use loop — <code>list_files</code>,{' '}
            <code>read_file</code>, <code>search_code</code> — against the actual
            cloned repo. None of them see the other five reports until the debate step.
          </p>
        </Section>

        <Section title="Debate & memory">
          <p>
            <b className="text-primary-2">The Debate.</b> Six independent
            reports rarely conflict much, and Docent is built to say so
            honestly rather than manufacture tension. When it finds a real
            disagreement — one agent calling something risky, another
            explaining why it's acceptable — it quotes both sides and
            attributes them. It always ends with a ranked, evidence-traced
            consensus.
          </p>
          <p>
            <b className="text-primary-2">The Memory.</b> Every agent report is
            saved per commit. Re-analyze the same repo later and Docent diffs
            the new commit against the last one it indexed, then tells you
            what changed — and which of its own earlier conclusions are now
            wrong. This is the one thing a fresh doc-generator can never do:
            it has no yesterday to compare against.
          </p>
        </Section>

        <Section title="BTL Runtime usage">
          <p>Every model call in Docent goes through <code>api.badtheorylabs.com/v1</code>:</p>
          <ul className="space-y-2">
            <li><code>/v1/chat/completions</code> — all six agents, debate synthesis, memory briefing, repo chat (all streamed)</li>
            <li><code>/v1/chat/completions</code> with <code>tools</code> — agents calling <code>list_files</code> / <code>read_file</code> / <code>search_code</code></li>
            <li><code>/v1/embeddings</code> — whole-repo semantic index for retrieval</li>
          </ul>
          <p>Usage returned on every call is tracked into the live cost meter on the analyze page — a full run typically costs under a cent.</p>
        </Section>

        <Section title="Run it locally">
          <Code>{`npm install
cp .env.example .env   # add your BTL_API_KEY
npm run dev             # http://localhost:3000`}</Code>
          <p>
            Paste a repo URL on the <Link href="/analyze" className="text-primary underline">analyze page</Link>, hit
            Analyze, and watch the team work. Commit something to that repo and
            analyze it again — The Historian's briefing appears automatically.
          </p>
        </Section>
      </div>
    </main>
  );
}
