import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Loader2,
  Volume2,
  Film,
} from 'lucide-react';
import type { BeatAudioData, BeatId, SceneConfig, StoryboardBeat } from '../types';
import { FilmPlayer } from './FilmPlayer';

interface VideoStepProps {
  beats: StoryboardBeat[];
  scene: SceneConfig;
  audioMap: Partial<Record<BeatId, BeatAudioData>>;
  generatingBeats: Partial<Record<BeatId, boolean>>;
  ttsError: string | null;
  onRegenerateVoices: () => void;
  onBack: () => void;
  onNext: () => void;
}

export const VideoStep: React.FC<VideoStepProps> = ({
  beats,
  scene,
  audioMap,
  generatingBeats,
  ttsError,
  onRegenerateVoices,
  onBack,
  onNext,
}) => {
  const [selectedBeatFilter, setSelectedBeatFilter] = useState<BeatId | 'all'>('all');
  const [activePlayingBeat, setActivePlayingBeat] = useState<BeatId>('hook');

  const isAnyGenerating = beats.some((b) => generatingBeats[b.id]);
  const readyCount = beats.filter((b) => Boolean(audioMap[b.id])).length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#5A6675]">Step 4 of 5 · Video & English Voice</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1E242B] mt-1 text-balance">
            Watch all four animated clips stitched into one 30-second film
          </h1>
          <p className="text-base text-[#4A5568] mt-2 max-w-2xl">
            Each beat features natural English voices with word-for-word white subtitles and consistent characters.
          </p>
        </div>

        <button
          type="button"
          onClick={onRegenerateVoices}
          disabled={isAnyGenerating}
          className="min-h-[46px] px-4 py-2 rounded-xl border border-[#CBD3DC] bg-white hover:bg-[#F0F3F6] text-sm font-semibold text-[#2F4858] flex items-center gap-2 self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 transition-colors"
        >
          {isAnyGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span>{isAnyGenerating ? 'Generating Voice…' : 'Refresh English Voices'}</span>
        </button>
      </div>

      {/* Voice Generation Progress Bar (clean inline status) */}
      <div className="bg-white rounded-2xl border border-[#E2E6EC] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-sm sm:text-base font-medium text-[#1E242B]">
          <Volume2 className="w-5 h-5 text-[#2F4858]" />
          <span>
            {isAnyGenerating
              ? `Generating natural English voices (${readyCount} / 4 beats ready)…`
              : readyCount === 4
                ? 'All 4 English voice clips ready and synced to subtitles'
                : `${readyCount} / 4 voice clips ready`}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs sm:text-sm text-[#5A6675]">
          {beats.map((b) => {
            const loading = generatingBeats[b.id];
            const ready = Boolean(audioMap[b.id]);
            return (
              <span key={b.id} className="inline-flex items-center gap-1 font-medium">
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2F4858]" />
                ) : ready ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4A7C6F]" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-[#CBD3DC]" />
                )}
                <span>{b.label}</span>
              </span>
            );
          })}
        </div>
      </div>

      {ttsError && (
        <div
          role="alert"
          className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-base text-[#991B1B]"
        >
          {ttsError}
        </div>
      )}

      {/* Main 30s Player */}
      <FilmPlayer
        beats={beats}
        scene={scene}
        audioMap={audioMap}
        activeBeatFilter={selectedBeatFilter}
        onBeatChange={setActivePlayingBeat}
      />

      {/* Beat Clip Selector Buttons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1E242B]">
            Clip Sequence (Play in Order or Preview Individual Beats)
          </h2>
          <button
            type="button"
            onClick={() => setSelectedBeatFilter('all')}
            className={`min-h-[42px] px-4 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              selectedBeatFilter === 'all'
                ? 'bg-[#2F4858] text-white'
                : 'bg-white border border-[#D4DAE2] text-[#1E242B] hover:bg-[#F0F3F6]'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Full 30s Film</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {beats.map((beat, idx) => {
            const isSelected = selectedBeatFilter === beat.id;
            const isCurrentlyPlaying =
              selectedBeatFilter === 'all' && activePlayingBeat === beat.id;
            return (
              <button
                key={beat.id}
                type="button"
                onClick={() => setSelectedBeatFilter(beat.id)}
                className={`text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
                  isSelected || isCurrentlyPlaying
                    ? 'border-[#2F4858] bg-[#F2F5F7]'
                    : 'border-[#E2E6EC] bg-white hover:bg-[#FAFBFD]'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono-num text-[#5A6675]">
                  <span>Clip 0{idx + 1}</span>
                  <span>{beat.timeRange}</span>
                </div>
                <p className="text-base font-bold text-[#1E242B] mt-1">{beat.label}</p>
                <p className="text-sm text-[#4A5568] mt-1 line-clamp-2">
                  {beat.lines.map((l) => l.text).join(' ')}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation Row */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[52px] px-6 py-3 rounded-xl border border-[#CBD3DC] bg-white hover:bg-[#F0F3F6] text-[#1E242B] font-semibold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Storyboard</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="min-h-[54px] px-8 py-3 rounded-xl bg-[#2F4858] hover:bg-[#233744] text-white font-semibold text-lg flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
        >
          <span>Next: Final Screen & Download</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
};
