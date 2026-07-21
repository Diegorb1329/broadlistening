"use client";
import { MessageCircle } from "lucide-react";
import React, { useState } from "react";
import ClaimBoxes from "./ClaimBoxes";
import SubtopicPopup from "./SubtopicPopup";
import ActivityChart from "./ActivityChart";
import { TopicColors } from "./utils/parse-topics";
import { TDemographics } from "./utils/fetch-demographics";

export type TQuote = {
  id: string;
  text: string;
  authorId: string;
  authorIndex: number;
  source?: string;
  reference?: {
    timestamp?: string;
  };
};

export type TClaim = {
  id: string;
  index: number;
  content: string;
  quotes: TQuote[];
  similarClaims?: TSimilarClaim[];
};

export type TSimilarClaim = {
  id: string;
  title: string;
  quotes: TQuote[];
  number: number;
  similarClaims?: TSimilarClaim[];
};

export type TSubtopic = {
  id: string;
  title: string;
  description: string;
  claims: TClaim[];
};

export type TTopic = {
  id: string;
  title: string;
  description: string;
  subtopics: TSubtopic[];
  colorIndex: number;
};

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


const TopicItem = ({
  data,
  demographics,
  filter,
  reportUrl,
}: {
  data: TTopic;
  demographics: TDemographics;
  filter?: {
    gender: TDemographics[string]["gender"][];
    age: TDemographics[string]["ageGroup"][];
  };
  reportUrl: string;
}) => {
  const [highlightedSubtopicId, setHighlightedSubtopicId] = useState<
    string | null
  >(null);
  const [showAllSubtopics, setShowAllSubtopics] = useState(false);

  const authorMatchesFilter = (authorId: string) => {
    if (!filter) return true;
    const gender = demographics[authorId]?.gender;
    const age = demographics[authorId]?.ageGroup;
    if (!gender || !age) return false;

    const matchesGender = filter.gender.includes(gender);
    const matchesAge = filter.age.includes(age);
    if (matchesAge !== matchesGender) return true;
    return matchesGender && matchesAge;
  };

  const filteredClaimIds: string[] = [];
  data.subtopics.forEach((subtopic) => {
    subtopic.claims.forEach((claim) => {
      claim.quotes.forEach((quote) => {
        if (authorMatchesFilter(quote.authorId)) {
          filteredClaimIds.push(claim.id);
        }
      });
    });
  });

  const getHighlightedSubtopicClaimIds = (subtopicId: string) => {
    const subtopic = data.subtopics.find(
      (subtopic) => subtopic.id === subtopicId
    );
    if (!subtopic) return [];
    return subtopic.claims
      .filter((claim) => {
        return filteredClaimIds.includes(claim.id);
      })
      .map((claim) => claim.id);
  };

  const highlightedClaimIds = filter
    ? new Set(filteredClaimIds)
    : highlightedSubtopicId
    ? new Set(getHighlightedSubtopicClaimIds(highlightedSubtopicId))
    : new Set<string>();

  const totalClaims = data.subtopics.reduce((acc, subtopic) => {
    return acc + subtopic.claims.length;
  }, 0);
  const totalPeople = calculateTotalPeople(data);

  const topicColor = `rgb(${TopicColors[data.colorIndex]})`;

  return (
    <article
      className="relative bg-[var(--card)] border border-[var(--hairline)] pl-6 pr-6 py-6 transition-colors hover:border-[var(--brand)]/40"
      style={{ borderLeftWidth: 3, borderLeftColor: topicColor }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
        <div className="order-2 lg:order-1 space-y-5">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className="font-mono text-[10px] tracking-[0.25em] uppercase"
              style={{ color: topicColor }}
            >
              Claim grid · {totalClaims}
            </span>
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-[var(--faint-ink)]">
              {totalPeople} voices
            </span>
          </div>
          <ClaimBoxes
            data={data}
            highlightedClaimIds={highlightedClaimIds}
            demographics={demographics}
            reportUrl={reportUrl}
          />
        </div>
        <div className="order-1 lg:order-2 space-y-4">
          <header className="space-y-3">
            <p className="kicker-muted" style={{ color: topicColor }}>
              Topic
            </p>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-serif text-xl md:text-2xl leading-snug tracking-tight flex-1 text-[var(--ink)]">
                {data.title}
              </h3>
              <ActivityChart data={data} className="flex-shrink-0 mt-1" />
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--muted-ink)] font-mono tracking-[0.15em] uppercase">
              <MessageCircle className="size-3.5" />
              <span className="tabular-nums">{totalClaims} claims · {totalPeople} voices</span>
            </div>
          </header>

          <p className="text-sm leading-relaxed text-[var(--body)]">
            {data.description}
          </p>

          <div className="space-y-2 pt-1">
            <p className="kicker-muted">Subtopics</p>
            <div className="flex flex-wrap gap-1.5">
              {(showAllSubtopics
                ? data.subtopics
                : data.subtopics.slice(0, 5)
              ).map((subtopic) => (
                <SubtopicPopup
                  key={subtopic.id}
                  data={subtopic}
                  colorIndex={data.colorIndex}
                  asChild
                  onHoverStart={() => setHighlightedSubtopicId(subtopic.id)}
                  onHoverEnd={() => setHighlightedSubtopicId(null)}
                  trigger={
                    <a
                      className="inline-flex items-center text-[11px] font-medium px-2 py-1 border transition-colors hover:bg-[var(--paper-alt)]"
                      style={{
                        color: topicColor,
                        borderColor: `rgba(${TopicColors[data.colorIndex]}, 0.35)`,
                      }}
                      href={`/dashboard/${data.id}?report=${encodeURIComponent(reportUrl)}#${subtopic.id}`}
                    >
                      {subtopic.title}
                    </a>
                  }
                />
              ))}
              {data.subtopics.length > 5 && (
                <button
                  onClick={() => setShowAllSubtopics(!showAllSubtopics)}
                  className="inline-flex items-center text-[11px] font-medium px-2 py-1 border border-[var(--brand)]/30 text-[var(--brand)] hover:bg-[var(--brand-soft)] transition-colors"
                >
                  {showAllSubtopics ? "Show less" : `+${data.subtopics.length - 5} more`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default TopicItem;
