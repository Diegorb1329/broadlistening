"use client";

import { Suspense } from "react";
import Container from "@/components/ui/container";
import Link from "next/link";
import PeoplePageClient from "./PeoplePageClient";
import { useSearchParams } from "next/navigation";

const PeoplePageContent = () => {
  const searchParams = useSearchParams();
  const reportUrl = searchParams.get("report");
  const prefilterTopicId = searchParams.get("topic");

  if (!reportUrl) {
    return (
      <Container className="flex flex-col gap-4 items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-5 max-w-md">
          <p className="kicker">Missing report</p>
          <h1 className="font-serif text-3xl text-[var(--ink)]">
            Provide a report URL to <span className="italic text-[var(--brand)]">view speakers</span>.
          </h1>
          <Link href="/" className="btn-editorial btn-editorial-primary inline-flex">
            Enter report URL
          </Link>
        </div>
      </Container>
    );
  }

  const decodedReportUrl = decodeURIComponent(reportUrl);

  return (
    <Container>
      <PeoplePageClient
        reportUrl={decodedReportUrl}
        prefilterTopicId={prefilterTopicId || undefined}
      />
    </Container>
  );
};

const PeoplePage = () => {
  return (
    <Suspense fallback={
      <Container className="flex flex-col gap-4 items-center justify-center min-h-[50vh]">
        <div className="animate-pulse space-y-4 text-center">
          <div className="h-8 w-48 bg-muted rounded mx-auto"></div>
          <div className="h-4 w-64 bg-muted rounded mx-auto"></div>
        </div>
      </Container>
    }>
      <PeoplePageContent />
    </Suspense>
  );
};

export default PeoplePage;
