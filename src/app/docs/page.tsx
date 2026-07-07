'use client';

import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { FadeUp, WordsPullUpMultiStyle } from '@/components/motion';

function Section({ title, children, delay }: { title: string; children: React.ReactNode; delay: number }) {
  return (
    <FadeUp delay={delay} className="mb-14">
      <h2 className="text-primary-2 text-xl sm:text-2xl font-medium mb-4">{title}</h2>
      <div className="text-gray-400 text-sm sm:text-base leading-relaxed space-y-4">{children}</div>
    </FadeUp>
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
    <main className="bg-black min-h-screen">
      <div className="relative px-6 pb-20">
        <Navbar />

        <div className="max-w-3xl mx-auto pt-28 sm:pt-32" style={{ color: '#E1E0CC' }}>
          <span className="text-primary text-[10px] sm:text-xs uppercase tracking-[0.2em]">Reference</span>
          <div className="mt-4 mb-14">
            <WordsPullUpMultiStyle
              containerClassName="text-3xl sm:text-4xl md:text-5xl justify-start leading-[0.95]"
              segments={[{ text: 'Docs.', className: 'font-normal' }]}
            />
            <div className="mt-2">
              <WordsPullUpMultiStyle
                containerClassName="text-2xl sm:text-3xl md:text-4xl justify-start leading-[0.95] text-primary/80"
                segments={[{ text: 'How six engineers read a repository.', className: 'italic font-serif-italic' }]}
                delay={0.2}
              />
            </div>
          </div>

          <Section title="What it does" delay={0.05}>
            <p>
              You give Docent a GitHub URL. It clones the repo, indexes it into
              a semantic search index, then sends six agents in after it at
              once, each with their own tools and their own job. They stream
              their findings live. Once all six are done, a seventh call reads
              everything they wrote and moderates a short debate about where
              their findings actually disagree and what should get fixed
              first. If you have analyzed this exact repo before, an eighth
              call compares the new commit against the last one it saw and
              tells you what changed.
            </p>
            <p>
              After that, you can just ask it things. &quot;Where does auth
              happen?&quot; gets answered with real file citations, pulled
              from the same semantic index the agents built.
            </p>
          </Section>

          <Section title="The team" delay={0.1}>
            <ul className="space-y-3">
              <li><b className="text-primary-2">The Architect</b>, maps the system: components, data flow, key directories.</li>
              <li><b className="text-primary-2">The DevOps Engineer</b>, writes the quickstart guide the repo is missing.</li>
              <li><b className="text-primary-2">The Security Engineer</b>, audits env vars, config, and secrets handling.</li>
              <li><b className="text-primary-2">The Dependency Engineer</b>, reads the manifests and flags supply chain risk.</li>
              <li><b className="text-primary-2">The Systems Cartographer</b>, draws the system diagram, real modules only.</li>
              <li><b className="text-primary-2">The Mentor</b>, builds a first day guided tour for a new contributor.</li>
            </ul>
            <p>
              All six run in parallel, in a real tool use loop: <code>list_files</code>,{' '}
              <code>read_file</code>, and <code>search_code</code>, against the
              actual cloned repo. None of them see the other five reports
              until the debate step.
            </p>
          </Section>

          <Section title="Debate and memory" delay={0.15}>
            <p>
              <b className="text-primary-2">The Debate.</b> Six independent
              reports rarely conflict much, and Docent is built to say so
              honestly rather than manufacture tension. When it finds a real
              disagreement (say, one agent calling something risky and
              another explaining why it is acceptable), it quotes both sides
              and attributes them. It always ends with a ranked consensus
              traced back to the reports it came from.
            </p>
            <p>
              <b className="text-primary-2">The Memory.</b> Every agent report
              is saved per commit. Analyze the same repo again later and
              Docent diffs the new commit against the last one it indexed,
              then tells you what changed, including which of its own earlier
              conclusions are now wrong. This is the one thing a plain docs
              generator can never do: it has no yesterday to compare against.
            </p>
          </Section>

          <Section title="BTL Runtime usage" delay={0.2}>
            <p>Every model call in Docent goes through <code>api.badtheorylabs.com/v1</code>:</p>
            <ul className="space-y-2">
              <li><code>/v1/chat/completions</code>, all six agents, debate synthesis, memory briefing, and repo chat, all streamed.</li>
              <li><code>/v1/chat/completions</code> with <code>tools</code>, agents calling <code>list_files</code>, <code>read_file</code>, and <code>search_code</code>.</li>
              <li><code>/v1/embeddings</code>, whole repo semantic index for retrieval.</li>
            </ul>
            <p>Usage returned on every call is tracked into the live cost meter on the analyze page. A full run typically costs under a cent.</p>
          </Section>

          <Section title="Run it locally" delay={0.25}>
            <Code>{`npm install
cp .env.example .env   # add your BTL_API_KEY
npm run dev             # http://localhost:3000`}</Code>
            <p>
              Paste a repo URL on the <Link href="/analyze" className="text-primary underline">analyze page</Link>, hit
              Analyze, and watch the team work. Commit something to that repo
              and analyze it again. The Historian&apos;s briefing appears automatically.
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}
