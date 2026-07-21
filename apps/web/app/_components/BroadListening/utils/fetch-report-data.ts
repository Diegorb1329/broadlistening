import { cache } from 'react';
import parseTopics from './parse-topics';
import fetchDemographics from './fetch-demographics';

export type ReportData = {
  topics: ReturnType<typeof parseTopics>['topics'];
  demographics: Awaited<ReturnType<typeof fetchDemographics>>;
  parsedData: ReturnType<typeof parseTopics>;
};

// Cache the fetch function to deduplicate requests within the same render
const cachedFetch = cache(async (url: string) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BroadListening-Bot/1.0',
    },
    // Cache for 60 seconds - this will deduplicate requests within the same render
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch report: ${response.status}`);
  }

  return response.json();
});

// Cache demographics fetch (with error handling)
const cachedDemographics = cache(async () => {
  try {
    return await fetchDemographics();
  } catch (error) {
    console.warn("Failed to fetch demographics, continuing without demographics data:", error);
    return {};
  }
});

export const fetchReportData = cache(async (reportUrl: string): Promise<ReportData> => {
  const [topicsData, demographics] = await Promise.all([
    cachedFetch(reportUrl),
    cachedDemographics(),
  ]);

  const parsedData = parseTopics(topicsData);

  return {
    topics: parsedData.topics,
    demographics: demographics || {},
    parsedData,
  };
});

