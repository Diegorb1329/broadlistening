"use client";

import { motion, useReducedMotion } from "framer-motion";
import { TSpeaker } from "./utils/aggregate-speakers";
import { blo } from "blo";
import Image from "next/image";
import Link from "next/link";
import { Quote, MessageCircle, Book, ChevronRight } from "lucide-react";
import { TopicColors } from "./utils/parse-topics";

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

const statsVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delay: 0.1,
      duration: 0.3,
    },
  },
};

const tagContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.15,
    },
  },
};

const tagVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
    },
  },
};

interface SpeakerCardProps {
  speaker: TSpeaker;
  reportUrl: string;
}

const SpeakerCard = ({ speaker, reportUrl }: SpeakerCardProps) => {
  const { authorId, demographics, stats, topics } = speaker;
  const shouldReduceMotion = useReducedMotion();

  const formatDemographics = () => {
    const parts = [];
    if (demographics.gender) {
      parts.push(demographics.gender.charAt(0).toUpperCase());
    }
    if (demographics.ageGroup) {
      parts.push(demographics.ageGroup);
    }
    if (demographics.location) {
      parts.push(demographics.location);
    }
    return parts.join(" • ") || "Demographics not available";
  };

  const visibleTopics = topics.slice(0, 3);
  const remainingTopicsCount = topics.length - 3;

  return (
    <motion.div
      variants={!shouldReduceMotion ? cardVariants : {}}
      initial={!shouldReduceMotion ? "hidden" : false}
      animate={!shouldReduceMotion ? "visible" : false}
      whileHover={
        !shouldReduceMotion
          ? {
              y: -4,
              scale: 1.02,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              transition: {
                duration: 0.2,
                ease: "easeOut" as const,
              },
            }
          : {}
      }
      className="bg-[var(--card)] border border-[var(--hairline)] hover:border-[var(--brand)]/40 p-6 space-y-5 cursor-pointer transition-colors"
      onClick={() => {
        window.location.href = `/interview/${encodeURIComponent(
          authorId
        )}?report=${encodeURIComponent(reportUrl)}`;
      }}
    >
      {/* Avatar and ID */}
      <div className="flex items-start gap-4">
        <motion.div
          whileHover={!shouldReduceMotion ? { scale: 1.05 } : {}}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <div className="h-14 w-14 overflow-hidden bg-[var(--paper-alt)] border border-[var(--hairline)]">
            <Image
              src={blo(`0x${authorId}`)}
              alt={`${authorId} avatar`}
              className="h-full w-full object-cover"
              width={56}
              height={56}
            />
          </div>
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="kicker-muted mb-1">Speaker</p>
          <h3 className="font-serif text-lg leading-snug tracking-tight text-[var(--ink)] truncate">
            {authorId.slice(0, 8)}…{authorId.slice(-4)}
          </h3>
          <p className="text-[10px] font-mono tracking-[0.18em] uppercase text-[var(--muted-ink)] mt-1">
            {formatDemographics()}
          </p>
        </div>
      </div>

      {/* Stats — editorial number row */}
      <motion.div
        variants={!shouldReduceMotion ? statsVariants : {}}
        initial={!shouldReduceMotion ? "hidden" : false}
        animate={!shouldReduceMotion ? "visible" : false}
        className="grid grid-cols-3 gap-px bg-[var(--hairline)] border border-[var(--hairline)]"
      >
        <div className="bg-[var(--card)] px-3 py-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-serif text-2xl text-[var(--ink)] tabular-nums leading-none">
              {stats.totalQuotes}
            </span>
            <Quote className="size-3.5 text-[var(--faint-ink)]" />
          </div>
          <span className="text-[9px] font-mono tracking-[0.25em] uppercase text-[var(--brand)]">
            Quotes
          </span>
        </div>
        <div className="bg-[var(--card)] px-3 py-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-serif text-2xl text-[var(--ink)] tabular-nums leading-none">
              {stats.totalClaims}
            </span>
            <MessageCircle className="size-3.5 text-[var(--faint-ink)]" />
          </div>
          <span className="text-[9px] font-mono tracking-[0.25em] uppercase text-[var(--brand)]">
            Claims
          </span>
        </div>
        <div className="bg-[var(--card)] px-3 py-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-serif text-2xl text-[var(--ink)] tabular-nums leading-none">
              {stats.topicsCount}
            </span>
            <Book className="size-3.5 text-[var(--faint-ink)]" />
          </div>
          <span className="text-[9px] font-mono tracking-[0.25em] uppercase text-[var(--brand)]">
            Topics
          </span>
        </div>
      </motion.div>

      {/* Topic Tags */}
      {topics.length > 0 && (
        <div className="space-y-2">
          <p className="kicker-muted">Topics discussed</p>
          <motion.div
            variants={!shouldReduceMotion ? tagContainerVariants : {}}
            initial={!shouldReduceMotion ? "hidden" : false}
            animate={!shouldReduceMotion ? "visible" : false}
            className="flex flex-wrap gap-1.5"
          >
            {visibleTopics.map((topic) => (
              <motion.span
                key={topic.id}
                variants={!shouldReduceMotion ? tagVariants : {}}
                className="inline-flex items-center text-[11px] px-2 py-1 border transition-colors hover:bg-[var(--paper-alt)]"
                style={{
                  color: `rgb(${TopicColors[topic.colorIndex]})`,
                  borderColor: `rgba(${TopicColors[topic.colorIndex]}, 0.35)`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `/dashboard/${
                    topic.id
                  }?report=${encodeURIComponent(reportUrl)}`;
                }}
              >
                {topic.title}
              </motion.span>
            ))}
            {remainingTopicsCount > 0 && (
              <motion.span
                variants={!shouldReduceMotion ? tagVariants : {}}
                className="inline-flex items-center text-[11px] px-2 py-1 border border-[var(--brand)]/30 text-[var(--brand)]"
              >
                +{remainingTopicsCount} more
              </motion.span>
            )}
          </motion.div>
        </div>
      )}

      {/* View Profile Link */}
      <Link
        href={`/interview/${encodeURIComponent(authorId)}?report=${encodeURIComponent(reportUrl)}`}
        className="flex items-center justify-between text-[11px] font-mono tracking-[0.22em] uppercase text-[var(--muted-ink)] hover:text-[var(--brand)] transition-colors pt-3 border-t border-[var(--hairline)]"
        onClick={(e) => e.stopPropagation()}
      >
        <span>View profile</span>
        <ChevronRight className="size-3.5" />
      </Link>
    </motion.div>
  );
};

export default SpeakerCard;

