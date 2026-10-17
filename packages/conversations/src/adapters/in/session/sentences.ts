const sentenceEnd = /[.!?…;:]+["'»)\]]*\s+|\n+/g;

/** Split streamed text into complete sentences, keeping the unfinished tail. */
export function takeSentences(buffer: string): Readonly<{ sentences: string[]; rest: string }> {
  const sentences: string[] = [];
  let start = 0;
  for (const match of buffer.matchAll(sentenceEnd)) {
    const end = match.index + match[0].length;
    sentences.push(buffer.slice(start, end));
    start = end;
  }
  return { sentences: sentences.map(normalizeSentence).filter(Boolean), rest: buffer.slice(start) };
}

/** Collapse whitespace so a sentence is spoken as one line. */
export function normalizeSentence(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
