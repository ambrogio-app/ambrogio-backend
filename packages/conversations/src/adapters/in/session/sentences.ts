const sentenceEnd = /[.!?…;:]+["'»)\]]*\s+|\n+/g;

/** Split streamed text into complete sentences ready to speak, keeping the unfinished tail. */
export function takeSentences(buffer: string): Readonly<{ sentences: string[]; rest: string }> {
  const sentences: string[] = [];
  let start = 0;
  for (const match of buffer.matchAll(sentenceEnd)) {
    const end = match.index + match[0].length;
    sentences.push(buffer.slice(start, end));
    start = end;
  }
  return { sentences: sentences.map(spokenSentence).filter(Boolean), rest: buffer.slice(start) };
}

/** Collapse whitespace so a sentence is spoken as one line. */
function normalizeSentence(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const leadingMarker = /^\s*(?:#{1,6}|>+|[-*+])\s+/;
const emphasisUnderscore = /(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu;

/** The readable text of one sentence without Markdown markup; empty when nothing is left to say. */
export function spokenSentence(text: string): string {
  let spoken = text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`+/g, '');
  while (leadingMarker.test(spoken)) spoken = spoken.replace(leadingMarker, '');
  if (spoken.includes('|')) {
    spoken = spoken.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
      .map(cell => cell.trim()).filter(Boolean).join(', ');
  }
  spoken = normalizeSentence(spoken.replace(/\*+|~~/g, '').replace(emphasisUnderscore, ''));
  return /[\p{L}\p{N}]/u.test(spoken) ? spoken : '';
}
