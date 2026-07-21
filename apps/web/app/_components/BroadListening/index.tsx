"use client";

import { useEffect, useMemo } from "react";
import { TopicsDisplay } from "./TopicsDisplay";
import TopicOverview from "./TopicOverview";
import { Info } from "lucide-react";
import { TimestampFilterType } from "./TimestampFilter";
import { useSearch } from "../SearchContext";
import { useData } from "./DataContext";

// Function to get the base URL for API calls

// Function to find all author IDs within topics and subtopics
// const findAuthorIdsInTopics = (topics: TTopic[]) => {
//   const authorIds = new Set<string>();

//   topics.forEach((topic) => {
//     topic.subtopics.forEach((subtopic: TSubtopic) => {
//       subtopic.claims.forEach((claim: TClaim) => {
//         claim.quotes.forEach((quote: TQuote) => {
//           authorIds.add(quote.authorId);
//         });
//       });
//     });
//   });

//   return Array.from(authorIds);
// };

interface Bhutan2035Props {
  reportUrl: string;
  searchQuery?: string;
  timestampFilter?: TimestampFilterType;
}

const Bhutan2035 = ({ reportUrl, searchQuery, timestampFilter }: Bhutan2035Props) => {
  const { data, loadData } = useData();
  const { setHasTimestampData } = useSearch();

  useEffect(() => {
    const initializeData = async () => {
      if (!reportUrl) return;

      // Load data into context if not already loaded
      if (data.reportUrl !== reportUrl || data.topics.length === 0) {
        await loadData(reportUrl);
      }

      // Check if there's any timestamp data in the topics
      if (data.parsedData) {
        const hasTimestamps = data.parsedData.topics.some(topic =>
          topic.subtopics.some(subtopic =>
            subtopic.claims.some(claim =>
              claim.quotes.some(quote => quote.reference?.timestamp) ||
              (claim.similarClaims || []).some(similarClaim =>
                (similarClaim.quotes || []).some(quote => quote.reference?.timestamp)
              )
            )
          )
        );
        setHasTimestampData(hasTimestamps);
      }
    };

    initializeData();
  }, [reportUrl, data.reportUrl, data.topics.length, data.parsedData, loadData, setHasTimestampData]);

  const loading = data.loading || !data.parsedData;
  const error = data.error;
  const topics = data.topics;
  const demographics = data.demographics;
  const parsedData = data.parsedData;
  const title = parsedData?.title || "Broad Listening Report";
  const description = parsedData?.description || "AI-generated report based on interview data analysis.";
  const totalUniqueClaims = parsedData?.totalUniqueClaims || 0;
  const totalUniquePeople = parsedData?.totalUniquePeople || 0;

  const totalSubtopics = useMemo(
    () => topics.reduce((acc, t) => acc + t.subtopics.length, 0),
    [topics]
  );

  if (loading) {
    return (
      <div className="space-y-12">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/2 mb-6"></div>
          <div className="space-y-3">
            <div className="h-6 bg-muted rounded w-1/4"></div>
            <div className="h-20 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-12">
        <div className="text-center py-12 text-muted-foreground">
          <div className="space-y-2">
            <p className="text-lg font-medium text-destructive">Error loading report</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <header className="space-y-8">
        <div className="space-y-5 max-w-4xl">
          <p className="kicker">Report · T3C analysis result</p>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.04] text-[var(--ink)]">
            {title}
          </h1>
          <div className="w-12 h-px bg-[var(--ink)]/30" />
          <p className="text-base md:text-lg text-[var(--body)] leading-relaxed">
            {description}
          </p>
        </div>

        {/* Inline stat strip — small editorial summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 border-t border-b border-[var(--hairline)] py-6">
          <div className="stat-column">
            <div className="stat-num tabular-nums">{topics.length}</div>
            <div className="stat-label">Topics</div>
          </div>
          <div className="stat-column">
            <div className="stat-num tabular-nums">{totalSubtopics}</div>
            <div className="stat-label">Subtopics</div>
          </div>
          <div className="stat-column">
            <div className="stat-num tabular-nums">{totalUniqueClaims}</div>
            <div className="stat-label">Claims</div>
          </div>
          <div className="stat-column">
            <div className="stat-num tabular-nums">{totalUniquePeople}</div>
            <div className="stat-label">Voices</div>
          </div>
        </div>

        <div className="flex items-start gap-3 text-[var(--muted-ink)]">
          <Info className="size-4 mt-0.5 text-[var(--brand)] flex-shrink-0" />
          <p className="text-sm leading-relaxed max-w-2xl">
            The summary is written by the report creators; the rest of the
            analysis is AI-generated, with verbatim participant quotes preserved.
          </p>
        </div>
      </header>
      
      <TopicOverview 
        topics={topics} 
        reportUrl={reportUrl}
        searchQuery={searchQuery}
        timestampFilter={timestampFilter}
      />
      
      <TopicsDisplay
        topics={topics}
        demographics={demographics}
        totalUniqueClaims={totalUniqueClaims}
        totalUniquePeople={totalUniquePeople}
        reportUrl={reportUrl}
        searchQuery={searchQuery}
        timestampFilter={timestampFilter}
      />
    </div>
  );
};

export default Bhutan2035;
