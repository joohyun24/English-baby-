import React, { useEffect, useRef } from 'react';
import { ArrowLeft, Sparkles, Check, Loader2 } from 'lucide-react';
import { VISUAL_STYLES, type SceneConfig, type VisualStyleId } from '../types';
import { renderCharacterStylePreview } from '../utils/canvasRenderer';

interface SceneStepProps {
  scene: SceneConfig;
  onChange: (next: SceneConfig) => void;
  onBack: () => void;
  onGenerateStoryboard: () => void;
  isGenerating: boolean;
  error: string | null;
}

export const SceneStep: React.FC<SceneStepProps> = ({
  scene,
  onChange,
  onBack,
  onGenerateStoryboard,
  isGenerating,
  error,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (previewCanvasRef.current) {
      renderCharacterStylePreview(previewCanvasRef.current, scene);
    }
  }, [scene]);

  const updateChar = (
    key: 'characterA' | 'characterB',
    field: 'name' | 'origin' | 'role' | 'outfit',
    value: string
  ) => {
    onChange({
      ...scene,
      [key]: {
        ...scene[key],
        [field]: value,
      },
    });
  };

  const selectStyle = (style: VisualStyleId) => {
    onChange({ ...scene, style });
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[#5A6675]">Step 2 of 5 · Stage & Cast</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1E242B] mt-1 text-balance">
          Choose your setting, characters, and animation style
        </h1>
        <p className="text-base text-[#4A5568] mt-2 max-w-2xl">
          Keep character names fictional and styles calm so every scene stays consistent across all four beats.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Setting, Situation, Characters */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl border border-[#E2E6EC] p-5 space-y-4">
            <h2 className="text-lg font-semibold text-[#1E242B]">Place & Situation</h2>

            <div>
              <label
                htmlFor="scene-place"
                className="block text-sm font-medium text-[#4A5568] mb-1.5"
              >
                Place & Year
              </label>
              <input
                id="scene-place"
                type="text"
                value={scene.place}
                onChange={(e) => onChange({ ...scene, place: e.target.value })}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] text-base text-[#1E242B]"
              />
            </div>

            <div>
              <label
                htmlFor="scene-situation"
                className="block text-sm font-medium text-[#4A5568] mb-1.5"
              >
                Situation
              </label>
              <textarea
                id="scene-situation"
                rows={3}
                value={scene.situation}
                onChange={(e) => onChange({ ...scene, situation: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] text-base text-[#1E242B] leading-relaxed"
              />
            </div>

            <div>
              <label
                htmlFor="scene-author"
                className="block text-sm font-medium text-[#4A5568] mb-1.5"
              >
                Writer Credit Name (for Final Screen)
              </label>
              <input
                id="scene-author"
                type="text"
                value={scene.authorName}
                onChange={(e) => onChange({ ...scene, authorName: e.target.value })}
                placeholder="joo hyun jun"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] text-base text-[#1E242B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Character A */}
            <div className="bg-white rounded-2xl border border-[#E2E6EC] p-5 space-y-3">
              <h2 className="text-lg font-semibold text-[#1E242B]">Character 1</h2>
              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-1">
                  Fictional Name
                </label>
                <input
                  type="text"
                  value={scene.characterA.name}
                  onChange={(e) => updateChar('characterA', 'name', e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-1">
                  From
                </label>
                <input
                  type="text"
                  value={scene.characterA.origin}
                  onChange={(e) => updateChar('characterA', 'origin', e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-1">
                  Outfit & Look
                </label>
                <input
                  type="text"
                  value={scene.characterA.outfit}
                  onChange={(e) => updateChar('characterA', 'outfit', e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] text-base"
                />
              </div>
            </div>

            {/* Character B */}
            <div className="bg-white rounded-2xl border border-[#E2E6EC] p-5 space-y-3">
              <h2 className="text-lg font-semibold text-[#1E242B]">Character 2</h2>
              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-1">
                  Fictional Name
                </label>
                <input
                  type="text"
                  value={scene.characterB.name}
                  onChange={(e) => updateChar('characterB', 'name', e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-1">
                  From
                </label>
                <input
                  type="text"
                  value={scene.characterB.origin}
                  onChange={(e) => updateChar('characterB', 'origin', e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A5568] mb-1">
                  Outfit & Look
                </label>
                <input
                  type="text"
                  value={scene.characterB.outfit}
                  onChange={(e) => updateChar('characterB', 'outfit', e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] text-base"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Style Menu + Live Preview */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl border border-[#E2E6EC] p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[#1E242B]">Animation Style Menu</h2>
              <p className="text-sm text-[#5A6675] mt-0.5">
                Same characters, outfits, and calm palette across every beat.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#DCE1E7]">
              <canvas
                ref={previewCanvasRef}
                width={640}
                height={340}
                className="w-full aspect-[16/9] block"
              />
              <div className="px-3.5 py-2.5 bg-[#FAFBFD] border-t border-[#E2E6EC] flex items-center justify-between text-xs sm:text-sm text-[#4A5568]">
                <span>{scene.characterA.name} ({scene.characterA.origin})</span>
                <span>{scene.characterB.name} ({scene.characterB.origin})</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {VISUAL_STYLES.map((option) => {
                const selected = scene.style === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectStyle(option.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                      selected
                        ? 'border-[#2F4858] bg-[#F2F5F7]'
                        : 'border-[#E2E6EC] bg-white hover:bg-[#FAFBFD]'
                    }`}
                  >
                    <div>
                      <p className="text-base font-semibold text-[#1E242B]">{option.name}</p>
                      <p className="text-sm text-[#5A6675] mt-0.5">{option.tagline}</p>
                      <p className="text-sm text-[#4A5568] mt-1">{option.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {option.swatches.map((hex, sIdx) => (
                        <span
                          key={sIdx}
                          className="w-5 h-5 rounded-full border border-[#CBD3DC]"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                      {selected && (
                        <Check className="w-5 h-5 text-[#2F4858] ml-1" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-base text-[#991B1B]"
        >
          {error}
        </div>
      )}

      {/* Navigation CTA row */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isGenerating}
          className="min-h-[52px] px-6 py-3 rounded-xl border border-[#CBD3DC] bg-white hover:bg-[#F0F3F6] text-[#1E242B] font-semibold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Expressions</span>
        </button>

        <button
          type="button"
          onClick={onGenerateStoryboard}
          disabled={isGenerating}
          className="min-h-[54px] px-8 py-3 rounded-xl bg-[#2F4858] hover:bg-[#233744] text-white font-semibold text-lg flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Writing 4-Beat Storyboard…</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Write 30s Storyboard</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
};
