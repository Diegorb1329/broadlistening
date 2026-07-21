import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TClaim } from "./TopicItem";
import { TopicColors } from "./utils/parse-topics";
import { blo } from "blo";
import { ChevronLeft, ChevronRight, Quote, ExternalLink, Clock } from "lucide-react";
import React, { useState, useEffect } from "react";
import { TDemographics } from "./utils/fetch-demographics";
import VotingSection from "./VotingSection";
import Image from "next/image";
import Link from "next/link";

const ClaimPopup = ({
  trigger,
  asChild,
  data,
  colorIndex,
  subtopicTitle,
  demographics,
  reportUrl,
}: {
  trigger: React.ReactNode;
  asChild?: boolean;
  data: TClaim;
  colorIndex: number;
  subtopicTitle: string;
  demographics?: TDemographics;
  reportUrl?: string;
}) => {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  
  // Use empty object if demographics not available
  const safeDemographics = demographics || {};
  
  // Helper function to get the most recent timestamp from a claim
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

  // Helper function to format time ago
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInWeeks = Math.floor(diffInDays / 7);
    const diffInMonths = Math.floor(diffInDays / 30);
    const diffInYears = Math.floor(diffInDays / 365);

    if (diffInYears > 0) {
      return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
    } else if (diffInMonths > 0) {
      return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
    } else if (diffInWeeks > 0) {
      return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
    } else if (diffInDays > 0) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else {
      return 'Today';
    }
  };
  
  // Reset quote index when claim changes
  useEffect(() => {
    setCurrentQuoteIndex(0);
  }, [data.id]);
  
  // Collect all quotes from main claim and similar claims with source info
  const allQuotes = [
    ...data.quotes.map(quote => ({ ...quote, sourceType: 'main' as const, claimTitle: data.content })),
    ...(data.similarClaims || []).flatMap((similarClaim) => 
      (similarClaim.quotes || []).map(quote => ({ 
        ...quote, 
        sourceType: 'similar' as const, 
        claimTitle: similarClaim.title 
      }))
    )
  ];

  // Get the current quote's author information
  const currentQuote = allQuotes[currentQuoteIndex];
  const authorId = currentQuote?.authorId;

  const authorGender = safeDemographics[authorId]?.gender;
  const authorAgeGroup = safeDemographics[authorId]?.ageGroup;

  const totalQuotes = allQuotes.length;
  const canGoPrevious = currentQuoteIndex > 0;
  const canGoNext = currentQuoteIndex < totalQuotes - 1;

  // Safety check: if currentQuoteIndex is out of bounds, reset it
  const safeCurrentQuoteIndex = Math.max(0, Math.min(currentQuoteIndex, totalQuotes - 1));
  if (safeCurrentQuoteIndex !== currentQuoteIndex) {
    setCurrentQuoteIndex(safeCurrentQuoteIndex);
  }

  const handlePreviousQuote = () => {
    if (canGoPrevious) {
      setCurrentQuoteIndex(currentQuoteIndex - 1);
    }
  };

  const handleNextQuote = () => {
    if (canGoNext) {
      setCurrentQuoteIndex(currentQuoteIndex + 1);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild={asChild}>{trigger}</TooltipTrigger>
      <TooltipContent className="p-0 border-0">
        <div className="w-[85vw] sm:w-[400px] bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 space-y-4">
            <header className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">{subtopicTitle}</span>
                <div className="flex items-center gap-2">
                  {(() => {
                    const mostRecentDate = getMostRecentTimestamp(data);
                    return mostRecentDate ? (
                      <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded text-muted-foreground">
                        <Clock className="size-3" />
                        <span className="text-xs">
                          {formatTimeAgo(mostRecentDate)}
                        </span>
                      </div>
                    ) : null;
                  })()}
                  <span className="px-2 py-1 bg-muted/50 rounded text-muted-foreground font-medium">
                    Claim #{data.index}
                  </span>
                </div>
              </div>
              <h3
                className="text-base font-medium leading-relaxed"
                style={{
                  color: `rgb(${TopicColors[colorIndex]})`,
                }}
              >
                {data.content}
              </h3>
              <VotingSection />
            </header>
            
            <div className="h-px bg-border"></div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Quote className="size-4" />
                  <span className="font-medium">Quotes</span>
                </div>
                {totalQuotes > 1 && (
                  <div className="flex items-center gap-2">
                    <button 
                      className={`p-1.5 rounded-md border transition-colors ${
                        canGoPrevious 
                          ? 'hover:bg-muted text-foreground' 
                          : 'opacity-50 cursor-not-allowed text-muted-foreground'
                      }`}
                      onClick={handlePreviousQuote}
                      disabled={!canGoPrevious}
                    >
                      <ChevronLeft className="size-3" />
                    </button>
                    <span className="text-xs text-muted-foreground min-w-[2rem] text-center">
                      {currentQuoteIndex + 1}/{totalQuotes}
                    </span>
                    <button 
                      className={`p-1.5 rounded-md border transition-colors ${
                        canGoNext 
                          ? 'hover:bg-muted text-foreground' 
                          : 'opacity-50 cursor-not-allowed text-muted-foreground'
                      }`}
                      onClick={handleNextQuote}
                      disabled={!canGoNext}
                    >
                      <ChevronRight className="size-3" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                {currentQuote ? (
                  <>
                    <blockquote className="text-sm leading-relaxed italic text-foreground/90 pl-3 border-l-2 border-muted">
                      {currentQuote.source ? (
                        <a 
                          href={currentQuote.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors underline decoration-dotted inline-flex items-center gap-1"
                        >
                          <span>&quot;{currentQuote.text}&quot;</span>
                          <ExternalLink className="size-3 inline-block flex-shrink-0" />
                        </a>
                      ) : (
                        <>&quot;{currentQuote.text}&quot;</>
                      )}
                    </blockquote>
                    {authorId && (
                      <div className="flex items-center gap-3 pt-2">
                        {reportUrl ? (
                          <Link 
                            href={`/interview/${encodeURIComponent(authorId)}?report=${encodeURIComponent(reportUrl)}`}
                            className="flex items-center gap-3 hover:bg-muted/50 rounded-md p-1 -m-1 transition-colors group"
                          >
                            <div className="h-6 w-6 rounded-full border overflow-hidden bg-muted">
                              <Image 
                                src={blo(`0x${authorId}`)} 
                                alt="Author avatar"
                                className="h-full w-full object-cover"
                                width={24}
                                height={24}
                              />
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                                {authorId}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {authorGender && authorAgeGroup
                                  ? `${authorGender.charAt(0).toUpperCase()} • ${authorAgeGroup} years old`
                                  : "Unknown demographics"}
                              </div>
                            </div>
                          </Link>
                        ) : (
                          <>
                            <div className="h-6 w-6 rounded-full border overflow-hidden bg-muted">
                              <Image 
                                src={blo(`0x${authorId}`)} 
                                alt="Author avatar"
                                className="h-full w-full object-cover"
                                width={24}
                                height={24}
                              />
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-xs font-medium text-foreground">
                                {authorId}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {authorGender && authorAgeGroup
                                  ? `${authorGender.charAt(0).toUpperCase()} • ${authorAgeGroup} years old`
                                  : "Unknown demographics"}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No quotes available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default ClaimPopup;
