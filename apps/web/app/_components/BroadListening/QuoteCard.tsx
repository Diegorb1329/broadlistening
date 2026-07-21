import { TQuote } from "./TopicItem";
import { TDemographics } from "./utils/fetch-demographics";
import { blo } from "blo";
import { Quote, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { TopicColors } from "./utils/parse-topics";

const QuoteCard = ({
  quote,
  demographics,
  colorIndex,
  source,
  similarClaimTitle,
  reportUrl,
}: {
  quote: TQuote;
  demographics: TDemographics;
  colorIndex: number;
  source?: 'main' | 'similar';
  similarClaimTitle?: string;
  reportUrl?: string;
}) => {
  const authorGender = demographics[quote.authorId]?.gender;
  const authorAgeGroup = demographics[quote.authorId]?.ageGroup;

  const topicColor = `rgb(${TopicColors[colorIndex]})`;
  const shortAuthor = `${quote.authorId.slice(0, 8)}…${quote.authorId.slice(-4)}`;

  return (
    <article
      className="bg-[var(--card)] border border-[var(--hairline)] p-5 space-y-4"
      style={{ borderLeft: `3px solid ${topicColor}` }}
    >
      {source === "similar" && similarClaimTitle && (
        <p className="kicker-muted">
          From similar claim: “{similarClaimTitle}”
        </p>
      )}

      <blockquote className="relative pl-6">
        <Quote
          className="size-4 absolute left-0 top-1"
          style={{ color: topicColor, opacity: 0.7 }}
        />
        {quote.source ? (
          <a
            href={quote.source}
            target="_blank"
            rel="noopener noreferrer"
            className="font-serif italic text-[15px] leading-relaxed text-[var(--ink)] hover:text-[var(--brand)] transition-colors inline-flex items-baseline gap-1"
          >
            <span>{quote.text}</span>
            <ExternalLink className="size-3 inline-block flex-shrink-0" />
          </a>
        ) : (
          <span className="font-serif italic text-[15px] leading-relaxed text-[var(--ink)]">
            {quote.text}
          </span>
        )}
      </blockquote>

      <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline)]">
        {reportUrl ? (
          <Link
            href={`/interview/${encodeURIComponent(quote.authorId)}?report=${encodeURIComponent(reportUrl)}`}
            className="flex items-center gap-3 transition-colors group"
          >
            <div className="h-8 w-8 overflow-hidden bg-[var(--paper-alt)] border border-[var(--hairline)]">
              <Image
                src={blo(`0x${quote.authorId}`)}
                alt="Author avatar"
                className="h-full w-full object-cover"
                width={32}
                height={32}
              />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-mono tracking-tight text-[var(--ink)] group-hover:text-[var(--brand)] transition-colors">
                {shortAuthor}
              </div>
              <div className="text-[10px] tracking-[0.2em] uppercase font-mono text-[var(--muted-ink)]">
                {authorGender && authorAgeGroup
                  ? `${authorGender.charAt(0).toUpperCase()} · ${authorAgeGroup}`
                  : "Unknown demographics"}
              </div>
            </div>
          </Link>
        ) : (
          <>
            <div className="h-8 w-8 overflow-hidden bg-[var(--paper-alt)] border border-[var(--hairline)]">
              <Image
                src={blo(`0x${quote.authorId}`)}
                alt="Author avatar"
                className="h-full w-full object-cover"
                width={32}
                height={32}
              />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-mono tracking-tight text-[var(--ink)]">
                {shortAuthor}
              </div>
              <div className="text-[10px] tracking-[0.2em] uppercase font-mono text-[var(--muted-ink)]">
                {authorGender && authorAgeGroup
                  ? `${authorGender.charAt(0).toUpperCase()} · ${authorAgeGroup}`
                  : "Unknown demographics"}
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
};

export default QuoteCard;