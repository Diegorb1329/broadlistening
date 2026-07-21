import Container from "@/components/ui/container";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import React from "react";
import { fetchReportData } from "@/app/_components/BroadListening/utils/fetch-report-data";
import Link from "next/link";
import { TClaim, TQuote, TTopic, TSubtopic } from "@/app/_components/BroadListening/TopicItem";
import { TopicColors } from "@/app/_components/BroadListening/utils/parse-topics";
import { Metadata } from "next";
import QuoteCard from "@/app/_components/BroadListening/QuoteCard";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ claimId: string }>;
  searchParams: Promise<{ report?: string }>;
}): Promise<Metadata> {
  const searchParamsData = await searchParams;
  const encodedReportUrl = searchParamsData.report;
  
  if (!encodedReportUrl) {
    return {
      title: "Claim Not Found - Broad Listening",
      description: "The requested claim could not be found.",
    };
  }

  try {
    const reportUrl = decodeURIComponent(encodedReportUrl);
    
    const [paramsData, { parsedData: parsedTopics }] = await Promise.all([
      params,
      fetchReportData(reportUrl),
    ]);

    // Find the claim across all topics and subtopics
    let claim: TClaim | null = null;
    let topic: TTopic | null = null;
    let subtopicTitle = "";
    
    for (const topicItem of parsedTopics.topics) {
      for (const subtopic of topicItem.subtopics) {
        const foundClaim = subtopic.claims.find(c => c.id === paramsData.claimId);
        if (foundClaim) {
          claim = foundClaim;
          topic = topicItem;
          subtopicTitle = subtopic.title;
          break;
        }
      }
      if (claim) break;
    }

    if (!claim || !topic) {
      return {
        title: "Claim Not Found - Broad Listening",
        description: "The requested claim could not be found.",
      };
    }

    const totalQuotes = claim.quotes.length + (claim.similarClaims?.reduce((acc, sc) => acc + sc.quotes.length, 0) || 0);
    const uniquePeople = new Set([
      ...claim.quotes.map(q => q.authorId),
      ...(claim.similarClaims?.flatMap(sc => sc.quotes.map(q => q.authorId)) || [])
    ]).size;

    const title = `Claim #${claim.index}: ${claim.content.slice(0, 60)}${claim.content.length > 60 ? '...' : ''} - ${topic.title}`;
    const description = `Analysis of claim with ${totalQuotes} quotes from ${uniquePeople} people in ${subtopicTitle}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://www.broadlistening.org/dashboard/claim/${paramsData.claimId}`,
        siteName: "Broad Listening",
        images: [
          {
            url: "/img/hero.png",
            width: 1200,
            height: 630,
            alt: `Claim #${claim.index} - Analysis`,
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
      title: "Claim Analysis - Broad Listening",
      description: "Explore claim analysis and insights from interview data",
    };
  }
}

const ClaimPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ claimId: string }>;
  searchParams: Promise<{ report?: string }>;
}) => {
  const searchParamsData = await searchParams;
  const encodedReportUrl = searchParamsData.report;
  
  if (!encodedReportUrl) {
    return (
      <Container className="flex flex-col gap-4 items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <p className="kicker">Missing report</p>
          <h1 className="font-serif text-3xl text-[var(--ink)]">
            Provide a report URL to <span className="italic text-[var(--brand)]">view this claim</span>.
          </h1>
          <Link href="/" className="btn-editorial btn-editorial-primary inline-flex">
            Enter report URL
          </Link>
        </div>
      </Container>
    );
  }

  const reportUrl = decodeURIComponent(encodedReportUrl);
  
  const [paramsData, { parsedData: parsedTopics, demographics: demographicsData }] = await Promise.all([
    params,
    fetchReportData(reportUrl),
  ]);
  
  // Use demographicsData (or empty object if not available)
  const demographics = demographicsData || {};
  
  // Find the claim across all topics and subtopics
  let claim: TClaim | null = null;
  let topic: TTopic | null = null;
  let subtopic: TSubtopic | null = null;
  
  for (const topicItem of parsedTopics.topics) {
    for (const subtopicItem of topicItem.subtopics) {
      const foundClaim = subtopicItem.claims.find(c => c.id === paramsData.claimId);
      if (foundClaim) {
        claim = foundClaim;
        topic = topicItem;
        subtopic = subtopicItem;
        break;
      }
    }
    if (claim) break;
  }

  if (!claim || !topic || !subtopic) redirect("/not-found");

  // Collect all quotes from the claim and similar claims
  const allQuotes: (TQuote & { source: 'main' | 'similar', similarClaimTitle?: string })[] = [
    ...claim.quotes.map(quote => ({ ...quote, source: 'main' as const })),
    ...(claim.similarClaims?.flatMap(similarClaim => 
      similarClaim.quotes.map(quote => ({ 
        ...quote, 
        source: 'similar' as const, 
        similarClaimTitle: similarClaim.title 
      }))
    ) || [])
  ];

  // Calculate stats
  const totalQuotes = allQuotes.length;
  const uniquePeople = new Set(allQuotes.map(q => q.authorId)).size;

  const topicColor = `rgb(${TopicColors[topic.colorIndex]})`;

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
          href={`/dashboard/${topic.id}?report=${encodeURIComponent(reportUrl)}`}
          className="inline-flex items-center gap-2 hover:text-[var(--brand)] transition-colors max-w-xs truncate"
        >
          <ArrowLeft className="size-3.5" />
          {topic.title}
        </Link>
        <span className="text-[var(--faint-ink)]">/</span>
        <span className="text-[var(--faint-ink)]">Claim #{String(claim.index).padStart(2, "0")}</span>
      </div>

      {/* Header */}
      <header className="space-y-5">
        <p
          className="font-mono text-[10px] tracking-[0.3em] uppercase"
          style={{ color: topicColor }}
        >
          {subtopic.title} · Claim #{String(claim.index).padStart(2, "0")}
        </p>
        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl tracking-tight leading-[1.1] text-[var(--ink)] max-w-4xl">
          {claim.content}
        </h1>
        <div className="w-12 h-px bg-[var(--ink)]/30" />
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 md:gap-10 border-t border-b border-[var(--hairline)] py-6">
        <div className="stat-column">
          <div className="stat-num tabular-nums">{totalQuotes}</div>
          <div className="stat-label">Total quotes</div>
        </div>
        <div className="stat-column">
          <div className="stat-num tabular-nums">{uniquePeople}</div>
          <div className="stat-label">People</div>
        </div>
        <div className="stat-column">
          <div className="stat-num tabular-nums">{claim.quotes.length}</div>
          <div className="stat-label">Direct quotes</div>
        </div>
      </div>

      {claim.similarClaims && claim.similarClaims.length > 0 && (
        <div className="border-l-2 pl-5 py-2" style={{ borderColor: topicColor }}>
          <p className="kicker mb-2">Similar claims</p>
          <p className="text-sm text-[var(--body)] leading-relaxed max-w-2xl">
            This claim is grouped with{" "}
            <span className="font-serif italic text-[var(--ink)]">
              {claim.similarClaims.length} similar claim
              {claim.similarClaims.length !== 1 ? "s" : ""}
            </span>
            . All quotes from these related claims are shown below.
          </p>
        </div>
      )}

      {/* Quotes */}
      <div className="space-y-10">
        <div className="space-y-3">
          <p className="kicker">C · Supporting quotes</p>
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-[var(--ink)]">
            All <span className="italic text-[var(--brand)]">verbatim</span> source quotes.
          </h2>
        </div>

        {claim.quotes.length > 0 && (
          <div className="space-y-4">
            <p className="kicker-muted">Direct quotes</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {claim.quotes.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  demographics={demographics}
                  colorIndex={topic.colorIndex}
                  reportUrl={reportUrl}
                />
              ))}
            </div>
          </div>
        )}

        {claim.similarClaims?.map(
          (similarClaim) =>
            similarClaim.quotes.length > 0 && (
              <div key={similarClaim.id} className="space-y-4">
                <p className="kicker-muted">
                  From similar claim: “{similarClaim.title}”
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {similarClaim.quotes.map((quote) => (
                    <QuoteCard
                      key={quote.id}
                      quote={quote}
                      demographics={demographics}
                      colorIndex={topic.colorIndex}
                      reportUrl={reportUrl}
                      source="similar"
                      similarClaimTitle={similarClaim.title}
                    />
                  ))}
                </div>
              </div>
            )
        )}
      </div>
    </Container>
  );
};

export default ClaimPage;