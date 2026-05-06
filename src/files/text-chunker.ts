/**
 * Semantic text chunking with overlap.
 *
 * Strategy:
 * 1. Split on paragraph breaks (double newlines) — preserves semantic units
 * 2. Accumulate paragraphs into chunks up to maxTokens
 * 3. Long paragraphs are further split on sentence boundaries, then word boundaries
 * 4. Overlap: each chunk (except the first) gets a suffix from the previous chunk
 *    prepended — this prevents relevant context from being cut at chunk boundaries
 */

const AVG_CHARS_PER_TOKEN = 4;

export interface ChunkOptions {
  maxTokens?: number;   // hard limit per chunk (default: 300)
  overlapTokens?: number; // context carried forward (default: 48)
}

export function chunkText(text: string, maxTokens = 300, overlapTokens = 48): string[] {
  const maxChars = maxTokens * AVG_CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * AVG_CHARS_PER_TOKEN;

  // Step 1: semantic split on paragraph boundaries
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) return [];

  // Step 2: pack paragraphs into chunks
  const rawChunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      // Flush current before the overlong paragraph
      if (current) {
        rawChunks.push(current.trim());
        current = '';
      }
      rawChunks.push(...splitLong(para, maxChars));
    } else if ((current ? current.length + 2 : 0) + para.length <= maxChars) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      if (current) rawChunks.push(current.trim());
      current = para;
    }
  }

  if (current.trim()) rawChunks.push(current.trim());

  // Step 3: add overlap
  return applyOverlap(rawChunks, overlapChars);
}

/** Splits a single paragraph that exceeds maxChars on sentence → word boundaries. */
function splitLong(para: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let offset = 0;

  while (offset < para.length) {
    let end = Math.min(offset + maxChars, para.length);

    if (end < para.length) {
      // Try sentence boundary (". ", "! ", "? ")
      const sentMatch = para.lastIndexOf('. ', end);
      const excMatch = para.lastIndexOf('! ', end);
      const qMark = para.lastIndexOf('? ', end);
      const sentEnd = Math.max(sentMatch, excMatch, qMark);

      if (sentEnd > offset + maxChars * 0.4) {
        end = sentEnd + 1; // include the period
      } else {
        // Fall back to last space
        const spaceEnd = para.lastIndexOf(' ', end);
        if (spaceEnd > offset + maxChars * 0.4) end = spaceEnd;
      }
    }

    const chunk = para.slice(offset, end).trim();
    if (chunk) chunks.push(chunk);
    offset = end + 1;
  }

  return chunks;
}

/** Prepends a tail from the previous chunk to create sliding-window overlap. */
function applyOverlap(chunks: string[], overlapChars: number): string[] {
  if (chunks.length <= 1 || overlapChars <= 0) return chunks;

  return chunks.map((chunk, i) => {
    if (i === 0) return chunk;
    const tail = chunks[i - 1].slice(-overlapChars).trim();
    return tail ? `${tail}\n\n${chunk}` : chunk;
  });
}
