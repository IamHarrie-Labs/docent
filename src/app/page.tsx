'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { WordsPullUp, WordsPullUpMultiStyle, ScrollRevealText, CardReveal } from '@/components/motion';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const HERO_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4';
const CARD1_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_133058_0504132a-0cf3-4450-a370-8ea3b05c95d4.mp4';
const ICON_SWARM = 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171918_4a5edc79-d78f-4637-ac8b-53c43c220606.png&w=1280&q=85';
const ICON_DEBATE = 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171741_ed9845ab-f5b2-4018-8ce7-07cc01823522.png&w=1280&q=85';
const ICON_MEMORY = 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171809_f56666dc-c099-4778-ad82-9ad4f209567b.png&w=1280&q=85';

function BgVideo({ src }: { src: string }) {
  return (
    <video
      src={src}
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
    />
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
  icon: string;
  items: string[];
  delay: number;
}) {
  return (
    <CardReveal delay={delay} className="bg-card-2 rounded-2xl p-6 flex flex-col justify-between h-full">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover mb-5" />
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
          <BgVideo src={HERO_VIDEO} />
          <div className="noise-overlay absolute inset-0 opacity-[0.7] mix-blend-overlay pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

          <Navbar />

          <div className="absolute bottom-0 left-0 p-6 md:p-12 pb-10 md:pb-14 max-w-md md:max-w-lg">
            <h1 className="select-none mb-5" style={{ color: '#E1E0CC' }}>
              <WordsPullUp
                text="Docent"
                showAsterisk
                className="text-6xl sm:text-7xl md:text-8xl font-medium leading-[0.85] tracking-[-0.03em]"
              />
            </h1>
            <div className="flex flex-col gap-5">
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
              <BgVideo src={CARD1_VIDEO} />
              <div className="absolute inset-0 flex items-end p-6 bg-gradient-to-t from-black/50 via-transparent to-transparent">
                <span className="text-lg font-medium" style={{ color: '#E1E0CC' }}>
                  Six minds, one repo.
                </span>
              </div>
            </CardReveal>

            <FeatureCard
              n="01"
              title="The Swarm."
              icon={ICON_SWARM}
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
              icon={ICON_DEBATE}
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
              icon={ICON_MEMORY}
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
