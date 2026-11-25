import type { DialogueLine, ExpressionItem, StoryboardBeat } from '../types';

export interface SubtitleCue {
  startSec: number; // relative to beat start (0..beatDuration)
  endSec: number;
  text: string; // max 2 lines
}

export function countWords(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).length;
}

export function countStoryboardWords(beats: StoryboardBeat[]): number {
  return beats.reduce((sum, beat) => {
    const beatWords = beat.lines.reduce((s, line) => s + countWords(line.text), 0);
    return sum + beatWords;
  }, 0);
}

export function findExpressionMatches(
  beats: StoryboardBeat[],
  expressions: ExpressionItem[]
): { matched: string[]; missing: string[] } {
  const fullText = beats
    .flatMap((b) => b.lines.map((l) => l.text))
    .join(' ')
    .toLowerCase();

  const matched: string[] = [];
  const missing: string[] = [];

  for (const expr of expressions) {
    const phrase = expr.phrase.trim();
    if (!phrase) continue;
    if (fullText.includes(phrase.toLowerCase())) {
      matched.push(phrase);
    } else {
      missing.push(phrase);
    }
  }

  return { matched, missing };
}

export function formatTwoLines(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= 36) return clean;
  const words = clean.split(' ');
  let bestSplit = Math.ceil(words.length / 2);
  let bestDiff = Infinity;

  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ').length;
    const l2 = words.slice(i).join(' ').length;
    const diff = Math.abs(l1 - l2);
    if (l1 <= 42 && l2 <= 42 && diff < bestDiff) {
      bestDiff = diff;
      bestSplit = i;
    }
  }
  return `${words.slice(0, bestSplit).join(' ')}\n${words.slice(bestSplit).join(' ')}`;
}

export function buildSubtitlesFromLines(lines: DialogueLine[]): string[] {
  const subtitles: string[] = [];
  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    const words = text.split(/\s+/);
    let current: string[] = [];

    for (const word of words) {
      const candidate = [...current, word].join(' ');
      if (candidate.length > 68 && current.length > 0) {
        subtitles.push(formatTwoLines(current.join(' ')));
        current = [word];
      } else {
        current.push(word);
      }
    }
    if (current.length > 0) {
      subtitles.push(formatTwoLines(current.join(' ')));
    }
  }
  return subtitles;
}

export function computeBeatSubtitleCues(
  beat: StoryboardBeat,
  speechDurationSec: number
): SubtitleCue[] {
  const chunks =
    beat.subtitles.length > 0
      ? beat.subtitles
      : buildSubtitlesFromLines(beat.lines);

  if (chunks.length === 0) return [];

  const effectiveDuration = Math.max(1.5, speechDurationSec);
  const weights = chunks.map((chunk) => Math.max(4, chunk.replace(/\s+/g, '').length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const cues: SubtitleCue[] = [];
  let cursor = 0;

  for (let i = 0; i < chunks.length; i++) {
    const portion = (weights[i] / totalWeight) * effectiveDuration;
    const end = i === chunks.length - 1 ? effectiveDuration : cursor + portion;
    cues.push({
      startSec: cursor,
      endSec: end,
      text: chunks[i],
    });
    cursor = end;
  }

  return cues;
}
