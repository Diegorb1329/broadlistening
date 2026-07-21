import Papa from "papaparse";
import { inputCommentSchema, type InputComment } from "@broadlistening/schema";

export interface CsvMapping {
  /** Column holding the comment text (required) */
  textColumn: string;
  idColumn?: string;
  authorColumn?: string;
  urlColumn?: string;
  timestampColumn?: string;
}

export interface CsvParseResult {
  comments: InputComment[];
  /** Rows dropped with reasons (empty text, too long, ...) — never silent */
  dropped: { row: number; reason: string }[];
  columns: string[];
}

function detectColumn(columns: string[], candidates: string[]): string | undefined {
  const lower = columns.map((c) => c.toLowerCase().trim());
  for (const cand of candidates) {
    const idx = lower.indexOf(cand);
    if (idx !== -1) return columns[idx];
  }
  return undefined;
}

/** Best-effort auto-detection of the text column for common headers. */
export function detectTextColumn(columns: string[]): string | undefined {
  return detectColumn(columns, ["comment", "text", "comment-body", "response", "answer", "body", "message"]);
}

/** Auto-detect the full column mapping (text, id, author, url, timestamp). */
export function detectMapping(columns: string[]): CsvMapping | undefined {
  const textColumn = detectTextColumn(columns);
  if (!textColumn) return undefined;
  return {
    textColumn,
    idColumn: detectColumn(columns, ["id", "comment_id", "row_id"]),
    authorColumn: detectColumn(columns, ["author", "name", "interview", "user", "speaker", "participant", "handle"]),
    urlColumn: detectColumn(columns, ["url", "link", "source_url", "permalink", "source"]),
    timestampColumn: detectColumn(columns, ["timestamp", "date", "created_at", "datetime", "created", "time"]),
  };
}

export function parseCommentsCsv(csvText: string, mapping: CsvMapping): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const columns = parsed.meta.fields ?? [];
  const comments: InputComment[] = [];
  const dropped: { row: number; reason: string }[] = [];
  const seen = new Set<string>();

  parsed.data.forEach((row, i) => {
    const text = (row[mapping.textColumn] ?? "").trim();
    if (!text) {
      dropped.push({ row: i + 2, reason: "empty text" });
      return;
    }
    const candidate = {
      id: (mapping.idColumn && row[mapping.idColumn]?.trim()) || `row-${i + 2}`,
      text: text.slice(0, 10_000),
      author: (mapping.authorColumn && row[mapping.authorColumn]?.trim()) || "Anonymous",
      sourceUrl: (mapping.urlColumn && row[mapping.urlColumn]?.trim()) || undefined,
      timestamp: (mapping.timestampColumn && row[mapping.timestampColumn]?.trim()) || undefined,
    };
    const check = inputCommentSchema.safeParse(candidate);
    if (!check.success) {
      dropped.push({ row: i + 2, reason: check.error.issues[0]?.message ?? "invalid" });
      return;
    }
    // dedup identical texts (content hash by normalized text)
    const key = check.data.text.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) {
      dropped.push({ row: i + 2, reason: "duplicate text" });
      return;
    }
    seen.add(key);
    comments.push(check.data);
  });

  return { comments, dropped, columns };
}
