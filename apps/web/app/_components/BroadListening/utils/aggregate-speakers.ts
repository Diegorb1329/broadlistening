import { TTopic } from "../TopicItem";
import { TDemographics } from "./fetch-demographics";

export type TSpeaker = {
  authorId: string;
  demographics: {
    gender?: "male" | "female";
    ageGroup?: "<18" | "18-25" | "25-35" | "35-55" | "55+";
    location?: string;
  };
  stats: {
    totalQuotes: number;
    totalClaims: number;
    topicsCount: number;
  };
  topics: Array<{
    id: string;
    title: string;
    colorIndex: number;
  }>;
  subtopics: Array<{
    id: string;
    title: string;
    topicId: string;
  }>;
};

export const aggregateSpeakers = (
  topics: TTopic[],
  demographics: TDemographics
): TSpeaker[] => {
  const speakerMap = new Map<string, TSpeaker>();

  // Iterate through all topics, subtopics, claims, and quotes
  topics.forEach((topic) => {
    topic.subtopics.forEach((subtopic) => {
      subtopic.claims.forEach((claim) => {
        // Process direct quotes
        claim.quotes.forEach((quote) => {
          const authorId = quote.authorId;

          if (!speakerMap.has(authorId)) {
            speakerMap.set(authorId, {
              authorId,
              demographics: demographics[authorId] || {},
              stats: {
                totalQuotes: 0,
                totalClaims: 0,
                topicsCount: 0,
              },
              topics: [],
              subtopics: [],
            });
          }

          const speaker = speakerMap.get(authorId)!;
          speaker.stats.totalQuotes++;

          // Add topic if not already added
          if (!speaker.topics.find((t) => t.id === topic.id)) {
            speaker.topics.push({
              id: topic.id,
              title: topic.title,
              colorIndex: topic.colorIndex,
            });
          }

          // Add subtopic if not already added
          if (!speaker.subtopics.find((s) => s.id === subtopic.id)) {
            speaker.subtopics.push({
              id: subtopic.id,
              title: subtopic.title,
              topicId: topic.id,
            });
          }
        });

        // Process similar claims quotes
        claim.similarClaims?.forEach((similarClaim) => {
          similarClaim.quotes?.forEach((quote) => {
            const authorId = quote.authorId;

            if (!speakerMap.has(authorId)) {
              speakerMap.set(authorId, {
                authorId,
                demographics: demographics[authorId] || {},
                stats: {
                  totalQuotes: 0,
                  totalClaims: 0,
                  topicsCount: 0,
                },
                topics: [],
                subtopics: [],
              });
            }

            const speaker = speakerMap.get(authorId)!;
            speaker.stats.totalQuotes++;

            // Add topic if not already added
            if (!speaker.topics.find((t) => t.id === topic.id)) {
              speaker.topics.push({
                id: topic.id,
                title: topic.title,
                colorIndex: topic.colorIndex,
              });
            }

            // Add subtopic if not already added
            if (!speaker.subtopics.find((s) => s.id === subtopic.id)) {
              speaker.subtopics.push({
                id: subtopic.id,
                title: subtopic.title,
                topicId: topic.id,
              });
            }
          });
        });

        // Count unique claims per author
        const claimAuthors = new Set<string>();
        claim.quotes.forEach((quote) => claimAuthors.add(quote.authorId));
        claim.similarClaims?.forEach((similarClaim) => {
          similarClaim.quotes?.forEach((quote) =>
            claimAuthors.add(quote.authorId)
          );
        });

        claimAuthors.forEach((authorId) => {
          const speaker = speakerMap.get(authorId);
          if (speaker) {
            speaker.stats.totalClaims++;
          }
        });
      });
    });
  });

  // Calculate topic counts and sort speakers by total quotes
  const speakers = Array.from(speakerMap.values()).map((speaker) => ({
    ...speaker,
    stats: {
      ...speaker.stats,
      topicsCount: speaker.topics.length,
    },
  }));

  // Sort by total quotes (descending)
  return speakers.sort((a, b) => b.stats.totalQuotes - a.stats.totalQuotes);
};

