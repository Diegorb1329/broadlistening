import Container from "@/components/ui/container";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import React from "react";
import SubTopic from "./SubTopic";
import { fetchReportData } from "@/app/_components/BroadListening/utils/fetch-report-data";
import ActivityChart from "@/app/_components/BroadListening/ActivityChart";
import Link from "next/link";
import { TSimilarClaim } from "@/app/_components/BroadListening/TopicItem";
import { Metadata } from "next";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ report?: string }>;
}): Promise<Metadata> {
  const searchParamsData = await searchParams;
  const encodedReportUrl = searchParamsData.report;
  
  if (!encodedReportUrl) {
    return {
      title: "Topic Not Found - Broad Listening",
      description: "The requested topic could not be found.",
    };
  }

  try {
    const reportUrl = decodeURIComponent(encodedReportUrl);
    
    const [paramsData, { parsedData: parsedTopics }] = await Promise.all([
      params,
      fetchReportData(reportUrl),
    ]);
    const topic = parsedTopics.topics.find(
      (topic) => topic.id === paramsData.topicId
    );

    if (!topic) {
      return {
        title: "Topic Not Found - Broad Listening",
        description: "The requested topic could not be found.",
      };
    }


    const topicPeople = new Set<string>();
    topic.subtopics.forEach((subtopic) => {
      subtopic.claims.forEach((claim) => {
        claim.quotes.forEach((quote) => {
          topicPeople.add(quote.authorId);
        });
      });
    });

    const totalClaims = topic.subtopics.reduce((acc, subtopic) => acc + subtopic.claims.length, 0);

    const title = `${topic.title} - Broad Listening`;
    const description = topic.description || `Analysis of ${topic.title} with ${totalClaims} claims from ${topicPeople.size} people`;

    const ogUrl = "/img/hero.png";

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://www.broadlistening.org/dashboard/${paramsData.topicId}`,
        siteName: "Broad Listening",
        images: [
          {
            url: ogUrl,
            width: 1200,
            height: 630,
            alt: `${topic.title} - Topic Analysis`,
          },
        ],
        locale: "en_US",
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogUrl],
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "Topic Analysis - Broad Listening",
      description: "Explore topic analysis and insights from interview data",
    };
  }
}

const TopicPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ report?: string }>;
}) => {
  const searchParamsData = await searchParams;
  const encodedReportUrl = searchParamsData.report;
  
  if (!encodedReportUrl) {
    return (
      <Container className="flex flex-col gap-4 items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-5 max-w-md">
          <p className="kicker">Missing report</p>
          <h1 className="font-serif text-3xl text-[var(--ink)]">
            Provide a report URL to <span className="italic text-[var(--brand)]">view this topic</span>.
          </h1>
          <Link href="/" className="btn-editorial btn-editorial-primary inline-flex">
            Enter report URL
          </Link>
        </div>
      </Container>
    );
  }

  const reportUrl = decodeURIComponent(encodedReportUrl);
  
  const [paramsData, { demographics: demographicsData, parsedData: parsedTopics }] = await Promise.all([
    params,
    fetchReportData(reportUrl),
  ]);
  
  const topic = parsedTopics.topics.find(
    (topic) => topic.id === paramsData.topicId
  );

  if (!topic) redirect("/not-found");

  // Use demographicsData (or empty object if not available)
  const demographics = demographicsData || {};

  // Calculate total quotes including similar claims
  const totalQuotes = topic.subtopics.reduce((acc, subtopic) => {
    return acc + subtopic.claims.reduce((claimAcc, claim) => {
      const mainQuotes = claim.quotes?.length || 0;
      const similarQuotes = claim.similarClaims?.reduce((similarAcc: number, similarClaim: TSimilarClaim) => 
        similarAcc + (similarClaim.quotes?.length || 0), 0) || 0;
      return claimAcc + mainQuotes + similarQuotes;
    }, 0);
  }, 0);

  // Calculate total people for this topic
  const topicPeople = new Set<string>();
  topic.subtopics.forEach((subtopic) => {
    subtopic.claims.forEach((claim) => {
      claim.quotes.forEach((quote) => {
        topicPeople.add(quote.authorId);
      });
    });
  });

  const totalTopicClaims = topic.subtopics.reduce((acc, subtopic) => acc + subtopic.claims.length, 0);

  // Use the topic palette to colour the editorial accents on this page.
  // (Inline style because the colour is per-topic and lives in `TopicColors`.)
  const topicTitle = parsedTopics.title;
  const topicIndex = parsedTopics.topics.findIndex((t) => t.id === paramsData.topicId);

  return (
    <Container className="space-y-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 text-[10px] font-mono tracking-[0.25em] uppercase text-[var(--muted-ink)]">
        <Link
          href={`/dashboard?report=${encodeURIComponent(reportUrl)}`}
          className="inline-flex items-center gap-2 hover:text-[var(--brand)] transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to dashboard</span>
        </Link>
        <span className="text-[var(--faint-ink)]">/</span>
        <span className="text-[var(--faint-ink)] truncate max-w-xs">{topicTitle}</span>
      </div>

      <header className="space-y-5">
        <p className="kicker">
          Topic {String(topicIndex + 1).padStart(2, "0")} of {String(parsedTopics.topics.length).padStart(2, "0")}
        </p>
        <div className="flex items-start justify-between gap-6">
          <h1 className="font-serif text-3xl md:text-5xl tracking-tight leading-[1.05] text-[var(--ink)] flex-1">
            {topic.title}
          </h1>
          <ActivityChart data={topic} className="flex-shrink-0 mt-2" />
        </div>
        <div className="w-12 h-px bg-[var(--ink)]/30" />
        <p className="text-base md:text-lg text-[var(--body)] leading-relaxed max-w-3xl">
          {topic.description}
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 border-t border-b border-[var(--hairline)] py-6">
        <div className="stat-column">
          <div className="stat-num tabular-nums">{totalTopicClaims}</div>
          <div className="stat-label">Claims</div>
        </div>
        <Link
          href={`/dashboard/people?report=${encodeURIComponent(reportUrl)}&topic=${topic.id}`}
          className="stat-column group hover:opacity-90 transition-opacity"
        >
          <div className="stat-num tabular-nums group-hover:text-[var(--brand)] transition-colors">
            {topicPeople.size}
          </div>
          <div className="stat-label group-hover:underline">People ↗</div>
        </Link>
        <div className="stat-column">
          <div className="stat-num tabular-nums">{topic.subtopics.length}</div>
          <div className="stat-label">Subtopics</div>
        </div>
        <div className="stat-column">
          <div className="stat-num tabular-nums">{totalQuotes}</div>
          <div className="stat-label">Quotes</div>
        </div>
      </div>

      <div className="space-y-12">
        {topic.subtopics.map((subtopic, idx) => (
          <SubTopic
            key={subtopic.id}
            subtopic={subtopic}
            topic={topic}
            demographics={demographics}
            index={idx}
            total={topic.subtopics.length}
          />
        ))}
      </div>
    </Container>
  );
};

export default TopicPage;
