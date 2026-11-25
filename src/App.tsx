import { useCallback, useState } from 'react';
import {
  DEFAULT_EXPRESSIONS,
  DEFAULT_SCENE,
  type BeatAudioData,
  type BeatId,
  type ExpressionItem,
  type SceneConfig,
  type StoryboardBeat,
} from './types';
import { ExpressionsStep } from './components/ExpressionsStep';
import { SceneStep } from './components/SceneStep';
import { StoryboardStep } from './components/StoryboardStep';
import { VideoStep } from './components/VideoStep';
import { FinalStep } from './components/FinalStep';

type StepNumber = 1 | 2 | 3 | 4 | 5;

const STEPS: Array<{ num: StepNumber; label: string }> = [
  { num: 1, label: 'Expressions' },
  { num: 2, label: 'Scene' },
  { num: 3, label: 'Storyboard' },
  { num: 4, label: 'Video' },
  { num: 5, label: 'Final' },
];

function computeVoiceSignature(beat: StoryboardBeat, scene: SceneConfig): string {
  const linesStr = beat.lines.map((l) => `${l.speaker}:${l.text.trim()}`).join('|');
  return `${scene.characterA.name}::${scene.characterB.name}::${linesStr}`;
}

export default function App() {
  const [step, setStep] = useState<StepNumber>(1);
  const [expressions, setExpressions] = useState<ExpressionItem[]>(() =>
    DEFAULT_EXPRESSIONS.map((e) => ({ ...e }))
  );
  const [scene, setScene] = useState<SceneConfig>(() => ({
    ...DEFAULT_SCENE,
    characterA: { ...DEFAULT_SCENE.characterA },
    characterB: { ...DEFAULT_SCENE.characterB },
  }));
  const [beats, setBeats] = useState<StoryboardBeat[]>([]);
  const [audioMap, setAudioMap] = useState<Partial<Record<BeatId, BeatAudioData>>>({});
  const [generatingBeats, setGeneratingBeats] = useState<Partial<Record<BeatId, boolean>>>({});

  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [regeneratingBeatId, setRegeneratingBeatId] = useState<BeatId | null>(null);
  const [storyboardError, setStoryboardError] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);

  const canNavigateTo = (target: StepNumber): boolean => {
    if (target <= 2) return true;
    return beats.length === 4;
  };

  const handleGenerateStoryboard = async () => {
    setStoryboardError(null);
    setIsGeneratingStoryboard(true);

    try {
      const filled = expressions.filter((e) => e.phrase.trim().length > 0);
      const res = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expressions: filled,
          scene,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Could not generate storyboard.');
      }
      if (!Array.isArray(data?.beats) || data.beats.length !== 4) {
        throw new Error('Unexpected storyboard format returned.');
      }

      setBeats(data.beats);
      setStep(3);
    } catch (err) {
      setStoryboardError(
        err instanceof Error ? err.message : 'Failed to create storyboard.'
      );
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  const handleRegenerateBeat = async (beatId: BeatId) => {
    setStoryboardError(null);
    setRegeneratingBeatId(beatId);

    try {
      const res = await fetch('/api/storyboard/regenerate-beat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beatId,
          beats,
          expressions: expressions.filter((e) => e.phrase.trim().length > 0),
          scene,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Could not regenerate beat.');
      }
      if (data?.beat) {
        setBeats((prev) => prev.map((b) => (b.id === beatId ? data.beat : b)));
      }
    } catch (err) {
      setStoryboardError(
        err instanceof Error ? err.message : 'Failed to regenerate beat.'
      );
    } finally {
      setRegeneratingBeatId(null);
    }
  };

  const generateAudioForBeats = useCallback(
    async (targetBeats: StoryboardBeat[], forceAll = false) => {
      setTtsError(null);

      const tasks = targetBeats.map(async (beat) => {
        const sig = computeVoiceSignature(beat, scene);
        const existing = audioMap[beat.id];
        if (!forceAll && existing && existing.voiceSignature === sig) {
          return;
        }

        setGeneratingBeats((prev) => ({ ...prev, [beat.id]: true }));
        try {
          const res = await fetch('/api/tts/beat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lines: beat.lines,
              characterAName: scene.characterA.name,
              characterBName: scene.characterB.name,
              moodCue: beat.moodCue,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data?.error || `Voice error in ${beat.label} beat.`);
          }
          setAudioMap((prev) => ({
            ...prev,
            [beat.id]: {
              beatId: beat.id,
              audioDataUrl: data.audioDataUrl,
              durationSec: data.durationSec,
              voiceSignature: sig,
            },
          }));
        } catch (err) {
          setTtsError(
            err instanceof Error ? err.message : 'Voice generation failed.'
          );
        } finally {
          setGeneratingBeats((prev) => ({ ...prev, [beat.id]: false }));
        }
      });

      await Promise.all(tasks);
    },
    [audioMap, scene]
  );

  const handleGoToVideo = () => {
    setStep(4);
    generateAudioForBeats(beats, false);
  };

  const handleStartOver = () => {
    setStep(1);
    setBeats([]);
    setAudioMap({});
    setStoryboardError(null);
    setTtsError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] text-[#1E242B]">
      {/* Sticky Top Bar (compact height <= 56px, 3-zone contract) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E2E6EC]">
        <div className="h-1 w-full bg-gradient-to-r from-[#3B82F6] via-[#10B981] via-[#F59E0B] to-[#EC4899]" />
        <div className="max-w-6xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#1E242B] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Shall we play?
          </button>

          <nav
            aria-label="Workflow steps"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {STEPS.map((s) => {
              const unlocked = canNavigateTo(s.num);
              const active = step === s.num;
              const stepBorderColors: Record<StepNumber, string> = {
                1: 'border-[#2563EB]',
                2: 'border-[#EA580C]',
                3: 'border-[#059669]',
                4: 'border-[#7C3AED]',
                5: 'border-[#E11D48]',
              };
              return (
                <button
                  key={s.num}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => {
                    if (s.num === 4 && beats.length === 4) {
                      handleGoToVideo();
                    } else if (unlocked) {
                      setStep(s.num);
                    }
                  }}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    active
                      ? `${stepBorderColors[s.num]} text-[#1E242B] font-semibold`
                      : unlocked
                        ? 'border-transparent text-[#5A6675] hover:text-[#1E242B] cursor-pointer'
                        : 'border-transparent text-[#B0B8C4] cursor-not-allowed'
                  }`}
                >
                  {s.num}. {s.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <span className="md:hidden font-mono-num text-sm font-medium text-[#5A6675] whitespace-nowrap">
              {step} / 5
            </span>
            <button
              type="button"
              onClick={handleStartOver}
              className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              New Clip
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Step Switcher inside page flow (keeps sticky header compact) */}
      <div className="md:hidden bg-white border-b border-[#E2E6EC] px-4 py-2 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {STEPS.map((s) => {
            const unlocked = canNavigateTo(s.num);
            const active = step === s.num;
            return (
              <button
                key={s.num}
                type="button"
                disabled={!unlocked}
                onClick={() => {
                  if (s.num === 4 && beats.length === 4) {
                    handleGoToVideo();
                  } else if (unlocked) {
                    setStep(s.num);
                  }
                }}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[#2F4858] text-white'
                    : unlocked
                      ? 'bg-[#F0F3F6] text-[#1E242B]'
                      : 'bg-[#F8FAFC] text-[#B0B8C4]'
                }`}
              >
                {s.num}. {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Workspace */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {step === 1 && (
          <ExpressionsStep
            expressions={expressions}
            onChange={setExpressions}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <SceneStep
            scene={scene}
            onChange={setScene}
            onBack={() => setStep(1)}
            onGenerateStoryboard={handleGenerateStoryboard}
            isGenerating={isGeneratingStoryboard}
            error={storyboardError}
          />
        )}

        {step === 3 && beats.length === 4 && (
          <StoryboardStep
            beats={beats}
            expressions={expressions}
            scene={scene}
            onChangeBeats={setBeats}
            onRegenerateBeat={handleRegenerateBeat}
            regeneratingBeatId={regeneratingBeatId}
            onBack={() => setStep(2)}
            onNext={handleGoToVideo}
            error={storyboardError}
          />
        )}

        {step === 4 && beats.length === 4 && (
          <VideoStep
            beats={beats}
            scene={scene}
            audioMap={audioMap}
            generatingBeats={generatingBeats}
            ttsError={ttsError}
            onRegenerateVoices={() => generateAudioForBeats(beats, true)}
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
          />
        )}

        {step === 5 && beats.length === 4 && (
          <FinalStep
            beats={beats}
            expressions={expressions}
            scene={scene}
            audioMap={audioMap}
            onUpdateAuthor={(authorName) =>
              setScene((prev) => ({ ...prev, authorName }))
            }
            onBack={() => setStep(4)}
            onStartOver={handleStartOver}
          />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#E2E6EC] bg-white py-5 px-4 sm:px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-[#5A6675]">
          <span>Shall we play? · English Learning Short Film Studio</span>
          <span>Made with Google AI Studio · Script by {scene.authorName || 'joo hyun jun'}</span>
        </div>
      </footer>
    </div>
  );
}
