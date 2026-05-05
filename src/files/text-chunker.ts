export function chunkText(text: string, maxTokens: number): string[] {
  const avgCharsPerToken = 4;
  const maxChars = maxTokens * avgCharsPerToken;
  const chunks: string[] = [];
  let offset = 0;

  while (offset < text.length) {
    let end = Math.min(offset + maxChars, text.length);

    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end);
      if (lastNewline > offset + maxChars * 0.5) {
        end = lastNewline;
      }
    }

    const chunk = text.slice(offset, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    offset = end + 1;
  }

  return chunks;
}
