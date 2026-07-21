/**
 * Viewing is delegated to the existing broadlistening.org dashboard — this app
 * is a processor + analysis browser and does not duplicate the viewer.
 */
export const VIEWER_BASE =
  process.env.NEXT_PUBLIC_VIEWER_URL ?? "https://www.broadlistening.org";

/** Full viewer URL for any publicly reachable T3C report JSON. */
export function viewerUrl(reportUrl: string): string {
  return `${VIEWER_BASE}/dashboard?report=${encodeURIComponent(reportUrl)}`;
}
