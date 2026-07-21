"use client";

import { useMemo } from "react";
import { TTopic } from "./TopicItem";
import { TopicColors } from "./utils/parse-topics";
import Link from "next/link";
import * as d3 from "d3";

interface TreemapItem {
  id: string;
  title: string;
  value: number;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isTopic: boolean;
  topicId?: string;
  subtopicId?: string;
}

interface TopicTreemapProps {
  topics: TTopic[];
  reportUrl: string;
}

// Tree node structure for D3 hierarchy
interface TreeNode {
  name: string;
  value: number;
  id: string;
  data: TreemapItem;
  children?: TreeNode[];
}

const TopicTreemap = ({ topics, reportUrl }: TopicTreemapProps) => {
  const treemapLayout = useMemo(() => {
    // Calculate total claims for each topic
    const topicItems: Array<{ value: number; topic: TTopic }> = topics.map((topic) => {
      const topicClaimsCount = topic.subtopics.reduce(
        (sum, subtopic) => sum + subtopic.claims.length,
        0
      );
      return {
        value: topicClaimsCount,
        topic,
      };
    }).filter(item => item.value > 0);

    // Sort by value descending
    topicItems.sort((a, b) => b.value - a.value);
    
    // Ensure we have items to layout
    if (topicItems.length === 0) {
      return [];
    }

    // Create a color scale for topics using the existing TopicColors palette
    const colorScale = new Map<string, string>();
    
    topicItems.forEach((item) => {
      const color = `rgb(${TopicColors[item.topic.colorIndex]})`;
      colorScale.set(item.topic.id, color);
    });

    const containerWidth = 1000;
    const containerHeight = 600;
    
    // Prepare tree structure for D3
    const treeData: TreeNode = {
      name: "root",
      value: 0,
      id: "root",
      data: {
        id: "root",
        title: "root",
        value: 0,
        color: "",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        isTopic: false,
      },
      children: topicItems.map(item => ({
        name: item.topic.title,
        value: item.value,
        id: item.topic.id,
        data: {
          id: item.topic.id,
          title: item.topic.title,
          value: item.value,
          color: colorScale.get(item.topic.id) || `rgb(${TopicColors[0]})`,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          isTopic: true,
          topicId: item.topic.id,
        },
      })),
    };

    // Create D3 hierarchy
    const hierarchy = d3.hierarchy(treeData).sum((d) => d.value);

    // Create treemap layout
    const treemap = d3.treemap<TreeNode>()
      .size([containerWidth, containerHeight])
      .padding(2)
      .round(true);

    const root = treemap(hierarchy);

    // Extract leaf nodes and convert to TreemapItem format
    const topicLayouts: TreemapItem[] = root.leaves().map((leaf) => {
      const data = leaf.data.data;
      return {
        ...data,
        x: leaf.x0,
        y: leaf.y0,
        width: leaf.x1 - leaf.x0,
        height: leaf.y1 - leaf.y0,
      };
    });

    return topicLayouts;
  }, [topics]);

  const topicItems = treemapLayout;

  return (
    <div className="w-full h-[600px] border border-border rounded-lg overflow-hidden bg-muted/20">
      <svg
        viewBox="0 0 1000 600"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Render topics only */}
        {topicItems.map((topic) => (
          <Link
            key={topic.id}
            href={`/dashboard/${topic.id}?report=${encodeURIComponent(reportUrl)}`}
          >
            <g>
              <rect
                x={topic.x}
                y={topic.y}
                width={topic.width}
                height={topic.height}
                fill={topic.color}
                opacity={0.85}
                stroke="white"
                strokeWidth={2}
                className="hover:opacity-100 transition-opacity cursor-pointer"
              />
              
              {/* Topic label and count */}
              {topic.width > 60 && topic.height > 30 && (
                <>
                  <text
                    x={topic.x + topic.width / 2}
                    y={topic.y + topic.height / 2 - 4}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-white font-semibold pointer-events-none"
                    style={{
                      fontSize: Math.min(topic.width / 12, topic.height / 4, 14),
                    }}
                  >
                    {topic.title.length > 15
                      ? topic.title.substring(0, 12) + "..."
                      : topic.title}
                  </text>
                  <text
                    x={topic.x + topic.width / 2}
                    y={topic.y + topic.height / 2 + 12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-white pointer-events-none"
                    style={{
                      fontSize: Math.min(topic.width / 15, topic.height / 5, 12),
                    }}
                  >
                    ({topic.value})
                  </text>
                </>
              )}
            </g>
          </Link>
        ))}
      </svg>
    </div>
  );
};

export default TopicTreemap;

