/**
 * Generates sparse TF vectors compatible with Qdrant's sparse vector format.
 *
 * Uses a hash-trick with FNV-1a to map tokens → indices in a fixed vocab space.
 * Qdrant applies IDF weighting internally when the collection uses modifier: 'idf',
 * so we only need to compute normalized term frequencies here.
 *
 * The vocab size (30007, a prime) is large enough to keep collision probability low
 * for typical document lengths while staying memory-efficient.
 */

const VOCAB_SIZE = 30007;

export interface SparseVector {
  indices: number[];
  values: number[];
}

export function buildSparseVector(text: string): SparseVector {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { indices: [], values: [] };

  const tf = new Map<number, number>();
  for (const token of tokens) {
    const idx = fnv1a(token) % VOCAB_SIZE;
    tf.set(idx, (tf.get(idx) ?? 0) + 1);
  }

  // sqrt(TF / total) — normalized, stable input for Qdrant IDF modifier
  const total = tokens.length;
  const entries = Array.from(tf.entries());

  return {
    indices: entries.map(([idx]) => idx),
    values: entries.map(([, freq]) => Math.sqrt(freq / total)),
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Keep unicode letters/digits, collapse everything else to space
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((t) => t.length >= 2 && t.length <= 40);
}

// FNV-1a 32-bit — fast, deterministic, good distribution
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Imitate uint32 multiplication: (hash * 0x01000193) | 0
    hash = Math.imul(hash, 0x01000193);
  }
  // Ensure positive
  return (hash >>> 0) % VOCAB_SIZE;
}
