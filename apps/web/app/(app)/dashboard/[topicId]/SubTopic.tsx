"use client";

import ClaimBoxes from "@/app/_components/BroadListening/ClaimBoxes";
import ClaimPopup from "@/app/_components/BroadListening/ClaimPopup";
import ActivityChart from "@/app/_components/BroadListening/ActivityChart";
import { TSubtopic, TTopic, TClaim, TSimilarClaim } from "@/app/_components/BroadListening/TopicItem";
import { TDemographics } from "@/app/_components/BroadListening/utils/fetch-demographics";
import { Link, Quote, Clock } from "lucide-react";
import { TopicColors } from "@/app/_components/BroadListening/utils/parse-topics";
import NextLink from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useState } from "react";

const INITIAL_CLAIMS_SHOW = 8;

const SubTopic = ({
  subtopic,
  topic,
  demographics,
  index,
  total,
}: {
  subtopic: TSubtopic;
  topic: TTopic;
  demographics?: TDemographics;
  index?: number;
  total?: number;
}) => {
  // Use empty object if demographics not available
  const safeDemographics = demographics || {};
  const searchParams = useSearchParams();
  const reportUrl = searchParams.get('report') || '';
  const [hoveredClaimId, setHoveredClaimId] = useState<string | null>(null);
  const [showAllClaims, setShowAllClaims] = useState(false);

  // Helper functions (defined before they're used)
  const getQuotesCount = (claim: TClaim) => {
    const mainQuotes = claim.quotes?.length || 0;
    const similarQuotes = claim.similarClaims?.reduce((acc: number, similarClaim: TSimilarClaim) => 
      acc + (similarClaim.quotes?.length || 0), 0) || 0;
    return mainQuotes + similarQuotes;
  };

  const getMostRecentTimestamp = (claim: TClaim): Date | null => {
    const allQuotes = [
      ...claim.quotes,
      ...(claim.similarClaims || []).flatMap(sc => sc.quotes || [])
    ];
    
    const timestamps = allQuotes
      .map(quote => quote.reference?.timestamp)
      .filter(Boolean)
      .map(ts => new Date(ts as string))
      .filter(date => !isNaN(date.getTime()));
    
    return timestamps.length > 0 ? new Date(Math.max(...timestamps.map(d => d.getTime()))) : null;
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInWeeks = Math.floor(diffInDays / 7);
    const diffInMonths = Math.floor(diffInDays / 30);
    const diffInYears = Math.floor(diffInDays / 365);

    if (diffInYears > 0) {
      return `${diffInYears}y ago`;
    } else if (diffInMonths > 0) {
      return `${diffInMonths}mo ago`;
    } else if (diffInWeeks > 0) {
      return `${diffInWeeks}w ago`;
    } else if (diffInDays > 0) {
      return `${diffInDays}d ago`;
    } else {
      return 'Today';
    }
  };

  // Sort claims by timestamp (most recent first), then by quote count
  const sortedClaims = [...subtopic.claims].sort((a, b) => {
    const aTimestamp = getMostRecentTimestamp(a);
    const bTimestamp = getMostRecentTimestamp(b);
    
    // If both have timestamps, sort by most recent first
    if (aTimestamp && bTimestamp) {
      return bTimestamp.getTime() - aTimestamp.getTime();
    }
    
    // If only one has timestamp, prioritize it
    if (aTimestamp && !bTimestamp) return -1;
    if (!aTimestamp && bTimestamp) return 1;
    
    // If neither has timestamp, fall back to quote count (high to low)
    const aQuoteCount = getQuotesCount(a);
    const bQuoteCount = getQuotesCount(b);
    return bQuoteCount - aQuoteCount;
  });

  const displayedClaims = showAllClaims 
    ? sortedClaims 
    : sortedClaims.slice(0, INITIAL_CLAIMS_SHOW);
  
  const remainingClaims = subtopic.claims.length - INITIAL_CLAIMS_SHOW;
  const shouldShowMoreButton = !showAllClaims && remainingClaims > 0;

  const topicColor = `rgb(${TopicColors[topic.colorIndex]})`;

  return (
    <section
      id={subtopic.id}
      className="border-t border-[var(--hairline)] pt-10 space-y-6 scroll-mt-24"
    >
      <header className="space-y-3">
        <p
          className="font-mono text-[10px] tracking-[0.3em] uppercase"
          style={{ color: topicColor }}
        >
          Subtopic{
            typeof index === "number" && typeof total === "number"
              ? ` ${String(index + 1).padStart(2, "0")} of ${String(total).padStart(2, "0")}`
              : ""
          }
        </p>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-2xl md:text-3xl tracking-tight text-[var(--ink)] flex-1">
            {subtopic.title}
          </h3>
          <ActivityChart data={subtopic} className="flex-shrink-0 mt-1" />
        </div>
        <p className="text-[var(--body)] leading-relaxed max-w-3xl">
          {subtopic.description}
        </p>
      </header>

      <div>
        <ClaimBoxes
          data={{
            title: topic.title,
            id: topic.id,
            description: topic.description,
            subtopics: [{
              ...subtopic,
              claims: sortedClaims
            }],
            colorIndex: topic.colorIndex,
          }}
          highlightedClaimIds={
            hoveredClaimId ? new Set([hoveredClaimId]) : new Set()
          }
          size="lg"
          demographics={safeDemographics}
          reportUrl={reportUrl}
        />
      </div>

      <div className="space-y-4">
        <p className="kicker-muted">Claims</p>
        <ol className="divide-y divide-[var(--hairline)] border-t border-b border-[var(--hairline)]">
          {displayedClaims.map((claim) => {
            const quotesCount = getQuotesCount(claim);
            const mostRecentDate = getMostRecentTimestamp(claim);

            return (
              <li
                key={claim.id}
                className="group"
                onMouseEnter={() => setHoveredClaimId(claim.id)}
                onMouseLeave={() => setHoveredClaimId(null)}
              >
                <NextLink
                  href={`/dashboard/claim/${claim.id}?report=${encodeURIComponent(reportUrl)}`}
                  className="flex items-start gap-4 py-3 transition-colors hover:bg-[var(--paper-alt)]/60 -mx-2 px-2"
                >
                  <span
                    className="font-mono text-[10px] tracking-[0.2em] uppercase tabular-nums text-[var(--faint-ink)] w-8 shrink-0 mt-1"
                  >
                    #{String(claim.index).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] leading-relaxed text-[var(--ink)] group-hover:text-[var(--brand)] transition-colors">
                      {claim.content}
                    </p>
                    {mostRecentDate && (
                      <p className="flex items-center gap-1 mt-1.5 text-[10px] tracking-[0.2em] uppercase text-[var(--muted-ink)] font-mono">
                        <Clock className="size-3" />
                        Last activity {formatTimeAgo(mostRecentDate)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    {quotesCount > 0 && (
                      <ClaimPopup
                        data={claim}
                        colorIndex={topic.colorIndex}
                        subtopicTitle={subtopic.title}
                        demographics={safeDemographics}
                        reportUrl={reportUrl}
                        trigger={
                          <span
                            className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.2em] uppercase tabular-nums text-[var(--muted-ink)] hover:text-[var(--brand)] transition-colors"
                          >
                            <Quote className="size-3" />
                            {quotesCount}
                          </span>
                        }
                      />
                    )}
                    <Link className="size-3.5 text-[var(--faint-ink)] group-hover:text-[var(--brand)] transition-colors" />
                  </div>
                </NextLink>
              </li>
            );
          })}
        </ol>

        {shouldShowMoreButton && (
          <div className="flex justify-center pt-4">
            <button
              type="button"
              onClick={() => setShowAllClaims(true)}
              className="btn-editorial"
            >
              Show {remainingClaims} more
            </button>
          </div>
        )}

        {showAllClaims && subtopic.claims.length > INITIAL_CLAIMS_SHOW && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setShowAllClaims(false)}
              className="btn-editorial"
            >
              Show less
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default SubTopic;
