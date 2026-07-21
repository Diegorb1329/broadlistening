"use client";

import { useState, useMemo, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import SpeakersDisplay from "@/app/_components/BroadListening/SpeakersDisplay";
import SpeakerFiltersComponent, { SpeakerFilters } from "@/app/_components/BroadListening/SpeakerFilters";
import { useData } from "@/app/_components/BroadListening/DataContext";

interface PeoplePageClientProps {
  reportUrl: string;
  prefilterTopicId?: string;
}

const PeoplePageClient = ({
  reportUrl,
  prefilterTopicId,
}: PeoplePageClientProps) => {
  const { data, loadData } = useData();
  const [filters, setFilters] = useState<SpeakerFilters>({
    topics: prefilterTopicId ? [prefilterTopicId] : [],
    subtopics: [],
    locations: [],
    search: "",
  });

  // Load data if not already loaded
  useEffect(() => {
    if (data.reportUrl !== reportUrl || data.topics.length === 0) {
      loadData(reportUrl);
    }
  }, [reportUrl, data.reportUrl, data.topics.length, loadData]);

  // Get available locations from demographics
  const availableLocations = useMemo(() => {
    const locations = new Set<string>();
    Object.values(data.demographics).forEach((demo) => {
      if (demo.location) {
        locations.add(demo.location);
      }
    });
    return Array.from(locations).sort();
  }, [data.demographics]);

  // Filter speakers
  const filteredSpeakers = useMemo(() => {
    if (data.speakers.length === 0) return [];
    
    return data.speakers.filter((speaker) => {
      // Topic filter
      if (filters.topics.length > 0) {
        const hasMatchingTopic = speaker.topics.some((topic) =>
          filters.topics.includes(topic.id)
        );
        if (!hasMatchingTopic) return false;
      }

      // Subtopic filter
      if (filters.subtopics.length > 0) {
        const hasMatchingSubtopic = speaker.subtopics.some((subtopic) =>
          filters.subtopics.includes(subtopic.id)
        );
        if (!hasMatchingSubtopic) return false;
      }


      // Location filter
      if (filters.locations.length > 0) {
        if (
          !speaker.demographics.location ||
          !filters.locations.includes(speaker.demographics.location)
        ) {
          return false;
        }
      }

      // Search filter
      if (filters.search.trim()) {
        const searchLower = filters.search.toLowerCase();
        return speaker.authorId.toLowerCase().includes(searchLower);
      }

      return true;
    });
  }, [data.speakers, filters]);

  const Breadcrumb = (
    <div className="flex items-center gap-3 text-[10px] font-mono tracking-[0.25em] uppercase text-[var(--muted-ink)]">
      <Link
        href={`/dashboard?report=${encodeURIComponent(reportUrl)}`}
        className="inline-flex items-center gap-2 hover:text-[var(--brand)] transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        <span>Back to dashboard</span>
      </Link>
      <span className="text-[var(--faint-ink)]">/</span>
      <span className="text-[var(--faint-ink)]">Speakers</span>
    </div>
  );

  if (data.loading) {
    return (
      <div className="space-y-8">
        {Breadcrumb}
        <div className="flex flex-col gap-4 items-center justify-center min-h-[50vh]">
          <div className="animate-pulse space-y-4 text-center">
            <div className="h-8 w-48 bg-[var(--paper-alt)] mx-auto" />
            <div className="h-4 w-64 bg-[var(--paper-alt)] mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="space-y-8">
        {Breadcrumb}
        <div className="flex flex-col gap-4 items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <p className="kicker text-[var(--signal)]">Error</p>
            <h1 className="font-serif text-3xl text-[var(--ink)]">
              Could not load this report.
            </h1>
            <p className="text-[var(--muted-ink)]">{data.error}</p>
            <Link
              href={`/dashboard?report=${encodeURIComponent(reportUrl)}`}
              className="btn-editorial btn-editorial-primary inline-flex"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isFiltered =
    filters.topics.length > 0 ||
    filters.subtopics.length > 0 ||
    filters.locations.length > 0 ||
    Boolean(filters.search);

  return (
    <div className="space-y-10">
      {Breadcrumb}

      <header className="space-y-5 border-b border-[var(--hairline)] pb-8">
        <p className="kicker">Speakers · individual voices</p>
        <h1 className="font-serif text-4xl md:text-5xl tracking-tight leading-[1.05] text-[var(--ink)]">
          The <span className="italic text-[var(--brand)]">people</span> behind the data.
        </h1>
        <div className="flex flex-wrap items-baseline gap-3 font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted-ink)]">
          <span className="tabular-nums">{filteredSpeakers.length} speakers</span>
          <span className="text-[var(--faint-ink)]">·</span>
          <span>{isFiltered ? "match your filters" : "total in this report"}</span>
        </div>
      </header>

      <SpeakerFiltersComponent
        topics={data.topics}
        availableLocations={availableLocations}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <SpeakersDisplay speakers={filteredSpeakers} reportUrl={reportUrl} />
    </div>
  );
};

export default PeoplePageClient;
