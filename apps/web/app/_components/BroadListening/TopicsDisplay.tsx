"use client";

import TopicItem, { TTopic, TClaim } from "./TopicItem";
import { Download } from "lucide-react";
import Link from "next/link";
import { TDemographics } from "./utils/fetch-demographics";
import { TimestampFilterType } from "./TimestampFilter";
import { useMemo, useCallback } from "react";

export const TopicsDisplay = ({
  topics,
  totalUniqueClaims,
  totalUniquePeople,
  demographics,
  reportUrl,
  searchQuery = "",
  timestampFilter = "all",
}: {
  topics: TTopic[];
  totalUniqueClaims: number;
  totalUniquePeople: number;
  demographics?: TDemographics;
  reportUrl: string;
  searchQuery?: string;
  timestampFilter?: TimestampFilterType;
}) => {
  const safeDemographics = demographics || {};

  // Helper function to get most recent timestamp from a claim
  const getMostRecentTimestamp = useCallback((claim: TClaim): Date | null => {
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
  }, []);

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
  }, [timestampFilter, getMostRecentTimestamp]);

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

  // Filter and sort topics based on search query, timestamp filter, and claim count
  const filteredTopics = useMemo(() => {
    
    const processedTopics = topics.map(topic => {
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

      return {
        ...topic,
        subtopics: filteredSubtopics
      };
    }).filter(topic => topic.subtopics.length > 0);

    // Sort topics by total claim count (highest to lowest)
    return processedTopics.sort((a, b) => {
      const aClaimCount = a.subtopics.reduce((acc, subtopic) => acc + subtopic.claims.length, 0);
      const bClaimCount = b.subtopics.reduce((acc, subtopic) => acc + subtopic.claims.length, 0);
      return bClaimCount - aClaimCount;
    });
  }, [topics, searchQuery, matchesTimestampFilter]);

  // Calculate filtered stats
  const filteredStats = useMemo(() => {
    const filteredClaimsCount = filteredTopics.reduce((acc, topic) => 
      acc + topic.subtopics.reduce((subAcc, subtopic) => subAcc + subtopic.claims.length, 0), 0
    );
    
    const filteredPeopleSet = new Set<string>();
    filteredTopics.forEach(topic => {
      topic.subtopics.forEach(subtopic => {
        subtopic.claims.forEach(claim => {
          claim.quotes.forEach(quote => {
            filteredPeopleSet.add(quote.authorId);
          });
          claim.similarClaims?.forEach(similarClaim => {
            similarClaim.quotes?.forEach(quote => {
              filteredPeopleSet.add(quote.authorId);
            });
          });
        });
      });
    });

    return {
      topics: filteredTopics.length,
      claims: filteredClaimsCount,
      people: filteredPeopleSet.size
    };
  }, [filteredTopics]);

  // CSV download function
  const downloadClaimsAsCSV = useCallback(() => {
    const claimsMap = new Map<string, {
      claim: TClaim;
      topicTitle: string;
      subtopicTitle: string;
    }>();

    // Flatten all claims from filtered topics, deduplicating by claim ID
    filteredTopics.forEach(topic => {
      topic.subtopics.forEach(subtopic => {
        subtopic.claims.forEach(claim => {
          // Only add if we haven't seen this claim ID before
          if (!claimsMap.has(claim.id)) {
            claimsMap.set(claim.id, {
              claim,
              topicTitle: topic.title,
              subtopicTitle: subtopic.title,
            });
          }
        });
      });
    });

    const allClaims = Array.from(claimsMap.values());

    // Create CSV header
    const csvHeaders = [
      'Claim ID',
      'Claim Content',
      'Category (Topic)',
      'Subcategory (Subtopic)', 
      'Most Recent Timestamp',
      'Quote Count',
      'Author Count'
    ];

    // Convert claims to CSV rows
    const csvRows = allClaims.map(({ claim, topicTitle, subtopicTitle }) => {
      const mostRecentTimestamp = getMostRecentTimestamp(claim);
      const allQuotes = [
        ...claim.quotes,
        ...(claim.similarClaims || []).flatMap(sc => sc.quotes || [])
      ];
      const uniqueAuthors = new Set(allQuotes.map(quote => quote.authorId));

      return [
        claim.id,
        `"${claim.content.replace(/"/g, '""')}"`, // Escape quotes in content
        `"${topicTitle.replace(/"/g, '""')}"`,
        `"${subtopicTitle.replace(/"/g, '""')}"`,
        mostRecentTimestamp ? mostRecentTimestamp.toISOString() : '',
        allQuotes.length.toString(),
        uniqueAuthors.size.toString()
      ].join(',');
    });

    // Combine headers and rows
    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `claims-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredTopics, getMostRecentTimestamp]);

  const isFiltered = Boolean(searchQuery || timestampFilter !== "all");

  return (
    <section className="space-y-8">
      <div className="space-y-4 border-b border-[var(--hairline)] pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="kicker mb-2">B · Claims</p>
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-[var(--ink)]">
              Grounded in <span className="italic text-[var(--brand)]">original quotes</span>.
            </h2>
          </div>
          <button
            type="button"
            onClick={downloadClaimsAsCSV}
            className="btn-editorial self-start sm:self-end"
          >
            <Download className="size-3.5" />
            Export CSV
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted-ink)]">
            <span className="tabular-nums">
              {isFiltered ? filteredStats.topics : topics.length} topics
            </span>
            <span className="text-[var(--faint-ink)]">·</span>
            <span className="tabular-nums">
              {isFiltered ? filteredStats.claims : totalUniqueClaims} claims
            </span>
            <span className="text-[var(--faint-ink)]">·</span>
            <Link
              href={`/dashboard/people?report=${encodeURIComponent(reportUrl)}`}
              className="hover:text-[var(--brand)] transition-colors tabular-nums"
            >
              {isFiltered ? filteredStats.people : totalUniquePeople} people ↗
            </Link>
          </div>
          {isFiltered && (
            <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--faint-ink)]">
              Filtered · {[
                searchQuery && `"${searchQuery}"`,
                timestampFilter !== "all" && (
                  timestampFilter === "1week" ? "last week" :
                  timestampFilter === "1month" ? "last month" :
                  timestampFilter === "6months" ? "last 6 months" : "custom range"
                )
              ].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {filteredTopics.length > 0 ? (
          filteredTopics.map((topic) => (
            <TopicItem
              key={topic.title}
              data={topic}
              demographics={safeDemographics}
              reportUrl={reportUrl}
            />
          ))
        ) : (
          searchQuery && (
            <div className="text-center py-16 border border-[var(--hairline)]">
              <p className="kicker mb-3">No matches</p>
              <p className="font-serif text-2xl text-[var(--ink)]">
                Nothing matched <span className="italic text-[var(--brand)]">“{searchQuery}”</span>.
              </p>
              <p className="text-sm text-[var(--muted-ink)] mt-3">
                Try a different search term or clear the filter to see all claims.
              </p>
            </div>
          )
        )}
      </div>
    </section>
  );
};
