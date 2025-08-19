// server/src/jsonRepair.ts (hotfix: correct regex replacement string)
export function stripCodeFences(s: string): string {
  if (!s) return s;
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  return s.trim();
}

export function sanitizeQuotes(s: string): string {
  return s
    .replace(/[“”„‟‹›«»]/g, '"')
    .replace(/[‘’‚‛]/g, "'");
}

export function removeComments(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

export function removeTrailingCommas(s: string): string {
  return s.replace(/,(\s*[}\]])/g, '$1');
}

export function extractLargestJson(s: string): string | null {
  const text = s;
  let best: { start: number, end: number } | null = null;

  const tryScan = (open: string, close: string) => {
    const stack: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === open) stack.push(i);
      else if (ch === close && stack.length) {
        const start = stack.pop()!;
        if (!stack.length) {
          best = { start, end: i };
          break;
        }
      }
    }
  };

  tryScan('{', '}');
  if (!best) tryScan('[', ']');
  if (!best) return null;
  return text.slice(best.start, best.end + 1);
}

export function repairJsonToString(input: string): string | null {
  if (!input) return null;
  let s = stripCodeFences(input);
  s = sanitizeQuotes(s);
  s = removeComments(s);
  if (!(s.trim().startsWith('{') || s.trim().startsWith('['))) {
    const largest = extractLargestJson(s);
    if (largest) s = largest;
  }
  s = removeTrailingCommas(s);

  // Heuristiken für einfache JSON-Fehler
  s = s.replace(/([{,\[]\s*)'([^'"]+?)'\s*:/g, '$1"$2":'); // 'key': -> "key":
  s = s.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"'); // : 'value' -> : "value"

  s = s.replace(/\u00A0/g, ' ');

  try {
    JSON.parse(s);
    return s;
  } catch {
    return null;
  }
}
