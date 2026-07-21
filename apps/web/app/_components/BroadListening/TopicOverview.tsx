"use client";

import { ArrowUpRight, Plus, Minus, List, Grid3x3, TrendingUp } from "lucide-react";
import { TTopic, TClaim } from "./TopicItem";
import { TopicColors } from "./utils/parse-topics";
import { TimestampFilterType } from "./TimestampFilter";
import Link from "next/link";
import { useMemo, useCallback, useState } from "react";
import TopicTreemap from "./TopicTreemap";
import TopicFrequencyChart from "./TopicFrequencyChart";

interface TopicOverviewProps {
  topics: TTopic[];
  reportUrl: string;
  searchQuery?: string;
  timestampFilter?: TimestampFilterType;
}

const calculateTotalPeople = (topic: TTopic) => {
  const people = new Set<string>();
  topic.subtopics.forEach((subtopic) => {
    subtopic.claims.forEach((claim) => {
      claim.quotes.forEach((quote) => {
        people.add(quote.authorId);
      });
    });
  });
  return people.size;
};

const TopicOverview = ({ topics, reportUrl, searchQuery = "", timestampFilter = "all" }: TopicOverviewProps) => {
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "treemap" | "timeline">("list");
  const INITIAL_DISPLAY_COUNT = 10;

  // Helper function to get most recent timestamp from a claim
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

  // Helper function to check if a claim matches the timestamp filter
  const matchesTimestampFilter = useCallback((claim: TClaim): boolean => {
    if (timestampFilter === "all") return true;
    
    const mostRecentDate = getMostRecentTimestamp(claim);
    if (!mostRecentDate) return false;
    
    // Handle custom date range
    if (typeof timestampFilter === "object" && "start" in timestampFilter && "end" in timestampFilter) {
      const start = new Date(timestampFilter.start);
      const end = new Date(timestampFilter.end);
      return mostRecentDate >= start && mostRecentDate <= end;
    }
    
    // Handle quick options
    const now = new Date();
    const diffInMs = now.getTime() - mostRecentDate.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    switch (timestampFilter) {
      case "1week":
        return diffInDays <= 7;
      case "1month":
        return diffInDays <= 30;
      case "6months":
        return diffInDays <= 180;
      default:
        return true;
    }
  }, [timestampFilter]);

  // Helper function to check if text matches search query (handles quoted exact match)
  const textMatchesQuery = (text: string, searchQuery: string): boolean => {
    const normalizedText = text.toLowerCase();
    const normalizedQuery = searchQuery.toLowerCase().trim();
    
    // Check if the query is wrapped in quotes for exact word matching
    if (normalizedQuery.startsWith('"') && normalizedQuery.endsWith('"') && normalizedQuery.length > 2) {
      const exactWord = normalizedQuery.slice(1, -1); // Remove quotes
      // Use word boundary regex to match exact words only
      const wordBoundaryRegex = new RegExp(`\\b${exactWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return wordBoundaryRegex.test(text);
    }
    
    // Default behavior: substring search
    return normalizedText.includes(normalizedQuery);
  };

  // Filter and calculate people count for each topic
  const topicsWithPeople = useMemo(() => {
    
    return topics
      .map((topic) => {
        // Filter subtopics based on claims that match both search and timestamp filters
        const filteredSubtopics = topic.subtopics.map(subtopic => {
          const filteredClaims = subtopic.claims.filter(claim => {
            // Check timestamp filter first
            if (!matchesTimestampFilter(claim)) return false;
            
            // Check search filter if there's a query
            if (searchQuery.trim()) {
              return (
                textMatchesQuery(claim.content, searchQuery) ||
                claim.quotes.some(quote => textMatchesQuery(quote.text, searchQuery)) ||
                claim.similarClaims?.some(similarClaim => 
                  textMatchesQuery(similarClaim.title, searchQuery) ||
                  similarClaim.quotes?.some(quote => textMatchesQuery(quote.text, searchQuery))
                )
              );
            }
            
            return true;
          });

          return {
            ...subtopic,
            claims: filteredClaims
          };
        }).filter(subtopic => subtopic.claims.length > 0);

        const filteredTopic = {
          ...topic,
          subtopics: filteredSubtopics
        };

        return {
          ...filteredTopic,
          peopleCount: calculateTotalPeople(filteredTopic),
        };
      })
      .filter(topic => topic.subtopics.length > 0)
      .sort((a, b) => b.peopleCount - a.peopleCount);
  }, [topics, searchQuery, matchesTimestampFilter]);

  const maxPeople = topicsWithPeople.length > 0 
    ? Math.max(...topicsWithPeople.map(t => t.peopleCount))
    : 0;
  const displayedTopics = showAll ? topicsWithPeople : topicsWithPeople.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMoreTopics = topicsWithPeople.length > INITIAL_DISPLAY_COUNT;
  const remainingCount = topicsWithPeople.length - INITIAL_DISPLAY_COUNT;

  const views: Array<{ id: typeof viewMode; label: string; Icon: typeof List }> = [
    { id: "list", label: "List", Icon: List },
    { id: "treemap", label: "Treemap", Icon: Grid3x3 },
    { id: "timeline", label: "Timeline", Icon: TrendingUp },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--hairline)] pb-4">
        <div>
          <p className="kicker mb-2">A · Overview</p>
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-[var(--ink)]">
            The shape of the conversation.
          </h2>
        </div>
        <div className="flex items-center gap-0 -mx-px">
          {views.map(({ id, label, Icon }) => {
            const active = viewMode === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setViewMode(id)}
                className="btn-editorial"
                style={{ marginLeft: "-1px" }}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {viewMode === "treemap" ? (
        <TopicTreemap topics={topicsWithPeople} reportUrl={reportUrl} />
      ) : viewMode === "timeline" ? (
        <TopicFrequencyChart
          topics={topicsWithPeople}
          timestampFilter={timestampFilter}
          className="mt-4"
        />
      ) : (
        <>
          <ol className="divide-y divide-[var(--hairline)]">
            {displayedTopics.map((topic, idx) => {
              const progressPercentage =
                maxPeople > 0 ? (topic.peopleCount / maxPeople) * 100 : 0;
              return (
                <li key={topic.id}>
                  <Link
                    href={`/dashboard/${topic.id}?report=${encodeURIComponent(reportUrl)}`}
                    className="group block py-4 transition-colors"
                  >
                    <div className="flex items-baseline gap-4">
                      <span className="kicker-muted tabular-nums w-10 shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h3 className="flex-1 text-base md:text-lg text-[var(--ink)] group-hover:text-[var(--brand)] transition-colors leading-snug">
                        {topic.title}
                      </h3>
                      <span className="font-mono text-xs tracking-widest text-[var(--muted-ink)] tabular-nums">
                        {topic.peopleCount} voices
                      </span>
                      <ArrowUpRight className="size-4 text-[var(--faint-ink)] group-hover:text-[var(--brand)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </div>
                    <div className="mt-3 ml-14 topic-strip">
                      <div
                        className="topic-strip-fill"
                        style={{
                          width: `${progressPercentage}%`,
                          backgroundColor: `rgb(${TopicColors[topic.colorIndex]})`,
                          opacity: 0.85,
                        }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
          {hasMoreTopics && (
            <div className="flex justify-center pt-2">
              {!showAll ? (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="btn-editorial"
                >
                  <Plus className="size-3.5" />
                  Show {remainingCount} more
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className="btn-editorial"
                >
                  <Minus className="size-3.5" />
                  Show less
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default TopicOverview; 