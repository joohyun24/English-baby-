import React from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle2, ArrowRight, RotateCcw } from 'lucide-react';
import { DEFAULT_EXPRESSIONS, type ExpressionItem } from '../types';

interface ExpressionsStepProps {
  expressions: ExpressionItem[];
  onChange: (next: ExpressionItem[]) => void;
  onNext: () => void;
}

export const ExpressionsStep: React.FC<ExpressionsStepProps> = ({
  expressions,
  onChange,
  onNext,
}) => {
  const filledExpressions = expressions.filter((e) => e.phrase.trim().length > 0);
  const uniqueMovies = new Set(
    filledExpressions
      .map((e) => e.movie.trim().toLowerCase())
      .filter((m) => m.length > 0)
  );

  const tooFewExpressions = filledExpressions.length < 5;
  const onlyOneMovie = uniqueMovies.size <= 1;
  const hasWarning = tooFewExpressions || onlyOneMovie;

  const updateRow = (
    id: string,
    field: 'phrase' | 'movie' | 'note',
    value: string
  ) => {
    onChange(
      expressions.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const addRow = () => {
    onChange([
      ...expressions,
      {
        id: `expr-${Date.now()}`,
        phrase: '',
        movie: '',
        note: '',
      },
    ]);
  };

  const removeRow = (id: string) => {
    if (expressions.length <= 1) return;
    onChange(expressions.filter((item) => item.id !== id));
  };

  const resetSample = () => {
    onChange(DEFAULT_EXPRESSIONS.map((e) => ({ ...e })));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#5A6675]">Step 1 of 5 · Expression Notebook</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1E242B] mt-1 text-balance">
            Collect at least 5 English expressions from movies
          </h1>
          <p className="text-base text-[#4A5568] mt-2 max-w-2xl">
            Add phrases you learned from different films. We will weave every exact expression into a 30-second animated short story.
          </p>
        </div>

        <button
          type="button"
          onClick={resetSample}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DCE1E7] bg-white hover:bg-[#F0F3F6] text-sm font-medium text-[#2F4858] flex items-center gap-2 self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Load Sample Set</span>
        </button>
      </div>

      {/* Summary metrics strip (unboxed typography, tabular numerals) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#4A5568] border-y border-[#E2E6EC] py-3">
        <span className="font-mono-num font-medium text-[#1E242B]">
          {filledExpressions.length} / 5 expressions
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-mono-num font-medium text-[#1E242B]">
          {uniqueMovies.size} {uniqueMovies.size === 1 ? 'movie' : 'movies'} listed
        </span>
        <span aria-hidden="true">·</span>
        <span className="flex items-center gap-1.5 font-medium">
          {hasWarning ? (
            <>
              <AlertTriangle className="w-4 h-4 text-[#B45309]" />
              <span className="text-[#92400E]">Needs attention</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-[#4A7C6F]" />
              <span className="text-[#3A6559]">Ready for scene setup</span>
            </>
          )}
        </span>
      </div>

      {/* Warning banner when < 5 expressions or <= 1 movie */}
      {hasWarning && (
        <div
          role="alert"
          className="rounded-2xl border border-[#F5D08A] bg-[#FFFBEB] p-4 sm:p-5 flex items-start gap-3"
        >
          <AlertTriangle className="w-6 h-6 text-[#B45309] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-[#78350F]">
              Please add a bit more variety before filming
            </p>
            <ul className="text-sm sm:text-base text-[#92400E] space-y-1">
              {tooFewExpressions && (
                <li>
                  • You currently have {filledExpressions.length} expression
                  {filledExpressions.length === 1 ? '' : 's'}. Enter at least 5 expressions.
                </li>
              )}
              {onlyOneMovie && (
                <li>
                  • Expressions come from only {uniqueMovies.size} movie. Mix expressions from at least 2 different movies.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Expressions Input List */}
      <div className="space-y-4">
        {expressions.map((item, idx) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-[#E2E6EC] p-4 sm:p-5 transition-colors focus-within:border-[#2F4858]"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="font-mono-num text-sm font-semibold text-[#5A6675]">
                0{idx + 1}. Expression
              </span>
              {expressions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(item.id)}
                  aria-label={`Remove expression ${idx + 1}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#64748B] hover:text-[#B42318] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-5">
                <label
                  htmlFor={`phrase-${item.id}`}
                  className="block text-sm font-medium text-[#4A5568] mb-1.5"
                >
                  English Expression
                </label>
                <input
                  id={`phrase-${item.id}`}
                  type="text"
                  value={item.phrase}
                  onChange={(e) => updateRow(item.id, 'phrase', e.target.value)}
                  placeholder="e.g., bittersweet"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] text-lg font-medium text-[#1E242B] placeholder:text-[#94A3B8]"
                />
              </div>

              <div className="md:col-span-3">
                <label
                  htmlFor={`movie-${item.id}`}
                  className="block text-sm font-medium text-[#4A5568] mb-1.5"
                >
                  Source Movie
                </label>
                <input
                  id={`movie-${item.id}`}
                  type="text"
                  value={item.movie}
                  onChange={(e) => updateRow(item.id, 'movie', e.target.value)}
                  placeholder="e.g., Notting Hill (노팅힐)"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] text-base text-[#1E242B] placeholder:text-[#94A3B8]"
                />
              </div>

              <div className="md:col-span-4">
                <label
                  htmlFor={`note-${item.id}`}
                  className="block text-sm font-medium text-[#4A5568] mb-1.5"
                >
                  Scene Idea / Meaning Note
                </label>
                <input
                  id={`note-${item.id}`}
                  type="text"
                  value={item.note}
                  onChange={(e) => updateRow(item.id, 'note', e.target.value)}
                  placeholder="Optional note or context"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D4DAE2] bg-[#FAFBFD] text-base text-[#1E242B] placeholder:text-[#94A3B8]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Action Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={addRow}
          className="min-h-[52px] px-6 py-3 rounded-xl border border-[#CBD3DC] bg-white hover:bg-[#F0F3F6] text-[#1E242B] font-semibold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>Add Expression</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={filledExpressions.length === 0}
          className="min-h-[54px] px-8 py-3 rounded-xl bg-[#2F4858] hover:bg-[#233744] text-white font-semibold text-lg flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <span>Next: Set the Scene</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
};
