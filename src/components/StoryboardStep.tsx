import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Check,
  Loader2,
} from 'lucide-react';
import type {
  BeatId,
  DialogueLine,
  ExpressionItem,
  SceneConfig,
  StoryboardBeat,
} from '../types';
import {
  buildSubtitlesFromLines,
  countStoryboardWords,
  findExpressionMatches,
} from '../utils/subtitleTiming';

interface StoryboardStepProps {
  beats: StoryboardBeat[];
  expressions: ExpressionItem[];
  scene: SceneConfig;
  onChangeBeats: (next: StoryboardBeat[]) => void;
  onRegenerateBeat: (beatId: BeatId) => Promise<void>;
  regeneratingBeatId: BeatId | null;
  onBack: () => void;
  onNext: () => void;
  error: string | null;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const HIGHLIGHT_CLASSES = [
  'bg-[#DBEAFE] text-[#1E40AF] decoration-[#3B82F6]',
  'bg-[#FEF3C7] text-[#92400E] decoration-[#F59E0B]',
  'bg-[#D1FAE5] text-[#065F46] decoration-[#10B981]',
  'bg-[#FCE7F3] text-[#9D174D] decoration-[#EC4899]',
  'bg-[#EDE9FE] text-[#5B21B6] decoration-[#8B5CF6]',
];

function renderHighlightedText(text: string, phrases: string[]): React.ReactNode {
  const orderedOriginal = phrases
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const cleanPhrases = [...orderedOriginal].sort((a, b) => b.length - a.length);

  if (cleanPhrases.length === 0) return text;

  const regex = new RegExp(`(${cleanPhrases.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const matchIdx = orderedOriginal.findIndex(
      (p) => p.toLowerCase() === part.toLowerCase()
    );
    if (matchIdx !== -1) {
      const colorCls = HIGHLIGHT_CLASSES[matchIdx % HIGHLIGHT_CLASSES.length];
      return (
        <mark
          key={i}
          className={`${colorCls} font-semibold px-1.5 py-0.5 rounded underline decoration-2 underline-offset-2`}
        >
          {part}
        </mark>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export const StoryboardStep: React.FC<StoryboardStepProps> = ({
  beats,
  expressions,
  scene,
  onChangeBeats,
  onRegenerateBeat,
  regeneratingBeatId,
  onBack,
  onNext,
  error,
}) => {
  const [editingBeatId, setEditingBeatId] = useState<BeatId | null>(null);

  const phraseList = expressions
    .map((e) => e.phrase.trim())
    .filter((p) => p.length > 0);

  const totalWords = countStoryboardWords(beats);
  const wordCountOk = totalWords >= 60 && totalWords <= 70;
  const { matched, missing } = findExpressionMatches(beats, expressions);

  const updateBeat = (beatId: BeatId, updater: (b: StoryboardBeat) => StoryboardBeat) => {
    onChangeBeats(beats.map((b) => (b.id === beatId ? updater(b) : b)));
  };

  const updateLineText = (beatId: BeatId, lineIdx: number, text: string) => {
    updateBeat(beatId, (beat) => {
      const nextLines = beat.lines.map((l, i) =>
        i === lineIdx ? { ...l, text } : l
      );
      return {
        ...beat,
        lines: nextLines,
        subtitles: buildSubtitlesFromLines(nextLines),
      };
    });
  };

  const toggleLineSpeaker = (beatId: BeatId, lineIdx: number) => {
    updateBeat(beatId, (beat) => {
      const nextLines: DialogueLine[] = beat.lines.map((l, i) => {
        if (i !== lineIdx) return l;
        const nextSpeaker: 'A' | 'B' = l.speaker === 'A' ? 'B' : 'A';
        return {
          ...l,
          speaker: nextSpeaker,
          speakerName:
            nextSpeaker === 'A' ? scene.characterA.name : scene.characterB.name,
        };
      });
      return { ...beat, lines: nextLines };
    });
  };

  const updateSubtitleBlock = (beatId: BeatId, subIdx: number, value: string) => {
    updateBeat(beatId, (beat) => ({
      ...beat,
      subtitles: beat.subtitles.map((s, i) => (i === subIdx ? value : s)),
    }));
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[#5A6675]">Step 3 of 5 · 4-Beat Script</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1E242B] mt-1 text-balance">
          Review, highlight, and fine-tune your 30-second storyboard
        </h1>
        <p className="text-base text-[#4A5568] mt-2 max-w-2xl">
          Every movie expression is highlighted below. Edit any beat directly or regenerate one beat if you want a fresh take.
        </p>
      </div>

      {/* Live Word Count & Expression Checklist Strip */}
      <div className="bg-white rounded-2xl border border-[#E2E6EC] p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {wordCountOk ? (
              <CheckCircle2 className="w-5 h-5 text-[#4A7C6F] shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0" />
            )}
            <span className="font-mono-num text-base font-semibold text-[#1E242B]">
              {totalWords} words
            </span>
            <span className="text-sm text-[#5A6675]">
              (Target: 60–70 words across 30s)
            </span>
          </div>

          <div className="text-sm text-[#4A5568] font-medium">
            <span className="font-mono-num text-[#1E242B]">
              {matched.length} / {phraseList.length}
            </span>{' '}
            expressions used verbatim
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-[#ECEFF3] text-sm">
          {phraseList.map((phrase) => {
            const found = matched.includes(phrase);
            return (
              <span
                key={phrase}
                className={`inline-flex items-center gap-1.5 font-medium ${
                  found ? 'text-[#2D5A4E]' : 'text-[#92400E]'
                }`}
              >
                {found ? (
                  <CheckCircle2 className="w-4 h-4 text-[#4A7C6F]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#B45309]" />
                )}
                <span>“{phrase}”</span>
              </span>
            );
          })}
        </div>

        {missing.length > 0 && (
          <p className="text-sm text-[#92400E]">
            Tip: Edit a beat line to include “{missing.join('”, “')}” exactly as typed, or regenerate that beat.
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-base text-[#991B1B]"
        >
          {error}
        </div>
      )}

      {/* 4 Beats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {beats.map((beat, idx) => {
          const isEditing = editingBeatId === beat.id;
          const isRegenerating = regeneratingBeatId === beat.id;

          return (
            <article
              key={beat.id}
              className="bg-white rounded-2xl border border-[#E2E6EC] p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-4">
                {/* Beat Header */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#ECEFF3]">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-[#5A6675] font-medium">
                      <span className="font-mono-num">Beat 0{idx + 1}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">{beat.timeRange}</span>
                    </div>
                    <h2 className="text-xl font-bold text-[#1E242B] mt-0.5">
                      {beat.label}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingBeatId(isEditing ? null : beat.id)
                      }
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] hover:bg-[#EFF2F6] text-sm font-medium text-[#1E242B] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isEditing ? (
                        <>
                          <Check className="w-4 h-4 text-[#4A7C6F]" />
                          <span>Done</span>
                        </>
                      ) : (
                        <>
                          <Pencil className="w-4 h-4" />
                          <span>Edit</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onRegenerateBeat(beat.id)}
                      disabled={isRegenerating}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D4DAE2] bg-white hover:bg-[#F0F3F6] text-sm font-medium text-[#2F4858] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {isRegenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span>Regenerate</span>
                    </button>
                  </div>
                </div>

                {/* Scene Description */}
                <div>
                  <h3 className="text-xs font-semibold tracking-wide text-[#5A6675] mb-1.5">
                    Scene Description
                  </h3>
                  {isEditing ? (
                    <textarea
                      rows={2}
                      value={beat.sceneDescription}
                      onChange={(e) =>
                        updateBeat(beat.id, (b) => ({
                          ...b,
                          sceneDescription: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD3DC] bg-[#FAFBFD] text-base text-[#1E242B]"
                    />
                  ) : (
                    <p className="text-base text-[#374151] leading-relaxed">
                      {beat.sceneDescription}
                    </p>
                  )}
                </div>

                {/* English Lines */}
                <div>
                  <h3 className="text-xs font-semibold tracking-wide text-[#5A6675] mb-2">
                    English Lines
                  </h3>
                  <div className="space-y-2.5">
                    {beat.lines.map((line, lIdx) => (
                      <div
                        key={lIdx}
                        className="rounded-xl bg-[#F7F9FB] border border-[#E6EAF0] p-3"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-[#2F4858]">
                            {line.speaker === 'A'
                              ? scene.characterA.name
                              : scene.characterB.name}
                          </span>
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => toggleLineSpeaker(beat.id, lIdx)}
                              className="text-xs font-medium text-[#2F4858] underline cursor-pointer"
                            >
                              Switch speaker
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <textarea
                            rows={2}
                            value={line.text}
                            onChange={(e) =>
                              updateLineText(beat.id, lIdx, e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-lg border border-[#CBD3DC] bg-white text-base text-[#1E242B]"
                          />
                        ) : (
                          <p className="text-base text-[#1E242B] leading-relaxed">
                            {renderHighlightedText(line.text, phraseList)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subtitles Preview */}
                <div>
                  <h3 className="text-xs font-semibold tracking-wide text-[#5A6675] mb-2">
                    Burned-in Subtitles (max 2 lines each)
                  </h3>
                  <div className="space-y-2">
                    {beat.subtitles.map((sub, sIdx) =>
                      isEditing ? (
                        <textarea
                          key={sIdx}
                          rows={2}
                          value={sub}
                          onChange={(e) =>
                            updateSubtitleBlock(beat.id, sIdx, e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg border border-[#CBD3DC] bg-[#1E242B] text-white font-semibold text-sm text-center"
                        />
                      ) : (
                        <div
                          key={sIdx}
                          className="rounded-xl bg-[#1E242B] text-white px-4 py-2.5 text-center font-semibold text-sm sm:text-base whitespace-pre-line leading-snug"
                        >
                          {sub}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Bottom Action Row */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[52px] px-6 py-3 rounded-xl border border-[#CBD3DC] bg-white hover:bg-[#F0F3F6] text-[#1E242B] font-semibold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Scene</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="min-h-[54px] px-8 py-3 rounded-xl bg-[#2F4858] hover:bg-[#233744] text-white font-semibold text-lg flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
        >
          <span>Next: Build 30s Video & Voice</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
};
