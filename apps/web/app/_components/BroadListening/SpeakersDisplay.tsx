"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import SpeakerCard from "./SpeakerCard";
import { TSpeaker } from "./utils/aggregate-speakers";
import { Users, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const ITEMS_PER_PAGE = 60;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut" as const,
    },
  },
};

interface SpeakersDisplayProps {
  speakers: TSpeaker[];
  reportUrl: string;
}

const SpeakersDisplay = ({ speakers, reportUrl }: SpeakersDisplayProps) => {
  const shouldReduceMotion = useReducedMotion();
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);

  // Reset display count when speakers list changes (e.g., filters change)
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [speakers.length]);

  if (speakers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="rounded-full bg-muted p-6">
          <Users className="size-12 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">No speakers found</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Try adjusting your filters or search terms to find more speakers.
          </p>
        </div>
      </div>
    );
  }

  const visibleSpeakers = speakers.slice(0, displayCount);
  const hasMore = displayCount < speakers.length;
  const remainingCount = speakers.length - displayCount;

  const loadMore = () => {
    setDisplayCount((prev) => Math.min(prev + ITEMS_PER_PAGE, speakers.length));
  };

  return (
    <div className="space-y-6">
      <motion.div
        variants={!shouldReduceMotion ? containerVariants : {}}
        initial={!shouldReduceMotion ? "hidden" : false}
        animate={!shouldReduceMotion ? "visible" : false}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <AnimatePresence mode="popLayout">
          {visibleSpeakers.map((speaker, index) => (
            <motion.div
              key={speaker.authorId}
              variants={!shouldReduceMotion ? cardVariants : {}}
              initial={!shouldReduceMotion ? "hidden" : false}
              animate={!shouldReduceMotion ? "visible" : false}
              exit={!shouldReduceMotion ? { opacity: 0, y: -20 } : undefined}
              transition={{
                duration: 0.3,
                delay: index >= displayCount - ITEMS_PER_PAGE ? (index - (displayCount - ITEMS_PER_PAGE)) * 0.03 : 0,
              }}
            >
              <SpeakerCard speaker={speaker} reportUrl={reportUrl} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={loadMore}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            <ChevronDown className="size-4" />
            Load {Math.min(ITEMS_PER_PAGE, remainingCount)} more
            {remainingCount > ITEMS_PER_PAGE && ` (${remainingCount} remaining)`}
          </Button>
        </div>
      )}

      {!hasMore && speakers.length > ITEMS_PER_PAGE && (
        <div className="text-center text-sm text-muted-foreground py-4">
          All {speakers.length} speakers displayed
        </div>
      )}
    </div>
  );
};

export default SpeakersDisplay;

