import React from 'react';
import { ArrowLeft, FileText, RotateCcw } from 'lucide-react';
import type {
  BeatAudioData,
  BeatId,
  ExpressionItem,
  SceneConfig,
  StoryboardBeat,
} from '../types';
import { FilmPlayer } from './FilmPlayer';

interface FinalStepProps {
  beats: StoryboardBeat[];
  expressions: ExpressionItem[];
  scene: SceneConfig;
  audioMap: Partial<Record<BeatId, BeatAudioData>>;
  onUpdateAuthor: (authorName: string) => void;
  onBack: () => void;
  onStartOver: () => void;
}

export const FinalStep: React.FC<FinalStepProps> = ({
  beats,
  expressions,
  scene,
  audioMap,
  onUpdateAuthor,
  onBack,
  onStartOver,
}) => {
  const handleDownloadStudySheet = () => {
    const lines: string[] = [
      'Shall we play? — 30-Second English Short Film Study Sheet',
      `Setting: ${scene.place}`,
      `Characters: ${scene.characterA.name} (${scene.characterA.origin}) & ${scene.characterB.name} (${scene.characterB.origin})`,
      '',
      '=== TARGET EXPRESSIONS ===',
      ...expressions
        .filter((e) => e.phrase.trim())
        .map(
          (e, i) =>
            `${i + 1}. "${e.phrase}" — from ${e.movie || 'Movie'}${e.note ? ` (${e.note})` : ''}`
        ),
      '',
      '=== 4-BEAT SCRIPT ===',
      ...beats.flatMap((b) => [
        `[${b.label} · ${b.timeRange}] ${b.sceneDescription}`,
        ...b.lines.map(
          (l) =>
            `  ${l.speaker === 'A' ? scene.characterA.name : scene.characterB.name}: ${l.text}`
        ),
        '',
      ]),
      `Made with Google AI Studio · Script by ${scene.authorName || 'joo hyun jun'}`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shall-we-play-study-script.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[#5A6675]">Step 5 of 5 · Premiere & Export</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1E242B] mt-1 text-balance">
          Your 30-second English movie clip is ready
        </h1>
        <p className="text-base text-[#4A5568] mt-2 max-w-2xl">
          Play the full film with end credits, download the video with burned-in English subtitles and voice, or save your study script.
        </p>
      </div>

      <FilmPlayer
        beats={beats}
        scene={scene}
        audioMap={audioMap}
        activeBeatFilter="all"
        includeEndCredit={true}
        showDownloadButton={true}
      />

      {/* Credit & Study Notes Card */}
      <div className="bg-white rounded-2xl border border-[#E2E6EC] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#ECEFF3]">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#5A6675]">
              Film Credit
            </p>
            <p className="text-lg sm:text-xl font-bold text-[#1E242B] mt-1">
              Made with Google AI Studio · Script by {scene.authorName || 'joo hyun jun'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadStudySheet}
            className="min-h-[48px] px-5 py-2.5 rounded-xl border border-[#CBD3DC] bg-[#FAFBFD] hover:bg-[#EFF2F6] text-[#1E242B] font-semibold text-base flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-5 h-5" />
            <span>Download Study Script (.txt)</span>
          </button>
        </div>

        <div className="max-w-sm">
          <label
            htmlFor="final-author"
            className="block text-sm font-medium text-[#4A5568] mb-1.5"
          >
            Edit Script Author Name
          </label>
          <input
            id="final-author"
            type="text"
            value={scene.authorName}
            onChange={(e) => onUpdateAuthor(e.target.value)}
            placeholder="joo hyun jun"
            className="w-full min-h-[46px] px-4 py-2 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] text-base text-[#1E242B]"
          />
        </div>
      </div>

      {/* Bottom Action Row */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[52px] px-6 py-3 rounded-xl border border-[#CBD3DC] bg-white hover:bg-[#F0F3F6] text-[#1E242B] font-semibold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Video Clips</span>
        </button>

        <button
          type="button"
          onClick={onStartOver}
          className="min-h-[52px] px-6 py-3 rounded-xl border border-[#CBD3DC] bg-white hover:bg-[#F0F3F6] text-[#2F4858] font-semibold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-5 h-5" />
          <span>Make Another Film</span>
        </button>
      </div>
    </section>
  );
};
