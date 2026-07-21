import React from "react";
import { TTopic } from "./TopicItem";
import { TopicColors } from "./utils/parse-topics";
import ClaimPopup from "./ClaimPopup";
import { cn } from "@/lib/utils";
import { TDemographics } from "./utils/fetch-demographics";

const ClaimBoxes = ({
  data,
  highlightedClaimIds,
  size = "sm",
  demographics,
  reportUrl,
}: {
  data: TTopic;
  highlightedClaimIds: Set<string>;
  size?: "sm" | "lg";
  demographics?: TDemographics;
  reportUrl?: string;
}) => {
  const safeDemographics = demographics || {};
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {data.subtopics.map((subtopic) => {
        // Sort claims by number of similar claims (high to low) for consistent ordering
        const sortedClaims = [...subtopic.claims].sort((a, b) => {
          const aSimilarCount = a.similarClaims?.length || 0;
          const bSimilarCount = b.similarClaims?.length || 0;
          return bSimilarCount - aSimilarCount;
        });
        
        return sortedClaims.map((claim) => {
          const isHighlighted = highlightedClaimIds.has(claim.id);

          return (
            <ClaimPopup
              demographics={safeDemographics}
              key={claim.id}
              data={claim}
              colorIndex={data.colorIndex}
              subtopicTitle={subtopic.title}
              reportUrl={reportUrl}
              asChild
              trigger={
                <button
                  className={cn(
                    "relative group cursor-pointer rounded transition-all duration-200",
                    size === "sm"
                      ? "h-3 w-3"
                      : "h-4 w-4",
                    isHighlighted 
                      ? "scale-110 shadow-sm" 
                      : "hover:scale-105"
                  )}
                  style={{
                    backgroundColor: isHighlighted 
                      ? `rgb(${TopicColors[data.colorIndex]})` 
                      : `rgba(${TopicColors[data.colorIndex]}, 0.3)`,
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded"
                    style={{
                      backgroundColor: `rgb(${TopicColors[data.colorIndex]})`,
                    }}
                  />
                </button>
              }
            />
          );
        });
      })}
    </div>
  );
};

export default ClaimBoxes;
