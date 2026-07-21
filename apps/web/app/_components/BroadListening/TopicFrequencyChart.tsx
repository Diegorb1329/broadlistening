"use client";

import React, { useMemo, useState } from "react";
import { TTopic } from "./TopicItem";
import { TopicColors } from "./utils/parse-topics";
import { TimestampFilterType } from "./TimestampFilter";
import { Button } from "@/components/ui/button";
import { Check, X, Search, TrendingUp } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface TopicFrequencyDataPoint {
  date: Date;
  topicCounts: { [topicId: string]: number };
  cumulativeCounts: { [topicId: string]: number };
}

interface TopicFrequencyChartProps {
  topics: TTopic[];
  timestampFilter?: TimestampFilterType;
  className?: string;
}

const TopicFrequencyChart = ({ topics, timestampFilter = "all", className = "" }: TopicFrequencyChartProps) => {
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [hiddenTopicIds, setHiddenTopicIds] = useState<Set<string>>(new Set());
  const [showTopicSelector, setShowTopicSelector] = useState(false);
  const [topicSearchQuery, setTopicSearchQuery] = useState("");
  const [currentSelection, setCurrentSelection] = useState<"trending" | "top5" | "top10" | "custom">("trending");
  
  const processedData = useMemo(() => {
    // Extract all quotes with timestamps from all topics
    const allQuotesWithTopics = topics.flatMap(topic =>
      topic.subtopics.flatMap(subtopic =>
        subtopic.claims.flatMap(claim => [
          ...claim.quotes.map(quote => ({ quote, topicId: topic.id, topicTitle: topic.title, topicColor: topic.colorIndex })),
          ...(claim.similarClaims || []).flatMap(sc => 
            (sc.quotes || []).map(quote => ({ quote, topicId: topic.id, topicTitle: topic.title, topicColor: topic.colorIndex }))
          )
        ])
      )
    );

    // Filter quotes by timestamp availability and validity
    const quotesWithTimestamps = allQuotesWithTopics
      .filter(({ quote }) => quote.reference?.timestamp)
      .map(({ quote, topicId, topicTitle, topicColor }) => ({
        topicId,
        topicTitle,
        topicColor,
        timestamp: new Date(quote.reference!.timestamp!)
      }))
      .filter(({ timestamp }) => !isNaN(timestamp.getTime()));

    // Apply timestamp filter
    const filteredQuotes = quotesWithTimestamps.filter(({ timestamp }) => {
      if (timestampFilter === "all") return true;
      
      if (typeof timestampFilter === "object" && "start" in timestampFilter && "end" in timestampFilter) {
        return timestamp >= timestampFilter.start && timestamp <= timestampFilter.end;
      }
      
      const now = new Date();
      switch (timestampFilter) {
        case "1week":
          return timestamp >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case "1month":
          return timestamp >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        case "6months":
          return timestamp >= new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        case "1year":
          return timestamp >= new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        default:
          return true;
      }
    });

    if (filteredQuotes.length === 0) return { dataPoints: [], topicInfo: [] };

    // Sort by timestamp
    const sortedQuotes = filteredQuotes.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Determine time granularity (daily or weekly)
    const timeSpan = sortedQuotes[sortedQuotes.length - 1].timestamp.getTime() - sortedQuotes[0].timestamp.getTime();
    const sixMonths = 180 * 24 * 60 * 60 * 1000;
    const useDailyGranularity = timeSpan < sixMonths;

    // Create time buckets
    const startDate = new Date(sortedQuotes[0].timestamp);
    const endDate = new Date(sortedQuotes[sortedQuotes.length - 1].timestamp);
    
    if (useDailyGranularity) {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate.setDate(startDate.getDate() - startDate.getDay());
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
      endDate.setHours(23, 59, 59, 999);
    }

    const bucketSize = useDailyGranularity ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const buckets: TopicFrequencyDataPoint[] = [];
    
    // Initialize buckets
    for (let date = new Date(startDate); date <= endDate; date = new Date(date.getTime() + bucketSize)) {
      buckets.push({
        date: new Date(date),
        topicCounts: {},
        cumulativeCounts: {}
      });
    }

    // Fill buckets with topic mentions
    sortedQuotes.forEach(({ timestamp, topicId }) => {
      const bucketIndex = Math.floor((timestamp.getTime() - startDate.getTime()) / bucketSize);
      if (bucketIndex >= 0 && bucketIndex < buckets.length) {
        if (!buckets[bucketIndex].topicCounts[topicId]) {
          buckets[bucketIndex].topicCounts[topicId] = 0;
        }
        buckets[bucketIndex].topicCounts[topicId]++;
      }
    });

    // Calculate cumulative counts
    const cumulativeTotals: { [topicId: string]: number } = {};
    buckets.forEach(bucket => {
      Object.keys(bucket.topicCounts).forEach(topicId => {
        if (!cumulativeTotals[topicId]) cumulativeTotals[topicId] = 0;
        cumulativeTotals[topicId] += bucket.topicCounts[topicId];
        bucket.cumulativeCounts[topicId] = cumulativeTotals[topicId];
      });
      
      // Ensure all topics have cumulative counts (carry forward previous values)
      topics.forEach(topic => {
        if (bucket.cumulativeCounts[topic.id] === undefined) {
          bucket.cumulativeCounts[topic.id] = cumulativeTotals[topic.id] || 0;
        }
      });
    });

    // Get topic info for legend
    const allTopicInfo = topics
      .filter(topic => cumulativeTotals[topic.id] > 0)
      .map(topic => ({
        id: topic.id,
        title: topic.title,
        color: TopicColors[topic.colorIndex],
        total: cumulativeTotals[topic.id] || 0
      }))
      .sort((a, b) => b.total - a.total);

    return { dataPoints: buckets, allTopicInfo };
  }, [topics, timestampFilter]);
  
  // Initialize selected topics with trending by default
  const { dataPoints, allTopicInfo } = processedData;
  
  React.useEffect(() => {
    if (selectedTopicIds.size === 0 && allTopicInfo && allTopicInfo.length > 0 && dataPoints.length > 0) {
      // Use the same trending logic as the button
      const recentPeriods = Math.min(7, Math.floor(dataPoints.length * 0.3));
      const startIndex = Math.max(0, dataPoints.length - recentPeriods);
      
      const trendingScores = allTopicInfo.map(topic => {
        let recentActivity = 0;
        let totalActivity = 0;
        
        for (let i = startIndex; i < dataPoints.length; i++) {
          const periodCount = dataPoints[i].topicCounts[topic.id] || 0;
          recentActivity += periodCount;
        }
        
        for (let i = 0; i < dataPoints.length; i++) {
          const periodCount = dataPoints[i].topicCounts[topic.id] || 0;
          totalActivity += periodCount;
        }
        
        const recencyWeight = recentActivity / Math.max(recentPeriods, 1);
        const activityRatio = totalActivity > 0 ? recentActivity / totalActivity : 0;
        const trendingScore = recencyWeight * (1 + activityRatio);
        
        return { ...topic, trendingScore, recentActivity };
      });
      
      const trendingTopics = trendingScores
        .filter(topic => topic.recentActivity > 0)
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, 10);
      
      setSelectedTopicIds(new Set(trendingTopics.map(t => t.id)));
      setCurrentSelection("trending");
    }
  }, [allTopicInfo, selectedTopicIds.size, dataPoints]);
  
  // Filter topics based on selection
  const displayedTopicInfo = useMemo(() => 
    allTopicInfo ? allTopicInfo.filter(topic => 
      selectedTopicIds.has(topic.id)
    ) : []
  , [allTopicInfo, selectedTopicIds]);
  
  // Filter topic search
  const filteredTopicsForSelector = useMemo(() => 
    allTopicInfo ? allTopicInfo.filter(topic =>
      topic.title.toLowerCase().includes(topicSearchQuery.toLowerCase())
    ) : []
  , [allTopicInfo, topicSearchQuery]);

  // Prepare Chart.js data
  const chartData = useMemo(() => {
    if (dataPoints.length === 0 || displayedTopicInfo.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    // Create labels from dates
    const firstDate = dataPoints[0].date;
    const lastDate = dataPoints[dataPoints.length - 1].date;
    const currentYear = new Date().getFullYear();
    const needsYear = firstDate.getFullYear() !== lastDate.getFullYear() || 
                     firstDate.getFullYear() !== currentYear;

    const labels = dataPoints.map(point => 
      point.date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        ...(needsYear ? { year: 'numeric' } : {})
      })
    );

    // Create datasets for each topic
    const datasets = displayedTopicInfo.map((topic) => {
      const isHidden = hiddenTopicIds.has(topic.id);
      return {
        label: topic.title,
        data: dataPoints.map(point => point.cumulativeCounts[topic.id] || 0),
        borderColor: isHidden ? 'rgba(200, 200, 200, 0.3)' : `rgb(${topic.color.join(',')})`,
        backgroundColor: isHidden ? 'rgba(200, 200, 200, 0.1)' : `rgba(${topic.color.join(',')}, 0.1)`,
        borderWidth: isHidden ? 1 : 2.5,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: isHidden ? 'rgba(200, 200, 200, 0.3)' : `rgb(${topic.color.join(',')})`,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        hidden: false, // Keep dataset visible but styled differently
      };
    });

    return {
      labels,
      datasets
    };
  }, [dataPoints, displayedTopicInfo, hiddenTopicIds]);

  // Chart.js options
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // We'll use our custom legend
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: TooltipItem<'line'>) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value} mentions`;
          },
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          color: 'rgba(0, 0, 0, 0.6)',
          font: {
            size: 11,
          },
        },
      },
      y: {
        display: true,
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          color: 'rgba(0, 0, 0, 0.6)',
          font: {
            size: 12,
          },
        },
        title: {
          display: true,
          text: 'Cumulative Mentions',
          color: 'rgba(0, 0, 0, 0.6)',
          font: {
            size: 12,
          },
        },
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    hover: {
      mode: 'index' as const,
      intersect: false,
    },
  }), []);

  if (dataPoints.length === 0 || !allTopicInfo || allTopicInfo.length === 0) {
    return (
      <div className={`w-full h-64 flex items-center justify-center text-muted-foreground ${className}`}>
        No data available for the selected time period
      </div>
    );
  }

  const toggleTopic = (topicId: string) => {
    const newSelected = new Set(selectedTopicIds);
    if (newSelected.has(topicId)) {
      newSelected.delete(topicId);
    } else {
      newSelected.add(topicId);
    }
    setSelectedTopicIds(newSelected);
    setCurrentSelection("custom");
  };

  const toggleTopicVisibility = (topicId: string) => {
    const newHidden = new Set(hiddenTopicIds);
    if (newHidden.has(topicId)) {
      newHidden.delete(topicId);
    } else {
      newHidden.add(topicId);
    }
    setHiddenTopicIds(newHidden);
  };

  const removeTopic = (topicId: string) => {
    const newSelected = new Set(selectedTopicIds);
    newSelected.delete(topicId);
    setSelectedTopicIds(newSelected);
    setCurrentSelection("custom");
  };

  const selectTopN = (n: number) => {
    if (!allTopicInfo) return;
    const topTopics = allTopicInfo.slice(0, n);
    setSelectedTopicIds(new Set(topTopics.map(t => t.id)));
    setHiddenTopicIds(new Set()); // Reset hidden state
    setCurrentSelection(n === 5 ? "top5" : "top10");
  };

  const selectTrending = () => {
    if (dataPoints.length === 0 || !allTopicInfo) return;
    
    // Calculate trending score for each topic based on recent activity
    const recentPeriods = Math.min(7, Math.floor(dataPoints.length * 0.3)); // Last 30% of time or 7 periods, whichever is smaller
    const startIndex = Math.max(0, dataPoints.length - recentPeriods);
    
    const trendingScores = allTopicInfo.map(topic => {
      let recentActivity = 0;
      let totalActivity = 0;
      
      // Sum activity in recent periods
      for (let i = startIndex; i < dataPoints.length; i++) {
        const periodCount = dataPoints[i].topicCounts[topic.id] || 0;
        recentActivity += periodCount;
      }
      
      // Sum total activity for normalization
      for (let i = 0; i < dataPoints.length; i++) {
        const periodCount = dataPoints[i].topicCounts[topic.id] || 0;
        totalActivity += periodCount;
      }
      
      // Calculate trending score: recent activity weighted by recency and normalized by total
      const recencyWeight = recentActivity / Math.max(recentPeriods, 1);
      const activityRatio = totalActivity > 0 ? recentActivity / totalActivity : 0;
      const trendingScore = recencyWeight * (1 + activityRatio);
      
      return {
        ...topic,
        trendingScore,
        recentActivity,
        totalActivity
      };
    });
    
    // Sort by trending score and select top trending topics
    const trendingTopics = trendingScores
      .filter(topic => topic.recentActivity > 0) // Only topics with recent activity
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 10); // Top 10 trending
    
    setSelectedTopicIds(new Set(trendingTopics.map(t => t.id)));
    setHiddenTopicIds(new Set()); // Reset hidden state
    setCurrentSelection("trending");
  };

  const clearAll = () => {
    setSelectedTopicIds(new Set());
    setHiddenTopicIds(new Set());
    setCurrentSelection("custom");
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {currentSelection === "trending" && "Trending Topics Over Time"}
            {currentSelection === "top5" && "Top 5 Topics Over Time"}
            {currentSelection === "top10" && "Top 10 Topics Over Time"}
            {currentSelection === "custom" && "Selected Topics Over Time"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {currentSelection === "trending" && `Currently trending topics with recent activity (${displayedTopicInfo.length} shown)`}
            {currentSelection === "top5" && `Most mentioned topics overall (${displayedTopicInfo.length} shown)`}
            {currentSelection === "top10" && `Most mentioned topics overall (${displayedTopicInfo.length} shown)`}
            {currentSelection === "custom" && `Custom selection (${displayedTopicInfo.length} of ${allTopicInfo?.length || 0} topics shown)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectTopN(5)}
          >
            Top 5
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectTopN(10)}
          >
            Top 10
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={selectTrending}
            className="gap-2"
          >
            <TrendingUp className="size-3" />
            Trending
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTopicSelector(!showTopicSelector)}
          >
            Select Topics
          </Button>
          {selectedTopicIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Topic Selector Panel */}
      {showTopicSelector && (
        <div className="mb-4 border border-border rounded-lg p-4 bg-muted/20">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">Select Topics to Display</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTopicSelector(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
          
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search topics..."
                value={topicSearchQuery}
                onChange={(e) => setTopicSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {filteredTopicsForSelector.map((topic) => {
              const isSelected = selectedTopicIds.has(topic.id);
              return (
                <button
                  key={topic.id}
                  onClick={() => toggleTopic(topic.id)}
                  className={`flex items-center gap-2 p-2 text-left text-sm rounded-md transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div
                    className="size-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: `rgb(${topic.color.join(',')})` }}
                  />
                  <span className="truncate flex-1">{topic.title}</span>
                  <span className="text-xs opacity-70">({topic.total})</span>
                  {isSelected && <Check className="size-3 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Legend */}
      {displayedTopicInfo.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {displayedTopicInfo.map((topic) => {
            const isHidden = hiddenTopicIds.has(topic.id);
            return (
              <div
                key={topic.id}
                className="flex items-center gap-1 px-3 py-1 text-xs rounded-full border border-border transition-colors"
                style={{ 
                  borderColor: isHidden ? 'rgba(200, 200, 200, 0.5)' : `rgb(${topic.color.join(',')})`,
                  opacity: isHidden ? 0.5 : 1
                }}
              >
                <button
                  onClick={() => toggleTopicVisibility(topic.id)}
                  className="flex items-center gap-2 hover:bg-muted/50 transition-colors"
                >
                  <div
                    className="size-2 rounded-full"
                    style={{ 
                      backgroundColor: isHidden ? 'rgba(200, 200, 200, 0.5)' : `rgb(${topic.color.join(',')})` 
                    }}
                  />
                  <span className="truncate max-w-32">{topic.title}</span>
                  <span className="text-muted-foreground">({topic.total})</span>
                </button>
                <button
                  onClick={() => removeTopic(topic.id)}
                  className="ml-1 hover:text-foreground transition-colors"
                >
                  <X className="size-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {displayedTopicInfo.length === 0 ? (
        <div className="w-full h-64 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg">
          <p className="text-center">No topics selected</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 gap-2"
            onClick={selectTrending}
          >
            <TrendingUp className="size-3" />
            Show Trending Topics
          </Button>
        </div>
      ) : (
        <div className="w-full border border-border rounded-lg p-4" style={{ height: '400px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
};

export default TopicFrequencyChart;