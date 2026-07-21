import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reportUrl = searchParams.get("url");

  if (!reportUrl) {
    return NextResponse.json(
      { error: "Report URL is required" },
      { status: 400 }
    );
  }

  try {
    // Add timeout and error handling for external fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(reportUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BroadListening-Bot/1.0',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch report: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching report data:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}