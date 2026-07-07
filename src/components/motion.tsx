'use client';

import { useRef } from 'react';
import { motion, useInView, useScroll, useTransform, MotionValue } from 'framer-motion';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Splits text on spaces; each word slides up into place, staggered, once in view. */
export function WordsPullUp({
  text,
  className = '',
  showAsterisk = false,
  delay = 0,
}: {
  text: string;
  className?: string;
  showAsterisk?: boolean;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const words = text.split(' ');

  return (
    <span ref={ref} className={`inline-flex flex-wrap ${className}`}>
      {words.map((word, i) => {
        const isLast = i === words.length - 1;
        return (
          <span key={i} className="overflow-hidden pb-[0.1em] mr-[0.28em] inline-block">
            <motion.span
              className="inline-block relative"
              initial={{ y: '100%', opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.7, ease: EASE, delay: delay + i * 0.08 }}
            >
              {word}
              {showAsterisk && isLast && (
                <span className="absolute top-[0.65em] -right-[0.3em] text-[0.31em]">*</span>
              )}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

/** Same pull-up effect, but each segment carries its own className (for mixed sans/italic-serif lines). */
export function WordsPullUpMultiStyle({
  segments,
  containerClassName = '',
  delay = 0,
}: {
  segments: { text: string; className?: string }[];
  containerClassName?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  let wordIndex = 0;

  return (
    <div ref={ref} className={`inline-flex flex-wrap justify-center ${containerClassName}`}>
      {segments.map((seg, si) =>
        seg.text.split(' ').map((word, wi) => {
          const idx = wordIndex++;
          return (
            <span key={`${si}-${wi}`} className={`overflow-hidden pb-[0.15em] mr-[0.28em] inline-block ${seg.className ?? ''}`}>
              <motion.span
                className="inline-block"
                initial={{ y: '100%', opacity: 0 }}
                animate={inView ? { y: 0, opacity: 1 } : {}}
                transition={{ duration: 0.7, ease: EASE, delay: delay + idx * 0.08 }}
              >
                {word}
              </motion.span>
            </span>
          );
        }),
      )}
    </div>
  );
}

/** Fades a whole block up on scroll-into-view. */
export function FadeUp({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ y: 20, opacity: 0 }}
      animate={inView ? { y: 0, opacity: 1 } : {}}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

const CARD_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Feature card entrance: scale up from 0.95 plus fade, staggered, once in view. */
export function CardReveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : {}}
      transition={{ duration: 0.7, ease: CARD_EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** One character of a scroll-revealed paragraph, opacity ramps as the page scrolls past it. */
function AnimatedLetter({ char, progress, index, total }: { char: string; progress: MotionValue<number>; index: number; total: number }) {
  const charProgress = index / total;
  const opacity = useTransform(progress, [charProgress - 0.1, charProgress + 0.05], [0.2, 1]);
  return <motion.span style={{ opacity }}>{char}</motion.span>;
}

/** Paragraph whose characters light up progressively as it scrolls through the viewport. */
export function ScrollRevealText({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.2'] });
  const chars = text.split('');

  return (
    <p ref={ref} className={className}>
      {chars.map((c, i) => (
        <AnimatedLetter key={i} char={c} progress={scrollYProgress} index={i} total={chars.length} />
      ))}
    </p>
  );
}
