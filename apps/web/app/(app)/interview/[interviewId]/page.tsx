import parseTopics, { TopicColors } from "@/app/_components/BroadListening/utils/parse-topics";
import Container from "@/components/ui/container";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import React from "react";
import fetchDemographics from "@/app/_components/BroadListening/utils/fetch-demographics";
import Link from "next/link";
import { TClaim, TQuote, TTopic, TSubtopic } from "@/app/_components/BroadListening/TopicItem";
import { Metadata } from "next";
import QuoteCard from "@/app/_components/BroadListening/QuoteCard";
import { blo } from "blo";
import Image from "next/image";
import { headers } from 'next/headers';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ interviewId: string }>;
  searchParams: Promise<{ report?: string }>;
}): Promise<Metadata> {
  const searchParamsData = await searchParams;
  const encodedReportUrl = searchParamsData.report;
  
  if (!encodedReportUrl) {
    return {
      title: "Interview Not Found - Broad Listening",
      description: "The requested interview could not be found.",
    };
  }

  try {
    const reportUrl = decodeURIComponent(encodedReportUrl);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const topicsResponse = await fetch(reportUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BroadListening-Bot/1.0',
      },
    });
    clearTimeout(timeoutId);
    
    if (!topicsResponse.ok) {
      throw new Error(`Failed to fetch report: ${topicsResponse.status}`);
    }
    
    const topicsData = await topicsResponse.json();
    const parsedTopics = parseTopics(topicsData);
    
    const paramsData = await params;
    const interviewId = paramsData.interviewId;

    // Find all claims and quotes by this author
    const authorClaims: Array<{ claim: TClaim; topic: TTopic; subtopic: TSubtopic }> = [];
    const authorQuotes: Array<{ quote: TQuote; claim: TClaim; topic: TTopic; subtopic: TSubtopic }> = [];
    
    for (const topic of parsedTopics.topics) {
      for (const subtopic of topic.subtopics) {
        for (const claim of subtopic.claims) {
          // Check direct quotes
          const authorDirectQuotes = claim.quotes.filter(q => q.authorId === interviewId);
          if (authorDirectQuotes.length > 0) {
            authorClaims.push({ claim, topic, subtopic });
            authorDirectQuotes.forEach(quote => {
              authorQuotes.push({ quote, claim, topic, subtopic });
            });
          }
          
          // Check similar claims quotes
          claim.similarClaims?.forEach(similarClaim => {
            const authorSimilarQuotes = similarClaim.quotes?.filter(q => q.authorId === interviewId) || [];
            if (authorSimilarQuotes.length > 0) {
              // Only add claim if not already added
              if (!authorClaims.some(ac => ac.claim.id === claim.id)) {
                authorClaims.push({ claim, topic, subtopic });
              }
              authorSimilarQuotes.forEach(quote => {
                authorQuotes.push({ quote, claim, topic, subtopic });
              });
            }
          });
        }
      }
    }

    if (authorQuotes.length === 0) {
      return {
        title: "Interview Not Found - Broad Listening",
        description: "The requested interview could not be found.",
      };
    }

    const uniqueTopics = new Set(authorClaims.map(ac => ac.topic.id)).size;
    
    const title = `Interview: ${interviewId} - ${authorQuotes.length} Quotes, ${uniqueTopics} Topics`;
    const description = `Analysis of interview ${interviewId} with ${authorQuotes.length} quotes across ${uniqueTopics} topics`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://www.broadlistening.org/interview/${interviewId}`,
        siteName: "Broad Listening",
        images: [
          {
            url: "/img/hero.png",
            width: 1200,
            height: 630,
            alt: `Interview ${interviewId} - Analysis`,
          },
        ],
        locale: "en_US",
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: ["/img/hero.png"],
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "Interview Analysis - Broad Listening",
      description: "Explore interview analysis and insights from interview data",
    };
  }
}

const InterviewPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ interviewId: string }>;
  searchParams: Promise<{ report?: string }>;
}) => {
  const searchParamsData = await searchParams;
  const encodedReportUrl = searchParamsData.report;
  
  // Try to get URL from headers as fallback
  const headersList = await headers();
  const fullUrl = headersList.get('x-url') || headersList.get('referer') || '';
  const url = new URL(fullUrl || 'http://localhost:3000');
  const reportFromUrl = url.searchParams.get('report');
  
  // Use fallback if available (searchParams not working reliably in Next.js 15)
  const finalReportUrl = encodedReportUrl || reportFromUrl;
  
  if (!finalReportUrl) {
    return (
      <Container className="flex flex-col gap-4 items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-5 max-w-md">
          <p className="kicker">Missing report</p>
          <h1 className="font-serif text-3xl text-[var(--ink)]">
            Provide a report URL to <span className="italic text-[var(--brand)]">view this interview</span>.
          </h1>
          <Link href="/" className="btn-editorial btn-editorial-primary inline-flex">
            Enter report URL
          </Link>
        </div>
      </Container>
    );
  }

  const reportUrl = decodeURIComponent(finalReportUrl!);
  
  const topicsPromise = fetch(reportUrl, {
    headers: {
      'User-Agent': 'BroadListening-Bot/1.0',
    },
  });
  const parsedTopicsPromise = topicsPromise.then((res) => {
    if (!res.ok) {
      throw new Error(`Failed to fetch report: ${res.status}`);
    }
    return res.json().then((json) => {
      return parseTopics(json);
    });
  });

  const [paramsData, parsedTopics, demographics] = await Promise.all([
    params,
    parsedTopicsPromise,
    fetchDemographics(),
  ]);
  
  // Decode and clean the interview ID (handle URL encoding)
  const rawInterviewId = paramsData.interviewId;
  const interviewId = decodeURIComponent(rawInterviewId);

  // Find all claims and quotes by this author
  const authorClaims: Array<{ claim: TClaim; topic: TTopic; subtopic: TSubtopic }> = [];
  const authorQuotes: Array<{ quote: TQuote; claim: TClaim; topic: TTopic; subtopic: TSubtopic }> = [];
  
  for (const topic of parsedTopics.topics) {
    for (const subtopic of topic.subtopics) {
      for (const claim of subtopic.claims) {
        // Check direct quotes
        const authorDirectQuotes = claim.quotes.filter(q => q.authorId === interviewId);
        if (authorDirectQuotes.length > 0) {
          authorClaims.push({ claim, topic, subtopic });
          authorDirectQuotes.forEach(quote => {
            authorQuotes.push({ quote, claim, topic, subtopic });
          });
        }
        
        // Check similar claims quotes
        claim.similarClaims?.forEach(similarClaim => {
          const authorSimilarQuotes = similarClaim.quotes?.filter(q => q.authorId === interviewId) || [];
          if (authorSimilarQuotes.length > 0) {
            // Only add claim if not already added
            if (!authorClaims.some(ac => ac.claim.id === claim.id)) {
              authorClaims.push({ claim, topic, subtopic });
            }
            authorSimilarQuotes.forEach(quote => {
              authorQuotes.push({ quote, claim, topic, subtopic });
            });
          }
        });
      }
    }
  }

  if (authorQuotes.length === 0) redirect("/not-found");

  // Get unique topics this author discussed
  const discussedTopics = Array.from(
    new Map(authorClaims.map(ac => [ac.topic.id, ac.topic])).values()
  );

  // Group quotes by topic
  const quotesByTopic = discussedTopics.map(topic => {
    const topicQuotes = authorQuotes.filter(aq => aq.topic.id === topic.id);
    const topicClaims = authorClaims.filter(ac => ac.topic.id === topic.id);
    return {
      topic,
      quotes: topicQuotes,
      claimCount: topicClaims.length
    };
  }).sort((a, b) => b.quotes.length - a.quotes.length); // Sort by quote count

  // Get demographics for this author
  const authorGender = demographics[interviewId]?.gender;
  const authorAgeGroup = demographics[interviewId]?.ageGroup;

  const shortAuthor = `${interviewId.slice(0, 8)}…${interviewId.slice(-4)}`;

  return (
    <Container className="space-y-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 text-[10px] font-mono tracking-[0.25em] uppercase text-[var(--muted-ink)]">
        <Link
          href={`/dashboard?report=${encodeURIComponent(reportUrl)}`}
          className="hover:text-[var(--brand)] transition-colors"
        >
          Dashboard
        </Link>
        <span className="text-[var(--faint-ink)]">/</span>
        <Link
          href={`/dashboard/people?report=${encodeURIComponent(reportUrl)}`}
          className="inline-flex items-center gap-2 hover:text-[var(--brand)] transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Speakers
        </Link>
        <span className="text-[var(--faint-ink)]">/</span>
        <span className="text-[var(--faint-ink)]">{shortAuthor}</span>
      </div>

      {/* Header */}
      <header className="space-y-5">
        <div className="flex items-start gap-5">
          <div className="h-20 w-20 overflow-hidden bg-[var(--paper-alt)] border border-[var(--hairline)] flex-shrink-0">
            <Image
              src={blo(`0x${interviewId}`)}
              alt="Interview participant avatar"
              className="h-full w-full object-cover"
              width={80}
              height={80}
            />
          </div>
          <div className="space-y-3">
            <p className="kicker">Speaker profile</p>
            <h1 className="font-serif text-3xl md:text-5xl tracking-tight leading-[1.05] text-[var(--ink)]">
              {shortAuthor}
            </h1>
            <p className="text-[11px] tracking-[0.2em] uppercase font-mono text-[var(--muted-ink)]">
              {authorGender && authorAgeGroup
                ? `${authorGender} · ${authorAgeGroup}`
                : "Demographics not available"}
            </p>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 md:gap-10 border-t border-b border-[var(--hairline)] py-6">
        <div className="stat-column">
          <div className="stat-num tabular-nums">{authorQuotes.length}</div>
          <div className="stat-label">Total quotes</div>
        </div>
        <div className="stat-column">
          <div className="stat-num tabular-nums">{authorClaims.length}</div>
          <div className="stat-label">Claims</div>
        </div>
        <div className="stat-column">
          <div className="stat-num tabular-nums">{discussedTopics.length}</div>
          <div className="stat-label">Topics</div>
        </div>
      </div>

      {/* Topics Overview */}
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="kicker">A · Topics discussed</p>
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-[var(--ink)]">
            What this <span className="italic text-[var(--brand)]">voice</span> raised.
          </h2>
        </div>

        <div className="space-y-4">
          {quotesByTopic.map(({ topic, quotes, claimCount }) => {
            const topicColor = `rgb(${TopicColors[topic.colorIndex]})`;
            return (
              <article
                key={topic.id}
                className="bg-[var(--card)] border border-[var(--hairline)] p-6 space-y-4 transition-colors hover:border-[var(--brand)]/40"
                style={{ borderLeftWidth: 3, borderLeftColor: topicColor }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <p
                      className="font-mono text-[10px] tracking-[0.25em] uppercase"
                      style={{ color: topicColor }}
                    >
                      Topic
                    </p>
                    <Link
                      href={`/dashboard/${topic.id}?report=${encodeURIComponent(reportUrl)}`}
                      className="font-serif text-xl md:text-2xl text-[var(--ink)] hover:text-[var(--brand)] transition-colors block leading-snug"
                    >
                      {topic.title}
                    </Link>
                    <p className="text-sm text-[var(--muted-ink)] leading-relaxed">
                      {topic.description}
                    </p>
                  </div>
                  <div className="text-right font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--muted-ink)] shrink-0">
                    <div className="tabular-nums">{quotes.length} quotes</div>
                    <div className="tabular-nums">{claimCount} claims</div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[var(--hairline)]">
                  <p className="kicker-muted">Sample quotes</p>
                  <div className="space-y-2">
                    {quotes.slice(0, 2).map(({ quote, claim, subtopic }, index) => (
                      <div
                        key={`${quote.id}-${claim.id}-${subtopic.id}-${index}`}
                        className="pl-4 border-l border-[var(--hairline)] py-1"
                      >
                        <blockquote className="font-serif italic text-[14px] text-[var(--ink)] leading-relaxed">
                          “{quote.text}”
                        </blockquote>
                        <p className="mt-1 text-[10px] tracking-[0.2em] uppercase font-mono text-[var(--muted-ink)]">
                          {subtopic.title} →{" "}
                          <Link
                            href={`/dashboard/claim/${claim.id}?report=${encodeURIComponent(reportUrl)}`}
                            className="hover:text-[var(--brand)] transition-colors"
                          >
                            Claim #{String(claim.index).padStart(2, "0")}
                          </Link>
                        </p>
                      </div>
                    ))}
                    {quotes.length > 2 && (
                      <p className="text-[10px] tracking-[0.2em] uppercase font-mono text-[var(--faint-ink)]">
                        … and {quotes.length - 2} more in this topic
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* All Quotes */}
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="kicker">B · Every quote</p>
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-[var(--ink)]">
            <span className="italic text-[var(--brand)]">Verbatim</span> contributions.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {authorQuotes.map(({ quote, claim, topic, subtopic }, index) => (
            <div
              key={`${quote.id}-${claim.id}-${topic.id}-${subtopic.id}-${index}`}
              className="space-y-2"
            >
              <div className="text-[10px] tracking-[0.2em] uppercase font-mono text-[var(--muted-ink)]">
                <Link
                  href={`/dashboard/${topic.id}?report=${encodeURIComponent(reportUrl)}`}
                  className="hover:text-[var(--brand)] transition-colors"
                >
                  {topic.title}
                </Link>
                {" → "}
                {subtopic.title}
                {" → "}
                <Link
                  href={`/dashboard/claim/${claim.id}?report=${encodeURIComponent(reportUrl)}`}
                  className="hover:text-[var(--brand)] transition-colors"
                >
                  Claim #{String(claim.index).padStart(2, "0")}
                </Link>
              </div>
              <QuoteCard
                quote={quote}
                demographics={demographics}
                colorIndex={topic.colorIndex}
              />
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
};

export default InterviewPage;