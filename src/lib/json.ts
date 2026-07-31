import { jsonrepair } from "jsonrepair";

/**
 * Escapes raw control characters (newline, carriage return, tab) that appear
 * literally inside JSON string values. This is the most common cause of
 * "Expected ',' or '}'" errors when AI models embed multi-line code examples.
 */
function escapeControlCharsInStrings(json: string): string {
  let result = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escape) { result += ch; escape = false; continue; }
    if (ch === "\\") { result += ch; escape = true; continue; }
    if (ch === '"') { result += ch; inString = !inString; continue; }
    if (inString) {
      if (ch === "\n") { result += "\\n"; continue; }
      if (ch === "\r") { result += "\\r"; continue; }
      if (ch === "\t") { result += "\\t"; continue; }
    }
    result += ch;
  }
  return result;
}

export function parseAiJson<T>(raw: string): T {
  // 1. Strip markdown code fences
  let cleaned = raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();

  // 2. Extract only the JSON object/array — drop any leading/trailing prose
  const start = cleaned.search(/[{[]/);
  if (start === -1) {
    throw new Error("AI response did not contain a valid JSON object or array.");
  }
  cleaned = cleaned.slice(start);

  // Find the matching closing brace/bracket
  const openChar = cleaned[0];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0, lastClose = -1, inString = false, escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === openChar) { depth++; }
    if (ch === closeChar) { depth--; if (depth === 0) { lastClose = i; break; } }
  }

  if (lastClose !== -1) cleaned = cleaned.slice(0, lastClose + 1);

  // 3. Direct parse on the minimally-cleaned text
  try { return JSON.parse(cleaned) as T; } catch { /* fall through */ }

  // 4. jsonrepair FIRST — before any heuristics that might corrupt its input.
  //    Handles: unescaped quotes, raw newlines, trailing commas, missing brackets, etc.
  try { return JSON.parse(jsonrepair(cleaned)) as T; } catch { /* fall through */ }

  // 5. Apply heuristic cleanups to the same base text and try again
  let fixed = cleaned;
  fixed = fixed.replace(/\/\/[^\n\r"]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); // JS comments
  fixed = escapeControlCharsInStrings(fixed);                                     // raw \n \r \t in strings
  fixed = fixed.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');         // smart quotes
  fixed = fixed.replace(/([{,]\s*)(?!"|')([a-zA-Z0-9_\-]+)\s*:/g, '$1"$2":');  // unquoted keys
  fixed = fixed.replace(/,\s*([}\]])/g, "$1");                                   // trailing commas

  try { return JSON.parse(fixed) as T; } catch { /* fall through */ }

  // 6. jsonrepair on heuristic-cleaned text
  try { return JSON.parse(jsonrepair(fixed)) as T; } catch { /* fall through */ }

  // 7. Last resort: aggressive single-quote swap
  try {
    const aggressive = fixed
      .replace(/'([^']+)':/g, '"$1":')
      .replace(/: '([^']*)'/g, ': "$1"');
    return JSON.parse(aggressive) as T;
  } catch (err) {
    console.error("parseAiJson failed.\nCleaned text:\n", fixed.slice(0, 1000));
    throw new Error(
      `AI returned invalid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
