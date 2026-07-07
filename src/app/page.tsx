'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Bot, Brain, MessagesSquare, Check } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { WordsPullUp, WordsPullUpMultiStyle, ScrollRevealText, CardReveal } from '@/components/motion';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const NODES: { x: number; y: number }[] = [
  { x: 12, y: 22 }, { x: 30, y: 12 }, { x: 52, y: 18 }, { x: 70, y: 10 }, { x: 85, y: 24 },
  { x: 18, y: 45 }, { x: 40, y: 38 }, { x: 60, y: 44 }, { x: 80, y: 50 }, { x: 92, y: 40 },
  { x: 10, y: 68 }, { x: 28, y: 75 }, { x: 48, y: 66 }, { x: 66, y: 72 }, { x: 82, y: 78 }, { x: 95, y: 65 },
];

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [1, 6], [2, 7], [3, 8], [4, 9],
  [5, 6], [6, 7], [7, 8], [8, 9], [5, 10], [6, 11], [7, 12], [8, 13], [9, 14],
  [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [9, 15],
];

/** Ambient visual standing in for footage: a slow drifting network, in place of stock video. */
function SwarmField() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,#1c1c1c_0%,#000_75%)]" />
      <motion.svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        animate={{ rotate: [0, 2, 0, -2, 0] }}
        transition={{ duration: 40, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '50% 50%' }}
      >
        {EDGES.map(([a, b], i) => (
          <motion.line
            key={i}
            x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y}
            stroke="#DEDBC8" strokeWidth={0.15}
            initial={{ opacity: 0.05 }}
            animate={{ opacity: [0.05, 0.22, 0.05] }}
            transition={{ duration: 6, repeat: Infinity, delay: (i % 8) * 0.4, ease: 'easeInOut' }}
          />
        ))}
        {NODES.map((n, i) => (
          <motion.circle
            key={i}
            cx={n.x} cy={n.y} r={0.6}
            fill="#DEDBC8"
            initial={{ opacity: 0.2 }}
            animate={{ opacity: [0.2, 0.9, 0.2], r: [0.5, 0.9, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, delay: (i % 6) * 0.5, ease: 'easeInOut' }}
          />
        ))}
      </motion.svg>
      <motion.div
        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
        animate={{ left: ['-40%', '110%'] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
      />
    </div>
  );
}

function FeatureCard({
  n,
  title,
  icon,
  items,
  delay,
}: {
  n: string;
  title: string;
  icon: React.ReactNode;
  items: string[];
  delay: number;
}) {
  return (
    <CardReveal delay={delay} className="bg-card-2 rounded-2xl p-6 flex flex-col justify-between h-full">
      <div>
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/40 flex items-center justify-center text-primary mb-5">
          {icon}
        </div>
        <div className="text-primary/50 text-xs mb-1 font-mono">{n}</div>
        <h3 className="text-primary-2 text-lg sm:text-xl font-medium mb-4">{title}</h3>
        <ul className="space-y-2.5 mb-6">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
              <Check size={15} className="text-primary mt-0.5 shrink-0" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>
      <Link href="/docs" className="group inline-flex items-center gap-1.5 text-sm text-primary w-fit">
        Learn more
        <ArrowRight size={15} className="-rotate-45 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </CardReveal>
  );
}

export default function Home() {
  return (
    <main style={{ color: '#E1E0CC' }}>
      {/* HERO */}
      <section className="h-screen p-4 md:p-6">
        <div className="relative w-full h-full rounded-2xl md:rounded-[2rem] overflow-hidden bg-black">
          <SwarmField />
          <div className="noise-overlay absolute inset-0 opacity-[0.7] mix-blend-overlay pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />

          <Navbar />

          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 pb-10 md:pb-14">
            <div className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-12 lg:col-span-8">
                <h1 className="select-none" style={{ color: '#E1E0CC' }}>
                  <WordsPullUp
                    text="Docent"
                    showAsterisk
                    className="text-[26vw] sm:text-[24vw] md:text-[22vw] lg:text-[20vw] xl:text-[19vw] 2xl:text-[20vw] font-medium leading-[0.85] tracking-[-0.07em]"
                  />
                </h1>
              </div>
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-5 lg:pb-6">
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.5 }}
                  className="text-primary/70 text-xs sm:text-sm md:text-base"
                  style={{ lineHeight: 1.2 }}
                >
                  Docent is a swarm of six engineers: Architect, DevOps, Security,
                  Dependency, Cartographer, and Mentor. They read any repository
                  together, argue about what they find, and remember what changed
                  the next time you ask. Every call runs on the BTL Runtime.
                </motion.p>
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
                >
                  <Link
                    href="/analyze"
                    className="group inline-flex items-center gap-2 bg-primary rounded-full pl-5 pr-1.5 py-1.5 text-black font-medium text-sm sm:text-base transition-all hover:gap-3 w-fit"
                  >
                    Analyze a repo
                    <span className="bg-black rounded-full w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center transition-transform group-hover:scale-110">
                      <ArrowRight size={16} className="text-[#E1E0CC]" />
                    </span>
                  </Link>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STORY */}
      <section id="story" className="bg-black py-20 sm:py-28 px-4">
        <div className="bg-card rounded-2xl md:rounded-[2rem] max-w-6xl mx-auto text-center px-6 py-16 sm:py-24">
          <span className="text-primary text-[10px] sm:text-xs uppercase tracking-[0.2em]">
            Codebase intelligence
          </span>
          <div className="mt-6 mb-8">
            <WordsPullUpMultiStyle
              containerClassName="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl max-w-3xl mx-auto leading-[0.95] sm:leading-[0.9]"
              segments={[
                { text: 'I’m Docent,', className: 'font-normal' },
                { text: 'a swarm that reads code for a living.', className: 'italic font-serif-italic' },
                { text: 'I don’t just summarize a repo. I remember it, and I argue with myself about it.', className: 'font-normal' },
              ]}
            />
          </div>
          <ScrollRevealText
            className="max-w-2xl mx-auto text-[#DEDBC8] text-xs sm:text-sm md:text-base"
            text="Six agents explore a repository in parallel through the BTL Runtime, reading files, tracing calls, and following evidence. When they disagree, I say so. When something changes, I tell you exactly what's now wrong. A full run costs a fraction of a cent, in DeepSeek tokens routed straight through api.badtheorylabs.com."
          />
        </div>
      </section>

      {/* SWARM / FEATURES */}
      <section id="swarm" className="min-h-screen bg-black py-20 sm:py-28 px-4 relative">
        <div className="bg-noise absolute inset-0 opacity-[0.15] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto">
          <div className="mb-12 sm:mb-16 text-center">
            <WordsPullUpMultiStyle
              containerClassName="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-normal block"
              segments={[
                { text: 'Six engineers who read your repository.', className: 'text-primary-2' },
              ]}
            />
            <div className="mt-2">
              <WordsPullUpMultiStyle
                containerClassName="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-normal block"
                segments={[
                  { text: 'They argue. They remember. They cite their sources.', className: 'text-gray-500' },
                ]}
                delay={0.3}
              />
            </div>
          </div>

          <div id="memory" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-2 md:gap-1 lg:h-[480px]">
            <CardReveal delay={0} className="rounded-2xl overflow-hidden relative bg-card min-h-[220px] lg:h-full">
              <SwarmField />
              <div className="absolute inset-0 flex items-end p-6">
                <span className="text-lg font-medium" style={{ color: '#E1E0CC' }}>
                  Six minds, one repo.
                </span>
              </div>
            </CardReveal>

            <FeatureCard
              n="01"
              title="The Swarm."
              icon={<Bot size={20} />}
              delay={0.15}
              items={[
                'The Architect maps structure and data flow, citing path and line.',
                'The DevOps Engineer writes the quickstart nobody else did.',
                'The Security Engineer audits env vars and flags risky defaults.',
                'The Dependency Engineer flags supply chain risk and dead weight.',
              ]}
            />
            <FeatureCard
              n="02"
              title="The Debate."
              icon={<MessagesSquare size={20} />}
              delay={0.3}
              items={[
                'Reviews all six reports for real tension between findings.',
                'Says plainly when there is no conflict. It never manufactures drama.',
                'Ends in a ranked, attributed consensus of what to fix first.',
              ]}
            />
            <FeatureCard
              n="03"
              title="The Memory."
              icon={<Brain size={20} />}
              delay={0.45}
              items={[
                'Diffs new commits against its own past understanding.',
                'Flags which of its previous conclusions are now stale.',
                'Remembers what you asked last time, and what changed since.',
              ]}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
