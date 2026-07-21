"use client";

import React, { useState } from "react";
import { TClaim, TSubtopic, TTopic } from "./TopicItem";
import { Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearch } from "../SearchContext";

interface ActivityDataPoint {
  date: Date;
  count: number;
}

interface ActivityChartProps {
  data: TTopic | TSubtopic | TClaim[];
  className?: string;
}

const ActivityChart = ({ data, className = "" }: ActivityChartProps) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { timestampFilter } = useSearch();

  // Filter timestamps based on the current timestamp filter
  const isTimestampInRange = (timestamp: Date) => {
    if (timestampFilter === "all") return true;
    
    const now = new Date();
    
    if (typeof timestampFilter === "string") {
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
    } else {
      // Custom date range
      return timestamp >= timestampFilter.start && timestamp <= timestampFilter.end;
    }
  };

  // Get title from data
  const getTitle = () => {
    if (Array.isArray(data)) {
      return 'Activity Timeline';
    } else if ('subtopics' in data) {
      return data.title; // TTopic
    } else {
      return data.title; // TSubtopic
    }
  };

  // Extract all quotes with timestamps
  const getAllQuotes = () => {
    if (Array.isArray(data)) {
      // Handle array of claims
      return data.flatMap(claim => [
        ...claim.quotes,
        ...(claim.similarClaims || []).flatMap(sc => sc.quotes || [])
      ]);
    } else if ('subtopics' in data) {
      // Handle topic
      return data.subtopics.flatMap(subtopic =>
        subtopic.claims.flatMap(claim => [
          ...claim.quotes,
          ...(claim.similarClaims || []).flatMap(sc => sc.quotes || [])
        ])
      );
    } else {
      // Handle subtopic
      return data.claims.flatMap(claim => [
        ...claim.quotes,
        ...(claim.similarClaims || []).flatMap(sc => sc.quotes || [])
      ]);
    }
  };

  const quotes = getAllQuotes();
  
  // Extract and process timestamps, filtered by current timestamp filter
  const timestamps = quotes
    .map(quote => quote.reference?.timestamp)
    .filter(Boolean)
    .map(ts => new Date(ts as string))
    .filter(date => !isNaN(date.getTime()))
    .filter(isTimestampInRange)
    .sort((a, b) => a.getTime() - b.getTime());

  if (timestamps.length === 0) {
    return <div className={`w-24 h-10 ${className}`}></div>;
  }

  // Determine the time range and granularity based on filter
  let startDate: Date, endDate: Date;
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  
  // Determine if we should use daily or weekly granularity
  const shouldUseDailyGranularity = () => {
    if (timestampFilter === "all") {
      // For "all time", check the actual data span
      if (timestamps.length === 0) return true;
      const dataSpan = timestamps[timestamps.length - 1].getTime() - timestamps[0].getTime();
      const sixMonths = 180 * oneDay;
      return dataSpan < sixMonths;
    } else if (typeof timestampFilter === "string") {
      return timestampFilter !== "6months" && timestampFilter !== "1year"; // Use daily for 1week and 1month
    } else {
      // Custom date range
      const spanDays = (timestampFilter.end.getTime() - timestampFilter.start.getTime()) / oneDay;
      return spanDays < 180;
    }
  };
  
  const useDailyGranularity = shouldUseDailyGranularity();
  
  if (timestampFilter === "all") {
    // For "all time", use the actual data range
    const earliestTimestamp = timestamps[0];
    const latestTimestamp = timestamps[timestamps.length - 1];
    
    if (useDailyGranularity) {
      startDate = new Date(earliestTimestamp);
      startDate.setHours(0, 0, 0, 0); // Start of day
      
      endDate = new Date(latestTimestamp);
      endDate.setHours(23, 59, 59, 999); // End of day
    } else {
      startDate = new Date(earliestTimestamp);
      startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of week (Sunday)
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(latestTimestamp);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // End of week (Saturday)
      endDate.setHours(23, 59, 59, 999);
    }
  } else {
    // For filtered views, use the filter period
    const now = new Date();
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    
    if (typeof timestampFilter === "string") {
      switch (timestampFilter) {
        case "1week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "1month":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "6months":
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case "1year":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = timestamps[0] ? new Date(timestamps[0]) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    } else {
      // Custom date range
      startDate = new Date(timestampFilter.start);
      endDate = new Date(timestampFilter.end);
    }
    
    // Align boundaries based on granularity
    if (useDailyGranularity) {
      startDate.setHours(0, 0, 0, 0); // Start of day
      endDate.setHours(23, 59, 59, 999); // End of day
    } else {
      startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of week (Sunday)
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // End of week (Saturday)
      endDate.setHours(23, 59, 59, 999);
    }
  }
  
  // Group timestamps by day or week based on granularity
  const activityData: ActivityDataPoint[] = [];
  const interval = useDailyGranularity ? oneDay : oneWeek;
  
  // Create buckets from start to end
  for (let date = new Date(startDate); date <= endDate; date = new Date(date.getTime() + interval)) {
    const bucketEnd = new Date(date.getTime() + interval);
    const count = timestamps.filter(ts => ts >= date && ts < bucketEnd).length;
    activityData.push({ date: new Date(date), count });
  }

  // Chart dimensions - different for preview vs expanded
  const previewWidth = 96; // w-24 = 96px
  const previewHeight = 32; // h-8 = 32px
  const expandedWidth = 800;
  const expandedHeight = 400;
  const padding = 2;

  // Function to get processed data based on chart size
  const getProcessedData = (chartWidth: number) => {
    const isSmallChart = chartWidth <= 96;
    let processedData = activityData;
    
    if (isSmallChart && activityData.length > 12) {
      // Sample every nth point to reduce density, keeping first and last
      const sampleRate = Math.ceil(activityData.length / 10);
      processedData = activityData.filter((_, index) => 
        index === 0 || 
        index === activityData.length - 1 || 
        index % sampleRate === 0
      );
    }
    
    return processedData;
  };

  // Create area fill path

  const totalActivity = timestamps.length;
  const now = new Date();
  const recentActivity = timestamps.filter(ts => 
    ts >= new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
  ).length;

  // Get key time markers for x-axis
  const getTimeMarkers = (chartWidth: number) => {
    const chartData = getProcessedData(chartWidth);
    if (chartData.length === 0) return [];
    
    const effectiveWidth = chartWidth - padding * 2;
    const markers = [];
    const startDate = chartData[0].date;
    const endDate = chartData[chartData.length - 1].date;
    
    // Calculate the time span in years
    const timeSpanYears = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const isLargeChart = chartWidth > 400;
    
    // Elegant date formatting with better readability
    const formatDate = (date: Date) => {
      if (timeSpanYears > 2) {
        // For spans > 2 years, show year only
        return date.getFullYear().toString();
      } else if (timeSpanYears > 0.5) {
        // For spans > 6 months, show month and year in elegant format
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else {
        // For shorter spans, show month and day
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    };
    
    if (isLargeChart) {
      // Show essential time markers with good spacing
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysDiff = timeDiff / (24 * 60 * 60 * 1000);
      
      // Always show start date
      markers.push({
        date: startDate,
        x: padding,
        label: formatDate(startDate)
      });
      
      // Add middle marker for longer time spans to provide context
      if (daysDiff > 14 && chartData.length > 6) {
        const middleIndex = Math.floor(chartData.length / 2);
        const middleDate = chartData[middleIndex].date;
        markers.push({
          date: middleDate,
          x: padding + effectiveWidth / 2,
          label: formatDate(middleDate)
        });
      }
      
      // Always show end date if there's meaningful time difference
      if (daysDiff > 1) {
        markers.push({
          date: endDate,
          x: padding + effectiveWidth,
          label: formatDate(endDate)
        });
      }
    } else {
      // For small charts, just show start and end if there's space
      markers.push({
        date: startDate,
        x: padding,
        label: formatDate(startDate)
      });
      
      if (chartData.length > 8) {
        markers.push({
          date: endDate,
          x: padding + effectiveWidth,
          label: formatDate(endDate)
        });
      }
    }
    
    return markers;
  };

  // Render chart SVG (reusable for both small and large views)
  const renderChart = (width: number, height: number, showLabels: boolean = true, isInteractive: boolean = false) => {
    const effectiveWidth = width - padding * 2;
    const effectiveHeight = height - padding * 2;
    const timeMarkers = getTimeMarkers(width);
    
    // Get data processed for this chart size
    const processedWeeklyData = getProcessedData(width);
    const maxCount = Math.max(...processedWeeklyData.map(d => d.count), 1);
    
    const points = processedWeeklyData.map((point, index) => {
      const x = padding + (index / Math.max(processedWeeklyData.length - 1, 1)) * effectiveWidth;
      // Ensure y calculation handles edge cases - if maxCount is 0, all points should be at bottom
      const normalizedCount = maxCount > 0 ? point.count / maxCount : 0;
      const y = padding + effectiveHeight - (normalizedCount * effectiveHeight);
      return { x, y, point, index };
    });

    // Create smooth curve path for many points, straight lines for few points
    const createSmoothPath = (points: Array<{x: number, y: number}>) => {
      if (points.length === 0) return '';
      if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
      if (points.length <= 5) {
        // Use straight lines for few points
        return `M ${points[0].x},${points[0].y} ${points.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')}`;
      }
      
      // Use smooth curves for many points
      let path = `M ${points[0].x},${points[0].y}`;
      
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const currentPoint = points[i];
        const nextPoint = points[i + 1];
        
        if (i === 1) {
          // First curve segment
          const cp1x = prevPoint.x + (currentPoint.x - prevPoint.x) * 0.3;
          const cp1y = prevPoint.y;
          const cp2x = currentPoint.x - (currentPoint.x - prevPoint.x) * 0.3;
          const cp2y = currentPoint.y;
          path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${currentPoint.x},${currentPoint.y}`;
        } else if (i === points.length - 1) {
          // Last curve segment
          const cp1x = prevPoint.x + (currentPoint.x - prevPoint.x) * 0.3;
          const cp1y = prevPoint.y;
          const cp2x = currentPoint.x - (currentPoint.x - prevPoint.x) * 0.3;
          const cp2y = currentPoint.y;
          path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${currentPoint.x},${currentPoint.y}`;
        } else {
          // Middle curve segments
          const prevToNext = { x: nextPoint.x - prevPoint.x, y: nextPoint.y - prevPoint.y };
          const smoothing = 0.2;
          const cp1x = prevPoint.x + prevToNext.x * smoothing;
          const cp1y = prevPoint.y + prevToNext.y * smoothing;
          const cp2x = currentPoint.x - prevToNext.x * smoothing;
          const cp2y = currentPoint.y - prevToNext.y * smoothing;
          path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${currentPoint.x},${currentPoint.y}`;
        }
      }
      
      return path;
    };

    const pathData = createSmoothPath(points);
    
    // Create area path only if we have valid path data
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const areaPath = pathData && firstPoint && lastPoint
      ? `${pathData} L ${lastPoint.x},${height - padding} L ${firstPoint.x},${height - padding} Z`
      : '';

    const formatDataLabel = (date: Date) => {
      if (useDailyGranularity) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        // For weekly data, show the week start
        return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      }
    };

    return (
      <svg
        width={width}
        height={height + (showLabels ? 24 : 0)}
        className="w-full h-full"
        viewBox={`0 0 ${width} ${height + (showLabels ? 24 : 0)}`}
        onMouseLeave={() => isInteractive && setHoveredIndex(null)}
      >
        {/* Area fill */}
        {areaPath && (
          <path
            d={areaPath}
            fill="currentColor"
            className="text-primary/10"
            style={{
              transition: 'opacity 0.2s',
              opacity: hoveredIndex !== null && isInteractive ? 0.15 : 0.1
            }}
          />
        )}
        
        {/* Line - always render if we have a path, ensure continuous connection */}
        {pathData && points.length > 0 && (
          <path
            d={pathData}
            fill="none"
            stroke="currentColor"
            strokeWidth={width <= 96 ? "1.5" : showLabels ? "2" : "2.5"}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="text-primary"
            style={{
              transition: 'opacity 0.2s',
              opacity: hoveredIndex !== null && isInteractive ? 0.7 : 1
            }}
          />
        )}
        
        {/* Hover line indicator */}
        {isInteractive && hoveredIndex !== null && points[hoveredIndex] && (
          <line
            x1={points[hoveredIndex].x}
            y1={padding}
            x2={points[hoveredIndex].x}
            y2={height - padding}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="2,2"
            className="text-primary/30"
          />
        )}
        
        {/* Data points - show all points to keep line visually connected */}
        {points.map(({ x, y, point, index }) => {
          const isHovered = hoveredIndex === index && isInteractive;
          // For small charts, use smaller points and only show them if they have significant activity
          const isSmallPreview = !showLabels && width <= 96;
          const pointRadius = isSmallPreview 
            ? (isHovered ? 2 : 1) 
            : showLabels ? (isHovered ? 3 : 1.5) : (isHovered ? 4 : 2.5);
          const shouldShowPoint = isSmallPreview 
            ? (point.count > 0 && point.count >= maxCount * 0.2) || isHovered
            : point.count > 0 || isHovered;
          
          return (
            <g key={index}>
              {/* Extended vertical hit area for easier hovering */}
              {isInteractive && (
                <rect
                  x={x - 12}
                  y={padding}
                  width={24}
                  height={height - padding * 2}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                  style={{ cursor: 'pointer' }}
                />
              )}
              {/* Actual data point - only show if count > 0 or hovered */}
              {shouldShowPoint && (
                <circle
                  cx={x}
                  cy={y}
                  r={pointRadius}
                  fill="currentColor"
                  className="text-primary"
                  style={{
                    transition: 'r 0.2s, opacity 0.2s',
                    opacity: hoveredIndex !== null && isInteractive && hoveredIndex !== index ? 0.4 : 1
                  }}
                />
              )}
              {/* Hover tooltip */}
              {isInteractive && isHovered && (
                <g>
                  <defs>
                    <filter x="-50%" y="-50%" width="200%" height="200%" id={`shadow-${index}`}>
                      <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="black" floodOpacity="0.2"/>
                    </filter>
                  </defs>
                  {(() => {
                    // Larger, more readable tooltip with post count and date
                    const postText = `${point.count} ${point.count === 1 ? 'post' : 'posts'}`;
                    const dateText = formatDataLabel(point.date);
                    const tooltipWidth = Math.max(Math.max(postText.length, dateText.length) * 8 + 32, 120);
                    const tooltipHeight = 44;
                    const margin = 12;
                    
                    // Smart positioning
                    let tooltipX = x - tooltipWidth / 2;
                    if (tooltipX < padding) {
                      tooltipX = padding;
                    } else if (tooltipX + tooltipWidth > width - padding) {
                      tooltipX = width - padding - tooltipWidth;
                    }
                    
                    let tooltipY = y - tooltipHeight - margin;
                    if (tooltipY < padding) {
                      tooltipY = y + margin;
                    }
                    
                    return (
                      <>
                        {/* Simple rounded background with subtle shadow */}
                        <rect
                          x={tooltipX}
                          y={tooltipY}
                          width={tooltipWidth}
                          height={tooltipHeight}
                          rx={8}
                          className="fill-[rgba(0,0,0,0.85)] dark:fill-[rgba(0,0,0,0.9)]"
                          filter={`url(#shadow-${index})`}
                        />
                        {/* Post count text - larger and more readable */}
                        <text
                          x={tooltipX + tooltipWidth / 2}
                          y={tooltipY + 16}
                          textAnchor="middle"
                          fill="white"
                          style={{ 
                            fontSize: '14px', 
                            fontFamily: 'inherit', 
                            fontWeight: '600' 
                          }}
                        >
                          {postText}
                        </text>
                        {/* Date text - larger and more readable */}
                        <text
                          x={tooltipX + tooltipWidth / 2}
                          y={tooltipY + 32}
                          textAnchor="middle"
                          fill="rgba(255, 255, 255, 0.8)"
                          style={{ 
                            fontSize: '11px', 
                            fontFamily: 'inherit', 
                            fontWeight: '400' 
                          }}
                        >
                          {dateText}
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}
            </g>
          );
        })}

        {/* X-axis time markers - minimalistic design */}
        {showLabels && timeMarkers.length > 0 && (
          <>
            {/* Subtle baseline */}
            <line
              x1={padding}
              y1={height}
              x2={width - padding}
              y2={height}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-muted-foreground/20"
            />
            
            {/* Clean time labels */}
            {timeMarkers.map((marker, index) => (
              <g key={index}>
                {/* Subtle tick mark */}
                <line
                  x1={marker.x}
                  y1={height - 2}
                  x2={marker.x}
                  y2={height + 2}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-muted-foreground/30"
                />
                {/* Elegant label */}
                <text
                  x={marker.x}
                  y={height + 16}
                  textAnchor={index === 0 ? "start" : index === timeMarkers.length - 1 ? "end" : "middle"}
                  className="text-muted-foreground/70 fill-current"
                  style={{ 
                    fontSize: width > 400 ? '12px' : '8px', 
                    fontFamily: 'inherit',
                    fontWeight: '400',
                    letterSpacing: '0.025em'
                  }}
                >
                  {marker.label}
                </text>
              </g>
            ))}
          </>
        )}
      </svg>
    );
  };

  return (
    <>
      <div className={`w-24 h-10 relative group ${className}`}>
        {/* Zoom button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsZoomed(true);
          }}
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity z-20 p-1 rounded bg-background/80 hover:bg-background border border-border/50 hover:border-border shadow-sm"
          aria-label="Zoom chart"
        >
          <Maximize2 className="size-3 text-muted-foreground hover:text-foreground" />
        </button>

        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap">
            <div className="font-medium">{totalActivity} total posts</div>
            <div className="text-muted-foreground">{recentActivity} in last month</div>
            {(() => {
              const markers = getTimeMarkers(previewWidth);
              return markers.length > 1 && (
                <div className="text-muted-foreground text-xs mt-1">
                  {markers[0].label} to {markers[markers.length - 1].label}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Small chart */}
        {renderChart(previewWidth, previewHeight, true, false)}
      </div>

      {/* Zoom modal */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="bg-popover border border-border rounded-lg shadow-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold">
                  {(() => {
                    const markers = getTimeMarkers(expandedWidth);
                    const timeframe = markers.length > 1 
                      ? `${markers[0].label} to ${markers[markers.length - 1].label}`
                      : markers.length === 1
                        ? markers[0].label
                        : '';
                    const title = getTitle();
                    return timeframe ? `${title} - ${timeframe}` : title;
                  })()}
                </h3>
                <div className="text-sm text-muted-foreground mt-1">
                  <div className="font-medium">{totalActivity} total posts</div>
                  <div>{recentActivity} in last month</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsZoomed(false)}
                aria-label="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
            
            <div className="w-full h-64">
              {renderChart(expandedWidth, expandedHeight, true, true)}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ActivityChart;