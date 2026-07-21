import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works · Broad Listening",
  description:
    "How Broad Listening turns raw comments into an explorable, publishable topic map.",
};

const STEPS = [
  {
    n: "01",
    title: "Upload comments",
    body: "Bring a CSV — one comment per row, in any language. Columns for author, link, and timestamp are detected automatically and carried into the report, so every claim stays traceable to a real person, place, and moment.",
  },
  {
    n: "02",
    title: "Extract claims",
    body: "A language model reads each comment and extracts specific, debatable claims — each backed by a verbatim quote from the original text. Vague comments legitimately produce zero claims: nothing is ever invented.",
  },
  {
    n: "03",
    title: "Let topics emerge",
    body: "There is no predefined taxonomy. The topic map is proposed from the claims themselves, then every claim is classified into it. Anything that doesn't fit lands in an explicit “Other” — never silently dropped.",
  },
  {
    n: "04",
    title: "Consolidate duplicates",
    body: "Similar claims are grouped: semantic similarity proposes candidates, and a model verifies which ones truly say the same thing. Popular positions surface with their full weight instead of being scattered.",
  },
  {
    n: "05",
    title: "Explore the report",
    body: "The result is a standard T3C report — topics, subtopics, claims, and quotes — rendered as an interactive dashboard with search, timelines, and treemaps. Every number traces back to who said what.",
  },
  {
    n: "06",
    title: "Publish to your own repository",
    body: "Sign in with Bluesky and publish: the report is stored permanently and publicly in your own AT Protocol repository — not on our servers. Anyone can verify it, cite it, and explore it. Your data stays yours.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="kicker mb-3">Broad Listening · Method</p>
      <h1
        className="font-serif text-4xl leading-tight mb-3"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        From a thousand voices to <span className="brand-italic">one map</span>
      </h1>
      <p className="mb-12" style={{ color: "var(--body)" }}>
        Broad Listening is democratic sensemaking: it turns large piles of
        unstructured public comments into a structured, explorable, verifiable
        topic map — with every claim grounded in a verbatim quote.
      </p>

      <ol className="space-y-8">
        {STEPS.map((s) => (
          <li key={s.n} className="card-editorial-flush flex gap-6">
            <span
              className="font-serif text-3xl leading-none shrink-0"
              style={{ fontFamily: "var(--font-playfair)", color: "var(--brand)" }}
            >
              {s.n}
            </span>
            <div>
              <h2
                className="font-serif text-xl mb-1"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                {s.title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--body)" }}>
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-14 card-editorial">
        <p className="kicker mb-2">Honest by design</p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--body)" }}>
          Failures are reported, never hidden: comments that can't be processed are
          listed with their reason, unclassifiable claims are shown under “Other”,
          and quotes are copied character-for-character from the source. The report
          format is open (<a className="underline hover:text-[var(--brand)]" href="https://talktothe.city" target="_blank" rel="noreferrer">Talk to the City</a> T3C v0.2),
          and the whole pipeline is{" "}
          <a
            className="underline hover:text-[var(--brand)]"
            href="https://github.com/Diegorb1329/broadlistening"
            target="_blank"
            rel="noreferrer"
          >
            open source
          </a>
          .
        </p>
      </div>
    </div>
  );
}
